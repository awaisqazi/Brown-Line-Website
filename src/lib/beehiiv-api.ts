/**
 * The newsletter's posts, read from the Beehiiv v2 API once per build.
 *
 * This is the preferred source for the dispatch list and the on-site issue
 * pages (see newsletter.ts); the RSS feed in beehiiv.ts is the fallback. The
 * API is used only when both BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID are
 * set in the build environment (GitHub Actions passes them through from a
 * repository secret and variable). Without them, or when any request fails,
 * `getApiPosts` resolves to undefined and the caller reads the feed instead,
 * so a local build with no key behaves exactly as before.
 *
 * Why bother with the API when the feed works: it carries the fields the feed
 * drops (audience, platform, subtitle, tags, hidden-from-feed), the post list
 * is complete rather than capped, and it answers at once after a send, where
 * the feed can lag.
 *
 * Posts are mapped onto the feed's `FeedItem` shape so the sanitizer and the
 * transit-divider marker logic in beehiiv.ts apply unchanged. The body asked
 * for is the RSS rendering (`free_rss_content`), which is the HTML the
 * sanitizer was written against; the web rendering is the fallback.
 */
import type { FeedItem } from './beehiiv';

/** Overridable only so a build can be pointed at a local stand-in for testing. */
const API_ORIGIN = (import.meta.env.BEEHIIV_API_ORIGIN ?? '').trim() || 'https://api.beehiiv.com';
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const REQUEST_TIMEOUT_MS = 20_000;

interface ApiPost {
  id: string;
  title: string;
  subtitle?: string;
  preview_text?: string;
  status: 'draft' | 'confirmed' | 'archived';
  publish_date?: number | null;
  displayed_date?: number | null;
  slug: string;
  thumbnail_url?: string;
  web_url?: string;
  audience: 'free' | 'premium' | 'both';
  platform: 'web' | 'email' | 'both';
  content_tags?: string[];
  meta_default_description?: string;
  hidden_from_feed?: boolean;
  content?: {
    free?: { web?: string; email?: string; rss?: string };
    premium?: { web?: string; email?: string };
  };
}

interface ApiPage {
  data: ApiPost[];
  page: number;
  total_pages: number;
  total_results: number;
}

/** Build-time credentials, read once. Both must be present for the API path. */
function credentials(): { key: string; publicationId: string } | undefined {
  const key = (import.meta.env.BEEHIIV_API_KEY ?? '').trim();
  const publicationId = (import.meta.env.BEEHIIV_PUBLICATION_ID ?? '').trim();
  if (!key || !publicationId) return undefined;
  return { key, publicationId };
}

/** True when the build has what it needs to read the API. */
export function hasApiCredentials(): boolean {
  return credentials() !== undefined;
}

let postsCache: Promise<FeedItem[] | undefined> | undefined;

/**
 * Every published post the site should know about, newest first, or undefined
 * when the API is not configured or could not be read. Never throws.
 */
export function getApiPosts(): Promise<FeedItem[] | undefined> {
  if (!postsCache) {
    postsCache = loadPosts();
  }

  return postsCache;
}

async function loadPosts(): Promise<FeedItem[] | undefined> {
  const creds = credentials();
  if (!creds) return undefined;

  try {
    const posts: ApiPost[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await fetchPage(creds, page);
      posts.push(...result.data);
      if (page >= result.total_pages || result.data.length === 0) break;
    }

    const items = posts.map(toFeedItem).filter((item): item is FeedItem => item !== null);
    items.sort((a, b) => b.publishedAt - a.publishedAt);
    console.log(`Newsletter: read ${items.length} published posts from the Beehiiv API.`);
    return items;
  } catch (error) {
    console.error('Error reading posts from the Beehiiv API; falling back to the RSS feed:', error);
    return undefined;
  }
}

async function fetchPage(
  creds: { key: string; publicationId: string },
  page: number
): Promise<ApiPage> {
  const url = new URL(`/v2/publications/${encodeURIComponent(creds.publicationId)}/posts`, API_ORIGIN);
  url.searchParams.set('status', 'confirmed');
  url.searchParams.set('order_by', 'publish_date');
  url.searchParams.set('direction', 'desc');
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('page', String(page));
  // Generating HTML is the slow part of this endpoint, so ask only for the
  // two renderings the site can use.
  url.searchParams.append('expand[]', 'free_rss_content');
  url.searchParams.append('expand[]', 'free_web_content');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${creds.key}`,
      Accept: 'application/json',
      'User-Agent': 'thebrownlinechi.com build',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    // The body names the reason (expired key, wrong publication) without
    // echoing the key, so it is safe to log a slice of it.
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new Error(`Beehiiv API responded ${response.status} for page ${page}: ${detail}`);
  }

  const body = (await response.json()) as Partial<ApiPage>;
  if (!Array.isArray(body.data)) {
    throw new Error('Beehiiv API response had no data array.');
  }

  return {
    data: body.data,
    page: body.page ?? page,
    total_pages: body.total_pages ?? page,
    total_results: body.total_results ?? body.data.length,
  };
}

/**
 * One API post as a feed item, or null when the post should not be listed:
 * not sent yet (a scheduled issue is "confirmed" before it goes out), email
 * only (no web page to link), hidden from the feed on purpose, or missing a
 * slug or title.
 */
function toFeedItem(post: ApiPost): FeedItem | null {
  if (post.status !== 'confirmed') return null;
  if (post.platform === 'email') return null;
  if (post.hidden_from_feed) return null;

  const publishedAt = epochToMs(post.publish_date) || epochToMs(post.displayed_date);
  if (!publishedAt || publishedAt > Date.now()) return null;

  const slug = (post.slug ?? '').trim();
  const title = (post.title ?? '').trim();
  const link = safeUrl(post.web_url ?? '');
  if (!slug || !title || !link) return null;

  const contentHtml = post.audience === 'premium' ? '' : (post.content?.free?.rss || post.content?.free?.web || '');
  // The RSS rendering of a premium post is the same placeholder the feed
  // carries, so the feed's class check still applies on top of the audience.
  const isPaywalled =
    post.audience === 'premium' ||
    /\bclass=['"](?:[^'"]*\s)?paywall(?:\s[^'"]*)?['"]/.test(contentHtml);

  return {
    slug,
    title,
    link,
    description: (post.subtitle || post.preview_text || post.meta_default_description || '').trim(),
    publishedAt,
    categories: (post.content_tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    coverImage: safeUrl(post.thumbnail_url ?? ''),
    contentHtml: isPaywalled ? '' : contentHtml,
    isPaywalled,
  };
}

function epochToMs(seconds: number | null | undefined): number {
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

/** Only real web links are worth keeping (same rule as the feed parser). */
function safeUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : '';
}
