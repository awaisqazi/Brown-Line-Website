import type { TransitEvent } from './supabase';

/**
 * Build-time "Add to calendar" helpers.
 *
 * Everything here is pure and deterministic: the same event row always produces
 * the same Google Calendar URL and the same .ics payload, so a rebuild never
 * churns output just because the clock moved. No browser APIs are used, which
 * keeps these usable from Astro frontmatter during a static build.
 *
 * All events live in America/Chicago. Rather than converting to UTC (which
 * would need a full tz database), we emit floating local times and pin them to
 * Chicago: Google gets `ctz=America/Chicago`, and the .ics carries a VTIMEZONE
 * block plus `TZID=America/Chicago` on DTSTART/DTEND.
 */

/** IANA zone every Brown Line event is expressed in. */
export const EVENT_TIME_ZONE = 'America/Chicago';

/** Default length, in minutes, for an event that has a start but no end time. */
const DEFAULT_DURATION_MINUTES = 120;

/** Minutes past midnight for 23:59, the same-day cap for a defaulted end time. */
const END_OF_DAY_MINUTES = 23 * 60 + 59;

const MINUTES_PER_DAY = 24 * 60;

/** A calendar date plus an optional wall-clock time, both Chicago-local. */
interface LocalDateTime {
  year: number;
  month: number;
  /** Day of month, 1 based. */
  day: number;
  /** Minutes past local midnight, or null for an all-day (date only) value. */
  minutes: number | null;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * Parse a `YYYY-MM-DD` column value. Returns null when it is missing or
 * malformed. Exported so the structured-data builders in `seo.ts` read event
 * dates exactly the way the calendar links do.
 */
export function parseEventDate(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Parse a Postgres `time` string like "18:30:00" into minutes past midnight.
 * Seconds are intentionally dropped: no listing is precise to the second, and
 * dropping them keeps the generated stamps tidy. Exported alongside
 * `parseEventDate` for the structured-data builders in `seo.ts`.
 */
export function parseEventTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
}

/** Shift a calendar date by whole days, using UTC math so no zone can shift it. */
function addDays(date: { year: number; month: number; day: number }, days: number) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** `YYYYMMDD`, the ICS/Google DATE form. */
function formatDateStamp(date: { year: number; month: number; day: number }) {
  return `${date.year}${pad2(date.month)}${pad2(date.day)}`;
}

/**
 * `YYYYMMDDTHHMMSS`, the floating (no trailing Z) local date-time form. Paired
 * with `ctz` on Google and with `TZID=` in the .ics so it resolves to Chicago.
 */
function formatDateTimeStamp(value: LocalDateTime) {
  const minutes = value.minutes ?? 0;
  const hours = Math.floor(minutes / 60);
  return `${formatDateStamp(value)}T${pad2(hours)}${pad2(minutes % 60)}00`;
}

/**
 * Resolve an event row into a start/end pair.
 *
 * - No start time: an all-day entry (`minutes: null`) on the event date.
 * - Start and end: used as given. An end at or before the start is read as a
 *   late-night event that runs past midnight, so it rolls to the next day.
 * - Start only: a two hour block, capped at 23:59 the same day rather than
 *   spilling into the following morning.
 */
function resolveInterval(event: TransitEvent): { start: LocalDateTime; end: LocalDateTime } | null {
  const date = parseEventDate(event.event_date);
  if (!date) return null;

  const startMinutes = parseEventTime(event.start_time);
  if (startMinutes === null) {
    return {
      start: { ...date, minutes: null },
      end: { ...date, minutes: null },
    };
  }

  const start: LocalDateTime = { ...date, minutes: startMinutes };
  const endMinutes = parseEventTime(event.end_time);

  if (endMinutes !== null) {
    if (endMinutes > startMinutes) {
      return { start, end: { ...date, minutes: endMinutes } };
    }
    // Wraps past midnight, e.g. 9 PM to 1 AM.
    return { start, end: { ...addDays(date, 1), minutes: endMinutes } };
  }

  const defaulted = startMinutes + DEFAULT_DURATION_MINUTES;
  const capped = Math.min(defaulted, END_OF_DAY_MINUTES);
  return { start, end: { ...date, minutes: Math.min(capped, MINUTES_PER_DAY - 1) } };
}

/** Only real web links belong in a calendar entry. */
function safeUrl(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}

/**
 * Location string for the entry: venue, neighborhood, then the city and state
 * so a phone's map app can resolve it. Mirrors EventCard's dedupe so a venue
 * that already ends in ", Neighborhood" does not print the area twice.
 */
function buildLocation(event: TransitEvent): string {
  const venue = event.venue?.trim() ?? '';
  const neighborhood = event.neighborhood?.trim() ?? '';
  const parts: string[] = [];

  if (venue) parts.push(venue);

  if (neighborhood) {
    const normalize = (value: string) => value.trim().replace(/^the\s+/i, '').toLowerCase();
    const lastComma = venue.lastIndexOf(',');
    const venueEndsWithArea =
      lastComma !== -1 && normalize(venue.slice(lastComma + 1)) === normalize(neighborhood);
    if (!venueEndsWithArea) parts.push(neighborhood);
  }

  parts.push('Chicago, IL');
  return parts.join(', ');
}

/**
 * Notes body for the entry: the event description, the organizer's link, and a
 * short credit line so a forwarded invite still says where it came from.
 */
function buildDescription(event: TransitEvent): string {
  const blocks: string[] = [];
  const description = event.description?.trim();
  if (description) blocks.push(description);

  const url = safeUrl(event.event_url);
  if (url) blocks.push(url);

  blocks.push('Via The Brown Line, a Chicago cultural newsletter.');
  return blocks.join('\n\n');
}

/**
 * Google Calendar prefilled-event URL. Timed events send floating local stamps
 * with `ctz=America/Chicago`; timeless events send a DATE range whose end is
 * exclusive, which is how Google marks a single all-day event.
 */
export function buildGoogleCalendarUrl(event: TransitEvent): string {
  const interval = resolveInterval(event);
  if (!interval) return '';

  const { start, end } = interval;
  const dates =
    start.minutes === null
      ? `${formatDateStamp(start)}/${formatDateStamp(addDays(end, 1))}`
      : `${formatDateTimeStamp(start)}/${formatDateTimeStamp(end)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title?.trim() || 'Brown Line event',
    dates,
    details: buildDescription(event),
    location: buildLocation(event),
    ctz: EVENT_TIME_ZONE,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Escape a value for an ICS text property: backslash first, then the field
 * separators, then real newlines as the literal two character `\n` sequence.
 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fold a content line to the 75 octet limit from RFC 5545, continuing with a
 * CRLF and a single leading space. Counted in UTF-8 bytes, and never split
 * inside a character, so accents and emoji survive the trip.
 */
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const limit = 75;
  const pieces: string[] = [];
  let current = '';
  let currentBytes = 0;
  // First line allows 75 octets; continuation lines spend one on the space.
  let allowance = limit;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    if (currentBytes + charBytes > allowance) {
      pieces.push(current);
      current = '';
      currentBytes = 0;
      allowance = limit - 1;
    }
    current += char;
    currentBytes += charBytes;
  }
  pieces.push(current);

  return pieces.join('\r\n ');
}

/**
 * VTIMEZONE for America/Chicago, with the post 2007 US daylight saving rules
 * (second Sunday in March, first Sunday in November). Bundling it means every
 * client resolves `TZID=America/Chicago` the same way instead of guessing.
 */
const CHICAGO_VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${EVENT_TIME_ZONE}`,
  `X-LIC-LOCATION:${EVENT_TIME_ZONE}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0600',
  'TZOFFSETTO:-0500',
  'TZNAME:CDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0600',
  'TZNAME:CST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/**
 * A minimal single-event VCALENDAR document, CRLF terminated.
 *
 * DTSTAMP is derived from the event date rather than the build clock so the
 * generated file (and therefore the page hash) stays stable across rebuilds.
 * Returns '' when the row has no usable date.
 */
export function buildIcsContent(event: TransitEvent): string {
  const interval = resolveInterval(event);
  if (!interval) return '';

  const { start, end } = interval;
  const isAllDay = start.minutes === null;
  const title = event.title?.trim() || 'Brown Line event';
  const url = safeUrl(event.event_url);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Brown Line//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  // All-day entries use DATE values, which carry no zone, so the VTIMEZONE is
  // only worth its bytes for timed events.
  if (!isAllDay) lines.push(...CHICAGO_VTIMEZONE);

  lines.push(
    'BEGIN:VEVENT',
    `UID:${event.id}@thebrownlinechi.com`,
    `DTSTAMP:${formatDateStamp(start)}T000000Z`
  );

  if (isAllDay) {
    // DTEND is exclusive for DATE values, so a one day event ends the next day.
    lines.push(
      `DTSTART;VALUE=DATE:${formatDateStamp(start)}`,
      `DTEND;VALUE=DATE:${formatDateStamp(addDays(end, 1))}`
    );
  } else {
    lines.push(
      `DTSTART;TZID=${EVENT_TIME_ZONE}:${formatDateTimeStamp(start)}`,
      `DTEND;TZID=${EVENT_TIME_ZONE}:${formatDateTimeStamp(end)}`
    );
  }

  lines.push(`SUMMARY:${escapeIcsText(title)}`);
  lines.push(`DESCRIPTION:${escapeIcsText(buildDescription(event))}`);
  lines.push(`LOCATION:${escapeIcsText(buildLocation(event))}`);
  if (url) lines.push(`URL:${url}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/**
 * The same VCALENDAR document as a `data:` URI, ready for an `<a href>` with a
 * `download` attribute. A data URI keeps this a fully static site: no per-event
 * .ics files to emit and no endpoint to hit.
 */
export function buildIcsDataUri(event: TransitEvent): string {
  const content = buildIcsContent(event);
  if (!content) return '';
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`;
}

/**
 * Filename for the downloaded .ics, e.g. "lunar-new-year-parade.ics". Falls
 * back to a generic name when a title slugifies to nothing.
 */
export function buildIcsFileName(event: TransitEvent): string {
  const slug = (event.title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    // Strip combining marks so accented titles slugify to plain ASCII.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `${slug || 'brown-line-event'}.ics`;
}
