/**
 * Which newsletter issues the site renders itself, and where the rest live.
 *
 * The rule is Beehiiv's own: an issue is rendered here only when the
 * platform makes it public (free audience, not gated, not hidden). Premium
 * and gated issues never hand us a body (`isPaywalled` on the item, set by
 * beehiiv-api.ts from the post's audience and gating flags, or by beehiiv.ts
 * from the feed's paywall placeholder), so they stay in the dispatch list
 * with an off-site link to the post on the newsletter site, where Beehiiv
 * checks the reader's login and tier. Nothing here overrides that.
 *
 * On top of it, an optional date floor: set NEWSLETTER_PUBLIC_FROM
 * (YYYY-MM-DD) and issues published before it stay off-site even when the
 * platform marks them public. Off by default, so the audience setting on
 * each post is the only thing that matters unless the owner says otherwise.
 *
 * Hand-migrated rows in public.articles are not subject to either rule: the
 * admin published them on purpose through /admin#newsletter.
 */
import { PLATFORM_ORIGIN } from './beehiiv';

/**
 * The host Beehiiv serves the newsletter from once the domain move is done.
 * Off-site links use it directly when the platform already reports it; until
 * then they go through the permanent address, which forwards to whatever host
 * is live.
 */
const CURRENT_PLATFORM_HOST = 'newsletter.thebrownlinechi.com';

/**
 * Optional floor: first day (UTC, YYYY-MM-DD) issues may be rendered on site,
 * from the NEWSLETTER_PUBLIC_FROM env var. '' (the default) means no floor.
 * Anything that is not a valid date is ignored with a build warning.
 */
export const PUBLIC_ARCHIVE_FROM = resolveCutoff(import.meta.env.NEWSLETTER_PUBLIC_FROM);

/** The floor as epoch milliseconds (midnight UTC), or 0 when there is none. */
export const PUBLIC_ARCHIVE_FROM_MS = PUBLIC_ARCHIVE_FROM ? Date.parse(`${PUBLIC_ARCHIVE_FROM}T00:00:00Z`) : 0;

/**
 * True when an issue published at `publishedAt` (epoch milliseconds) clears
 * the date floor. Always true while no floor is set. With a floor, an unknown
 * date (0) counts as old, so it stays off-site.
 */
export function isInPublicArchive(publishedAt: number): boolean {
  if (!PUBLIC_ARCHIVE_FROM_MS) return true;
  return publishedAt >= PUBLIC_ARCHIVE_FROM_MS;
}

/**
 * Where to send readers for an issue that has no page here. `reportedLink`
 * is the post URL the platform gave us (feed `<link>` or API `web_url`).
 */
export function offSiteIssueUrl(slug: string, reportedLink: string): string {
  if (!slug) return reportedLink;
  try {
    const url = new URL(reportedLink);
    if (url.hostname.toLowerCase() === CURRENT_PLATFORM_HOST) return `${url.origin}/p/${slug}`;
  } catch {
    // Not a URL at all; the permanent address below still works.
  }
  return `${PLATFORM_ORIGIN}/p/${slug}`;
}

/**
 * Short label for captions, e.g. "Jan 1, 2026", formatted in UTC like the
 * cards. '' while no floor is set.
 */
export function formatArchiveCutoff(): string {
  if (!PUBLIC_ARCHIVE_FROM_MS) return '';
  return new Date(PUBLIC_ARCHIVE_FROM_MS).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function resolveCutoff(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`))) {
    return trimmed;
  }
  console.warn(`Ignoring NEWSLETTER_PUBLIC_FROM="${trimmed}" (expected YYYY-MM-DD); no date floor applied.`);
  return '';
}
