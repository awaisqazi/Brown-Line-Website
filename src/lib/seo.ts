import type { TransitEvent } from './supabase';
import { formatStopDate, formatTimeRange } from './dates';
import { EVENT_TIME_ZONE, parseEventDate, parseEventTime } from './calendar';

/**
 * Build-time structured data (JSON-LD) helpers.
 *
 * Everything here is pure: the same row always produces the same object, so a
 * rebuild never churns output just because the clock moved. Pages print the
 * result with `<script type="application/ld+json" set:html={JSON.stringify(...)}>`.
 *
 * Values that would be empty are left out rather than emitted as empty strings,
 * because a missing property is honest and a blank one is not.
 */

export const BRAND_NAME = 'The Brown Line';
export const INSTAGRAM_URL = 'https://www.instagram.com/thebrownlinechi';

/** One-line description of the publication, reused across the site schemas. */
export const BRAND_DESCRIPTION =
  'Chicago arts, culture, and community through a Global South diaspora lens. A curated guide to diaspora events plus a weekly newsletter.';

const SCHEMA_CONTEXT = 'https://schema.org';

/** JSON-LD is a plain object tree; this is as specific as it needs to be. */
export type JsonLd = Record<string, unknown>;

/**
 * A schema serialized for `<script type="application/ld+json" set:html={...}>`.
 * `<` is escaped, so a stray "</script>" in a listing description can never
 * close the tag early. The escape is still valid JSON.
 */
export function stringifyJsonLd(schema: JsonLd): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Only real web links belong in structured data. Mirrors `calendar.ts`. */
function safeUrl(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}

/**
 * Reads America/Chicago's UTC offset (in minutes, negative here) at a given
 * instant. Derived from the platform zone data instead of hardcoded, so the
 * daylight-saving switch is handled for us.
 */
const CHICAGO_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function chicagoOffsetMinutes(instant: Date): number {
  const parts = Object.fromEntries(
    CHICAGO_PARTS_FORMATTER.formatToParts(instant).map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUtc - instant.getTime()) / 60000;
}

/**
 * ISO 8601 stamp for a Chicago wall-clock date and time, e.g.
 * `2026-08-12T18:30:00-05:00`. A date with no time returns the plain
 * `YYYY-MM-DD` form, which schema.org accepts for an all-day event.
 *
 * The offset is resolved twice: the first pass reads the zone at the wall time
 * treated as UTC, the second at the instant that first guess implies, which
 * settles the few hours a year where the two land on opposite sides of a
 * daylight-saving switch.
 */
function toChicagoIso(
  date: { year: number; month: number; day: number },
  minutes: number | null
): string {
  const dateStamp = `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
  if (minutes === null) return dateStamp;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const wallAsUtc = Date.UTC(date.year, date.month - 1, date.day, hours, mins);
  const firstGuess = chicagoOffsetMinutes(new Date(wallAsUtc));
  const offset = chicagoOffsetMinutes(new Date(wallAsUtc - firstGuess * 60000));

  const sign = offset < 0 ? '-' : '+';
  const absolute = Math.abs(offset);
  return `${dateStamp}T${pad2(hours)}:${pad2(mins)}:00${sign}${pad2(
    Math.floor(absolute / 60)
  )}:${pad2(absolute % 60)}`;
}

/** Shift a calendar date by whole days, using UTC math so no zone can move it. */
function addCalendarDays(date: { year: number; month: number; day: number }, days: number) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * URL segment for an event's detail page: a readable title slug with the row's
 * uuid appended, e.g. `lunar-new-year-parade-3f2c...`. The uuid keeps it unique
 * and stable across rebuilds; the words in front keep the URL legible. Same
 * slug rules as the .ics filename in `calendar.ts`.
 */
export function buildEventSlug(event: TransitEvent): string {
  const slug = (event.title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    // Strip combining marks so accented titles slugify to plain ASCII.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug ? `${slug}-${event.id}` : event.id;
}

/** Site-relative path to an event's detail page, e.g. `/events/<slug>`. */
export function buildEventPath(event: TransitEvent, base: string): string {
  return `${base}events/${buildEventSlug(event)}`;
}

/** Absolute URL for an event's detail page, for share cards and JSON-LD. */
export function buildEventUrl(event: TransitEvent, base: string, siteUrl: string | URL): string {
  return new URL(buildEventPath(event, base), siteUrl).toString();
}

/**
 * Venue, once. Mirrors the EventCard dedupe: when the venue already ends in
 * ", Neighborhood" the trailing segment is dropped, so the area never prints
 * twice.
 */
function displayVenue(event: TransitEvent): string {
  const venue = event.venue?.trim() ?? '';
  const neighborhood = event.neighborhood?.trim() ?? '';
  if (!venue || !neighborhood) return venue;

  const normalize = (value: string) => value.trim().replace(/^the\s+/i, '').toLowerCase();
  const lastComma = venue.lastIndexOf(',');
  return lastComma !== -1 && normalize(venue.slice(lastComma + 1)) === normalize(neighborhood)
    ? venue.slice(0, lastComma).trim()
    : venue;
}

/** Collapse a stored text block onto one line for meta tags and descriptions. */
function flatten(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Trim to a whole word inside `limit` characters, marking the cut. */
function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const clipped = value.slice(0, limit - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? clipped.slice(0, lastSpace) : clipped).replace(/[,.;:]$/, '')}…`;
}

/**
 * Meta description for an event detail page: when and where first (that is what
 * a search result needs), then as much of the listing blurb as fits.
 */
export function buildEventMetaDescription(event: TransitEvent): string {
  const when = [formatStopDate(event.event_date), formatTimeRange(event.start_time, event.end_time)]
    .filter(Boolean)
    .join(', ');
  const where = [displayVenue(event), event.neighborhood?.trim()].filter(Boolean).join(', ');
  const lead = [when, where].filter(Boolean).join(' at ');
  const blurb =
    flatten(event.description) ||
    `A stop on ${BRAND_NAME}, Chicago's guide to Global South diaspora arts and culture.`;

  return truncate([lead ? `${lead}.` : '', blurb].filter(Boolean).join(' '), 200);
}

/**
 * Offers from the free-text `cost_info` column, or nothing when the column has
 * no price in it. A single dollar amount becomes an Offer, two or more become
 * an AggregateOffer, and a listing that says "free" is priced at 0. Anything
 * else ("Donations welcome", "See organizer") is left out rather than guessed.
 */
function buildOffers(event: TransitEvent, fallbackUrl: string): JsonLd | undefined {
  const cost = event.cost_info?.trim() ?? '';
  if (!cost) return undefined;

  const amounts = priceAmounts(cost);
  const url = safeUrl(event.event_url) || fallbackUrl;

  if (amounts.length === 0) {
    return isFreeEvent(event)
      ? {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: `${SCHEMA_CONTEXT}/InStock`,
          url,
        }
      : undefined;
  }

  if (amounts.length === 1) {
    return {
      '@type': 'Offer',
      price: String(amounts[0]),
      priceCurrency: 'USD',
      availability: `${SCHEMA_CONTEXT}/InStock`,
      url,
    };
  }

  return {
    '@type': 'AggregateOffer',
    lowPrice: String(Math.min(...amounts)),
    highPrice: String(Math.max(...amounts)),
    priceCurrency: 'USD',
    offerCount: amounts.length,
    url,
  };
}

/** Dollar amounts named in a free-text cost line, in the order they appear. */
function priceAmounts(cost: string): number[] {
  return Array.from(cost.matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g)).map((match) => Number(match[1]));
}

/** Same "is this free" reading the events board filters by. */
function isFreeEvent(event: TransitEvent): boolean {
  const cost = event.cost_info?.toLowerCase() ?? '';
  return /\bfree\b/.test(cost) && !/\bnot free\b/.test(cost);
}

/**
 * Organizer, once. Mirrors the EventCard rule: skip it when it just repeats the
 * venue, and never let internal research phrasing reach a search engine.
 */
function organizerName(event: TransitEvent): string {
  const organizer = event.organizer?.trim() ?? '';
  const venue = event.venue?.trim() ?? '';
  if (!organizer) return '';
  if (organizer === venue || organizer === displayVenue(event)) return '';
  return /surfaced through|not inspected|in this pass|roundup|listing\b/i.test(organizer)
    ? ''
    : organizer;
}

export interface EventJsonLdOptions {
  /** Absolute URL of this event's detail page. */
  url: string;
  /** Absolute image URL, when the row carries a flyer or photo. */
  image?: string;
}

/**
 * schema.org/Event for one row. Times are emitted as Chicago-local stamps with
 * a real UTC offset; a row with no start time becomes a date-only (all day)
 * event, and `endDate` is only set when the row actually has an end time. An
 * end at or before the start is read as running past midnight, the same way the
 * calendar links treat it.
 */
export function buildEventJsonLd(event: TransitEvent, options: EventJsonLdOptions): JsonLd {
  const { url, image } = options;
  const schema: JsonLd = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Event',
    name: event.title?.trim() || 'Brown Line event',
    url,
    eventStatus: `${SCHEMA_CONTEXT}/EventScheduled`,
    eventAttendanceMode: `${SCHEMA_CONTEXT}/OfflineEventAttendanceMode`,
  };

  const date = parseEventDate(event.event_date);
  if (date) {
    const startMinutes = parseEventTime(event.start_time);
    const endMinutes = parseEventTime(event.end_time);
    schema.startDate = toChicagoIso(date, startMinutes);
    if (startMinutes !== null && endMinutes !== null) {
      const endDate = endMinutes > startMinutes ? date : addCalendarDays(date, 1);
      schema.endDate = toChicagoIso(endDate, endMinutes);
    }
  }

  const venue = displayVenue(event);
  if (venue) {
    const place: JsonLd = {
      '@type': 'Place',
      name: venue,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Chicago',
        addressRegion: 'IL',
        addressCountry: 'US',
      },
    };
    const neighborhood = event.neighborhood?.trim();
    if (neighborhood) {
      place.containedInPlace = { '@type': 'Place', name: neighborhood };
    }
    schema.location = place;
  }

  const organizer = organizerName(event);
  if (organizer) {
    const organizerUrl = safeUrl(event.event_url);
    schema.organizer = {
      '@type': 'Organization',
      name: organizer,
      ...(organizerUrl ? { url: organizerUrl } : {}),
    };
  }

  const offers = buildOffers(event, url);
  if (offers) schema.offers = offers;
  // "Free" only counts when the listing names no other price. A line like
  // "Free entry, $10 for the workshop" is mixed, so claiming free would be a lie.
  if (isFreeEvent(event) && priceAmounts(event.cost_info ?? '').length === 0) {
    schema.isAccessibleForFree = true;
  }
  if (image) schema.image = [image];

  const description = flatten(event.description);
  schema.description = description || buildEventMetaDescription(event);

  const tags = (event.tags ?? []).filter(Boolean);
  if (tags.length > 0) schema.keywords = tags.join(', ');

  return schema;
}

/**
 * Organization plus WebSite for the publication itself, as one `@graph` so both
 * nodes ship in a single script. Rendered on every page from `Layout.astro`;
 * the `@id` values give other schemas something stable to point at.
 */
export function buildSiteJsonLd(options: { siteUrl: string; logoUrl: string }): JsonLd {
  const { siteUrl, logoUrl } = options;

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}#organization`,
        name: BRAND_NAME,
        url: siteUrl,
        logo: { '@type': 'ImageObject', url: logoUrl },
        description: BRAND_DESCRIPTION,
        sameAs: [INSTAGRAM_URL],
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        name: BRAND_NAME,
        url: siteUrl,
        description: BRAND_DESCRIPTION,
        inLanguage: 'en-US',
        publisher: { '@id': `${siteUrl}#organization` },
      },
    ],
  };
}

/** schema.org/BreadcrumbList from an ordered trail of name and URL pairs. */
export function buildBreadcrumbJsonLd(trail: { name: string; url: string }[]): JsonLd {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: step.url,
    })),
  };
}

/** schema.org/ItemList, used by the events board to point at each detail page. */
export function buildItemListJsonLd(name: string, items: { name: string; url: string }[]): JsonLd {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'ItemList',
    name,
    itemListOrder: `${SCHEMA_CONTEXT}/ItemListOrderAscending`,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export interface ArticleJsonLdOptions {
  headline: string;
  description: string;
  /** Absolute URL of the article page. */
  url: string;
  /** Absolute hero image URL. */
  image: string;
  /** ISO publish timestamp. */
  datePublished: string;
  /** Site home URL, for the author/publisher nodes. */
  siteUrl: string;
  logoUrl: string;
  section?: string;
  keywords?: string[];
}

/**
 * schema.org/Article for one newsletter issue. The Brown Line publishes as a
 * masthead rather than under bylines, so the author is the Organization.
 */
export function buildArticleJsonLd(options: ArticleJsonLdOptions): JsonLd {
  const {
    headline,
    description,
    url,
    image,
    datePublished,
    siteUrl,
    logoUrl,
    section,
    keywords = [],
  } = options;

  const publisher = {
    '@type': 'Organization',
    '@id': `${siteUrl}#organization`,
    name: BRAND_NAME,
    url: siteUrl,
    logo: { '@type': 'ImageObject', url: logoUrl },
  };

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Article',
    headline: truncate(headline, 110),
    description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: [image],
    datePublished,
    dateModified: datePublished,
    author: publisher,
    publisher,
    inLanguage: 'en-US',
    ...(section ? { articleSection: section } : {}),
    ...(keywords.length > 0 ? { keywords: keywords.join(', ') } : {}),
  };
}
