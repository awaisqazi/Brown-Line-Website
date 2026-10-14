/**
 * Which newsletter issues the site renders itself, and where the rest live.
 *
 * Issues published on or after PUBLIC_ARCHIVE_FROM get a page here at
 * /newsletter/<slug> whenever the platform hands us their body. Older issues
 * still appear in the dispatch list, but their cards link to the newsletter
 * platform, where Beehiiv's subscriber wall decides who reads them. The rule
 * is a date, not the platform's audience flag: before this module existed the
 * split happened by accident, because every first-season issue was premium on
 * Beehiiv and premium issues reach the feed as a placeholder. Now an old issue
 * that someone flips to public on Beehiiv stays off-site, and a recent issue
 * marked premium is still skipped (there is no body to render anyway).
 *
 * Hand-migrated rows in public.articles are not subject to the cutoff: the
 * admin published them on purpose through /admin#newsletter.
 */
import { PLATFORM_ORIGIN } from './beehiiv';

const DEFAULT_PUBLIC_ARCHIVE_FROM = '2026-01-01';

/**
 * The host Beehiiv serves the newsletter from once the domain move is done.
 * Off-site links use it directly when the platform already reports it; until
 * then they go through the permanent address, which forwards to whatever host
 * is live.
 */
const CURRENT_PLATFORM_HOST = 'newsletter.thebrownlinechi.com';

/**
 * First day (UTC, YYYY-MM-DD) of the public archive. Override per build with
 * the NEWSLETTER_PUBLIC_FROM env var; anything that is not a valid date falls
 * back to the default with a build warning.
 */
export const PUBLIC_ARCHIVE_FROM = resolveCutoff(import.meta.env.NEWSLETTER_PUBLIC_FROM);

/** The cutoff as epoch milliseconds (midnight UTC), for comparing feed dates. */
export const PUBLIC_ARCHIVE_FROM_MS = Date.parse(`${PUBLIC_ARCHIVE_FROM}T00:00:00Z`);

/**
 * True when an issue published at `publishedAt` (epoch milliseconds) belongs
 * on the site. An unknown date (0) is treated as old, so it stays off-site.
 */
export function isInPublicArchive(publishedAt: number): boolean {
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

/** Short label for captions, e.g. "Jan 1, 2026", formatted in UTC like the cards. */
export function formatArchiveCutoff(): string {
  return new Date(PUBLIC_ARCHIVE_FROM_MS).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function resolveCutoff(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`))) {
    return trimmed;
  }
  if (trimmed) {
    console.warn(
      `Ignoring NEWSLETTER_PUBLIC_FROM="${trimmed}" (expected YYYY-MM-DD); using ${DEFAULT_PUBLIC_ARCHIVE_FROM}.`
    );
  }
  return DEFAULT_PUBLIC_ARCHIVE_FROM;
}
