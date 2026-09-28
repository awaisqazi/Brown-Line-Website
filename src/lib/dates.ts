/**
 * How far back the events board keeps stops that have already departed. The
 * same window sizes the "View past stops" drawer on `/events` and the set of
 * per-event detail pages, so a card on the board never links to a 404.
 */
export const PAST_EVENT_WINDOW_DAYS = 60;

/**
 * How far back the homepage rail and the events board look so a run that
 * began before today (an exhibit stored as one row per day) still shows its
 * full date range. The admin caps a single range at 90 days; 120 also covers
 * CSV imports.
 */
export const SERIES_LOOKBACK_DAYS = 120;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Standardized descriptive label for a `YYYY-MM-DD` event date, e.g. "Sun. Jun 28".
 * Derived purely from the date so every event on the same day renders identically
 * (this replaced the free-text `display_date` column, which drifted between formats
 * like "Tue. Jun 23" and "Tue. Jun. 23" and split a single day into two segments).
 * Parsed in UTC so the calendar day never shifts across time zones.
 */
export function formatStopDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const parts = parseCalendarDate(dateString);
  if (!parts) return dateString;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return `${WEEKDAYS[date.getUTCDay()]}. ${MONTHS[parts.month - 1]} ${parts.day}`;
}

/**
 * `YYYY-MM-DD` split into numbers, or null when the string is not a date that
 * exists on the calendar, so no label ever prints "undefined" or the weekday
 * of a neighboring month.
 */
function parseCalendarDate(dateString: string): { year: number; month: number; day: number } | null {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/**
 * Short month-and-day label for a `YYYY-MM-DD` date, e.g. "Sep 27". Used for
 * the date-range labels on collapsed runs ("Sep 27 – Nov 29") on the board and
 * the homepage rail.
 */
export function formatMonthDay(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const parts = parseCalendarDate(dateString);
  if (!parts) return dateString;
  return `${MONTHS[parts.month - 1]} ${parts.day}`;
}

/**
 * Compact 12-hour label for a `HH:MM[:SS]` start time, e.g. "8 PM" or "5:30 PM".
 * Returns '' for missing or unparseable values so callers can render nothing.
 */
export function formatStartTime(value: string | null | undefined): string {
  if (!value) return '';
  const [rawHours, minutes = 0] = value.split(':').map(Number);
  // Postgres accepts 24:00 as end of day; everything else outside the clock
  // is not a time and renders as nothing rather than "1:61 PM".
  if (Number.isNaN(rawHours) || rawHours < 0 || rawHours > 24 || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return '';
  }
  if (rawHours === 24 && minutes > 0) return '';
  const hours = rawHours === 24 ? 0 : rawHours;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes ? `${hour12}:${String(minutes).padStart(2, '0')} ${period}` : `${hour12} ${period}`;
}

/**
 * Time label for a start/end pair, e.g. "7 PM to 9 PM". Falls back to the
 * single start-time label (via formatStartTime) when there is no end time.
 */
export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  const startLabel = formatStartTime(start);
  const endLabel = formatStartTime(end);
  if (!endLabel) return startLabel;
  // An end with no start is still an end, not a start time in disguise.
  if (!startLabel) return `until ${endLabel}`;
  return `${startLabel} to ${endLabel}`;
}

/**
 * Shift a `YYYY-MM-DD` date by whole days (UTC math, so the calendar day never
 * drifts across time zones). Used to size the past-stops look-back window.
 */
export function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * Today's calendar date in America/Chicago as `YYYY-MM-DD`, so "upcoming"
 * queries stay anchored to the site's home time zone no matter where the
 * build runs. Falls back to the UTC date if the Intl parts are missing.
 */
export function getChicagoDateString(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}
