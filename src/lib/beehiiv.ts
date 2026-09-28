/**
 * The newsletter's RSS feed, read once per build.
 *
 * This is the only module that talks to the feed. `issues.ts` (the dispatch
 * list) and `articles.ts` (the on-site issue pages) both build on it, so the
 * feed is fetched a single time and parsed a single time no matter how many
 * pages ask.
 *
 * Two things about the feed shape matter:
 * - `content:encoded` carries the full post HTML for issues the publication
 *   marks public, so those issues can be rendered on the site itself instead
 *   of sending readers off to the newsletter platform's domain.
 * - Issues marked premium arrive as a paywall placeholder rather than the
 *   post. Those are flagged `isPaywalled` and keep linking off-site until the
 *   owner either makes them public on the platform or migrates them through
 *   the admin command center (/admin#newsletter).
 */
import sanitizeHtml from 'sanitize-html';
import { ARTICLE_ATTRIBUTES, ARTICLE_SCHEMES, ARTICLE_TAGS, dropEmptyFrames, EMBED_HOSTS } from './sanitize';

export const BEEHIIV_RSS_URL = 'https://rss.beehiiv.com/feeds/utXCBZV29P.xml';

export interface FeedItem {
  /** The `/p/<slug>` segment of the post URL, used as the on-site slug too. */
  slug: string;
  title: string;
  /** Platform-hosted URL of the post. */
  link: string;
  /** The feed's one-line subtitle, or ''. */
  description: string;
  /** Epoch milliseconds; 0 when the feed date could not be parsed. */
  publishedAt: number;
  /** Feed categories, in feed order. Often empty. */
  categories: string[];
  /** Cover image from the feed's enclosure, or ''. */
  coverImage: string;
  /** Raw `content:encoded` HTML. Run it through `sanitizeFeedHtml` before printing. */
  contentHtml: string;
  /** True when the feed carries only the premium placeholder, not the issue. */
  isPaywalled: boolean;
}

/**
 * Issues that were rebuilt by hand in `public.articles` under a slug that does
 * not match the feed's `/p/` slug. Feed slug on the left, article slug on the
 * right. Issues whose article slug equals the feed slug need no entry here.
 */
export const MIGRATED_ISSUES: Record<string, string> = {
  'summermaxing-the-last-weekend-of-august': 'summermaxing-august',
  'what-i-d-cross-chicago-for-this-week-black-august-tarab-fufu': 'black-august-tarab-fufu',
  'geopolitical-f-tbol-the-brown-line-guide-to-the-world-cup-in-chicago': 'whose-world-cup',
  'back-in-service-for-good': 'back-in-service-for-good',
};

let feedCache: Promise<FeedItem[]> | undefined;

/** Every item in the feed, newest first. Empty (never throws) when the fetch fails. */
export function getFeedItems(): Promise<FeedItem[]> {
  if (!feedCache) {
    feedCache = loadFeed();
  }

  return feedCache;
}

async function loadFeed(): Promise<FeedItem[]> {
  try {
    const response = await fetch(BEEHIIV_RSS_URL);
    if (!response.ok) {
      throw new Error(`Newsletter RSS request failed with ${response.status}`);
    }

    return parseFeed(await response.text());
  } catch (error) {
    console.error('Error fetching or parsing the newsletter RSS feed:', error);
    return [];
  }
}

export function parseFeed(xmlText: string): FeedItem[] {
  const items = Array.from(xmlText.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi));

  return items
    .map((match, feedIndex) => {
      const itemXml = match[1];
      const title = decodeXmlText(getFirstXmlValue(itemXml, 'title'));
      const link = decodeXmlText(getFirstXmlValue(itemXml, 'link'));
      const slug = slugFromLink(link);
      const publishedAt = Date.parse(decodeXmlText(getFirstXmlValue(itemXml, 'pubDate')));
      const contentHtml = getFirstXmlValue(itemXml, 'content:encoded', { decode: false });

      if (!title || !link || !slug) return null;

      return {
        slug,
        title,
        link,
        description: decodeXmlText(getFirstXmlValue(itemXml, 'description')),
        publishedAt: Number.isNaN(publishedAt) ? 0 : publishedAt,
        categories: getAllXmlValues(itemXml, 'category').map(decodeXmlText).filter(Boolean),
        coverImage: safeUrl(itemXml.match(/<enclosure\b[^>]*\burl="([^"]+)"/i)?.[1] ?? ''),
        contentHtml,
        // The premium placeholder is a wrapper whose class list contains the
        // exact token "paywall" (not "paywall-teaser" or the like).
        isPaywalled: /\bclass=['"](?:[^'"]*\s)?paywall(?:\s[^'"]*)?['"]/.test(contentHtml),
        feedIndex,
      };
    })
    .filter((item): item is FeedItem & { feedIndex: number } => item !== null)
    .sort((a, b) => b.publishedAt - a.publishedAt || a.feedIndex - b.feedIndex)
    .map(({ feedIndex: _feedIndex, ...item }) => item);
}

/** The `/p/<slug>` segment of a post URL, or '' for any other link. */
export function slugFromLink(link: string): string {
  return link.match(/\/p\/([^/?#]+)/)?.[1] ?? '';
}

/** Only real web links are worth keeping. */
function safeUrl(value: string): string {
  const trimmed = decodeXmlText(value);
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : '';
}

// ---------------------------------------------------------------------------
// Content cleanup
// ---------------------------------------------------------------------------

/** The domain the platform hosts the newsletter on. Links there get rerouted. */
const PLATFORM_HOST_PATTERN = /^https?:\/\/(?:www\.)?thebrownline\.co(?=[/?#]|$)/i;

export interface SanitizeOptions {
  /** `BASE_URL`, so rerouted links keep working under a subpath build. */
  base: string;
  /** Feed slug to on-site article slug, for every issue that has a page here. */
  onSiteSlugs: Map<string, string>;
}

/**
 * Turns a feed item's HTML into body markup the article template can print.
 *
 * The platform wraps each post in its own chrome (a `<style>` block, a
 * "powered by" footer, inline text-align styles on every paragraph). All of
 * that goes: the result is plain semantic HTML that `.article-prose` styles the
 * same way it styles issues written in the admin command center (/admin#newsletter). Section breaks become
 * the site's transit divider, tracking parameters come off the links, and
 * links back to the platform's domain are rerouted to the matching page here.
 */
export function sanitizeFeedHtml(html: string, options: SanitizeOptions): string {
  const { base, onSiteSlugs } = options;

  const withoutChrome = html
    // The footer (platform credit) is the last block in every post, so cut
    // from its opening tag to the end; that survives extra attributes and
    // nested markup inside it.
    .replace(/<div\b[^>]*\bclass=['"][^'"]*\bbeehiiv__footer\b[\s\S]*$/i, '')
    // Section breaks are the platform's `content_break` rule.
    .replace(/<hr\b[^>]*\bclass=['"][^'"]*\bcontent_break\b[^>]*>/gi, '<hr class="transit-divider-slot">');

  const clean = sanitizeHtml(withoutChrome, {
    allowedTags: ARTICLE_TAGS,
    allowedAttributes: ARTICLE_ATTRIBUTES,
    allowedClasses: { hr: ['transit-divider-slot'] },
    allowedSchemes: ARTICLE_SCHEMES,
    allowProtocolRelative: false,
    allowedIframeHostnames: EMBED_HOSTS,
    exclusiveFilter: dropEmptyFrames,
    transformTags: {
      b: 'strong',
      i: 'em',
      h1: 'h2',
      h5: 'h4',
      h6: 'h4',
      a: (tagName, attribs) => {
        const href = rerouteHref(stripTracking(attribs.href ?? ''), base, onSiteSlugs);
        const external = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: {
            href,
            ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
          },
        };
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          src: attribs.src ?? '',
          alt: attribs.alt ?? '',
          ...(attribs.width ? { width: attribs.width } : {}),
          ...(attribs.height ? { height: attribs.height } : {}),
          loading: 'lazy',
          decoding: 'async',
        },
      }),
    },
  });

  return (
    clean
      // Embeds sit in the same hard-bordered frame the admin editor produces.
      .replace(/<iframe\b[^>]*>(?:<\/iframe>)?/gi, (tag) => `<div class="embed-frame">${tag}</div>`)
      // Spacer paragraphs the platform inserts between blocks.
      .replace(/<p>(?:\s|<br\s*\/?>)*<\/p>/gi, '')
      .trim()
  );
}

/** Drops `utm_*` (and similar) tracking parameters from a link. */
function stripTracking(href: string): string {
  if (!/^https?:\/\//i.test(href)) return href;
  try {
    const url = new URL(href);
    const keys = Array.from(url.searchParams.keys());
    for (const key of keys) {
      if (/^utm_|^_bhlid$|^ref$/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return href;
  }
}

/**
 * Links into the platform's own domain are pointed back at this site: a post
 * that has a page here goes to that page, and anything else (the home page,
 * subscribe and upgrade links) goes to the newsletter stop.
 */
function rerouteHref(href: string, base: string, onSiteSlugs: Map<string, string>): string {
  if (!PLATFORM_HOST_PATTERN.test(href)) return href;

  const slug = slugFromLink(href);
  const local = slug ? onSiteSlugs.get(slug) : undefined;
  const hash = href.match(/#.*$/)?.[0] ?? '';
  if (local) return `${base}newsletter/${local}${hash}`;
  if (slug) return href;

  return `${base}newsletter`;
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function getFirstXmlValue(xml: string, tagName: string, options: { decode?: boolean } = {}) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return unwrapCdata(match?.[1] ?? '', options.decode ?? true);
}

function getAllXmlValues(xml: string, tagName: string) {
  return Array.from(xml.matchAll(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi'))).map(
    (match) => unwrapCdata(match[1] ?? '', true)
  );
}

/**
 * CDATA content is literal, so it is returned as is. Anything else was XML
 * escaped once on the way in and is decoded once on the way out (when asked).
 */
function unwrapCdata(value: string, decode: boolean) {
  const trimmed = value.trim();
  const cdata = trimmed.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdata) return cdata[1].trim();
  return decode ? decodeXmlText(trimmed) : trimmed;
}

/**
 * A numeric character reference as text. Anything outside Unicode (or a lone
 * surrogate) becomes U+FFFD instead of throwing, so one bad reference in one
 * item can never blank the whole feed.
 */
function codePointText(code: number): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
    return '\uFFFD';
  }
  return String.fromCodePoint(code);
}

// Decode &amp; last so double-encoded entities (e.g. &amp;#39;) only decode one
// level per pass instead of collapsing all the way down in a single call.
export function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => codePointText(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => codePointText(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .trim();
}
