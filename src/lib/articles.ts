/**
 * The newsletter issues that live on the site itself. Two sources feed it:
 *
 * 1. Rows in public.articles, written from /admin/articles and read here at
 *    build time. These are the hand-migrated issues with their own hero art,
 *    tags, and summary.
 * 2. The newsletter's RSS feed (see beehiiv.ts). Every public issue in the feed
 *    that has no row of its own is rendered on site from the feed's HTML, so a
 *    new issue lands at /newsletter/<slug> on the next build with no repo or
 *    admin work. Premium (paywalled) issues cannot be rendered from the feed
 *    and stay off-site until the owner migrates them.
 *
 * src/pages/newsletter/[slug].astro turns each article into a page. Everything
 * is loaded once per build and cached, the same way ticker.ts caches its query,
 * because several pages ask for the same list.
 */
import { FALLBACK_ARTICLES } from './articles-fallback';
import { getFeedItems, MIGRATED_ISSUES, sanitizeFeedHtml } from './beehiiv';
import { sanitizeAuthoredHtml } from './sanitize';

export interface Article {
  /** URL segment under /newsletter/. */
  slug: string;
  title: string;
  /** Kicker above the headline, same vocabulary as the homepage issue cards. */
  category: string;
  /** ISO publish date. Formatted in UTC so the printed day matches the feed's. */
  pubDate: string;
  /**
   * Either a path under public/ without a leading slash (e.g.
   * "images/newsletter/<slug>/hero.png"), an absolute http(s) URL, or '' when
   * the issue has no hero art (feed-sourced issues usually do not). Callers
   * prefix the relative form with BASE_URL and skip the frame when empty.
   */
  heroImage: string;
  heroAlt: string;
  /** Optional art credit rendered under the hero frame; may contain a link. */
  heroCreditHtml?: string;
  /** Meta description for the share card and search results. */
  description: string;
  /**
   * Topical tags. Keep them reusable across issues so the similar-articles rail
   * has something to match on. Diaspora tags reuse the events taxonomy
   * (South Asian, SWANA, East Asian, Southeast Asian, Black Diaspora, Latine,
   * Afro-Latine, Indigenous, Cross-cultural).
   */
  tags: string[];
  /** One or two sentences in the newsletter's voice, shown on similar cards. */
  summary: string;
  /**
   * Body markup. <hr class="transit-divider-slot" /> marks each place the
   * site's TransitDivider belongs; run it through renderArticleBody before
   * printing it with set:html.
   */
  bodyHtml: string;
  /** Where the body came from: an admin-written row, or the newsletter feed. */
  source: 'site' | 'feed';
}

interface ArticleRow {
  slug: string;
  title: string;
  category: string;
  tags: string[] | null;
  summary: string | null;
  description: string | null;
  body_html: string | null;
  hero_image_url: string | null;
  hero_alt: string | null;
  hero_credit_html: string | null;
  published_at: string;
}

const ARTICLE_COLUMNS =
  'slug,title,category,tags,summary,description,body_html,hero_image_url,hero_alt,hero_credit_html,published_at';

/** Kicker for feed-sourced issues that carry no category of their own. */
const DEFAULT_CATEGORY = 'Culture';

/** Marker stored in body_html wherever the site's TransitDivider belongs. */
const DIVIDER_MARKER = /<hr\s+class="transit-divider-slot"\s*\/?>/g;
const DIVIDER_MARKUP =
  '<div class="transit-divider my-12" role="presentation" aria-hidden="true"></div>';

let articlesCache: Promise<Article[]> | undefined;

/** All on-site articles, newest first. */
export function getSortedArticles(): Promise<Article[]> {
  if (!articlesCache) {
    articlesCache = loadArticles();
  }

  return articlesCache;
}

export async function getArticle(slug: string): Promise<Article | undefined> {
  const articles = await getSortedArticles();
  return articles.find((article) => article.slug === slug);
}

/**
 * Neighbors along the line: `prev` is the older issue, `next` is the newer one.
 * Either side is undefined at the ends of the run so the rail can hide it.
 */
export async function getPrevNext(slug: string): Promise<{ prev?: Article; next?: Article }> {
  const articles = await getSortedArticles();
  const index = articles.findIndex((article) => article.slug === slug);
  if (index === -1) return {};

  return {
    prev: articles[index + 1],
    next: articles[index - 1],
  };
}

/**
 * Other articles ranked by how many tags they share with this one, then by
 * recency. Articles with no shared tags still show up (there are few issues on
 * site so far, and an empty rail is worse than a loose match).
 */
export async function getSimilar(slug: string, limit = 3): Promise<Article[]> {
  const articles = await getSortedArticles();
  const current = articles.find((article) => article.slug === slug);
  if (!current) return [];

  const currentTags = new Set(current.tags);

  return articles
    .filter((article) => article.slug !== slug)
    .map((article) => ({
      article,
      shared: article.tags.filter((tag) => currentTags.has(tag)).length,
    }))
    .sort(
      (a, b) =>
        b.shared - a.shared ||
        Date.parse(b.article.pubDate) - Date.parse(a.article.pubDate)
    )
    .slice(0, limit)
    .map((entry) => entry.article);
}

/**
 * Short date label matching the homepage dispatch cards, e.g. "Jun 9, 2026".
 * Formatted in UTC so the printed day never shifts with the build's time zone.
 */
export function formatArticleDate(pubDate: string): string {
  return new Date(pubDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Turns stored body HTML into what the page prints: divider markers become the
 * real TransitDivider markup, and root-relative links pick up BASE_URL so the
 * body keeps working under the GitHub Pages subpath.
 */
export function renderArticleBody(bodyHtml: string, base = '/'): string {
  const withDividers = bodyHtml.replace(DIVIDER_MARKER, DIVIDER_MARKUP);
  if (base === '/') return withDividers;

  return withDividers.replace(/(href|src)="\/(?!\/)/g, `$1="${base}`);
}

/**
 * Site-relative path for an article page, e.g. `/newsletter/<slug>`. One place
 * to build it so the index, the homepage, and the links page never disagree.
 */
export function buildArticlePath(slug: string, base: string): string {
  return `${base}newsletter/${slug}`;
}

async function loadArticles(): Promise<Article[]> {
  const siteArticles = await loadSiteArticles();
  const feedArticles = await loadFeedArticles(siteArticles);

  return sortByDateDesc([...siteArticles, ...feedArticles]);
}

async function loadSiteArticles(): Promise<Article[]> {
  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase
      .from('articles')
      .select(ARTICLE_COLUMNS)
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (error) throw error;

    const articles = ((data ?? []) as ArticleRow[]).map(fromRow);
    if (articles.length > 0) return articles;

    // An empty table means the schema is applied but not seeded yet. Falling
    // back keeps the seed issues on the site instead of 404ing them.
    console.warn('No published articles in Supabase; using the in-repo seed articles.');
  } catch (error) {
    console.error('Error fetching articles, falling back to the in-repo seed articles:', error);
  }

  return FALLBACK_ARTICLES.map((article) => ({ ...article, source: 'site' as const }));
}

/**
 * Public feed issues that have no hand-migrated row become articles of their
 * own, rendered from the feed's HTML. An issue counts as covered (and is
 * skipped here) when a site article exists under its feed slug or under the
 * slug MIGRATED_ISSUES maps it to.
 */
async function loadFeedArticles(siteArticles: Article[]): Promise<Article[]> {
  const items = await getFeedItems();
  if (items.length === 0) return [];

  const base = import.meta.env.BASE_URL;
  const siteSlugs = new Set(siteArticles.map((article) => article.slug));
  const localSlugFor = (feedSlug: string) => {
    const mapped = MIGRATED_ISSUES[feedSlug] ?? feedSlug;
    return siteSlugs.has(mapped) ? mapped : undefined;
  };

  const renderable = items.filter(
    (item) => !item.isPaywalled && item.contentHtml.trim() !== '' && !localSlugFor(item.slug)
  );

  // Every issue with a page here, so links between issues inside a body stay
  // on the site: the migrated ones plus the ones about to be rendered.
  const onSiteSlugs = new Map<string, string>();
  for (const item of items) {
    const local = localSlugFor(item.slug);
    if (local) onSiteSlugs.set(item.slug, local);
  }
  for (const item of renderable) onSiteSlugs.set(item.slug, item.slug);

  return renderable.map((item) => ({
    slug: item.slug,
    title: item.title,
    category: item.categories[0] ?? DEFAULT_CATEGORY,
    pubDate: new Date(item.publishedAt || 0).toISOString(),
    heroImage: item.coverImage,
    heroAlt: item.coverImage ? `Cover art for ${item.title}` : '',
    heroCreditHtml: '',
    description: item.description,
    tags: item.categories,
    summary: item.description,
    bodyHtml: sanitizeFeedHtml(item.contentHtml, { base, onSiteSlugs }),
    source: 'feed' as const,
  }));
}

function fromRow(row: ArticleRow): Article {
  return {
    slug: row.slug,
    title: row.title,
    category: row.category,
    pubDate: row.published_at,
    // Local hero art is stored with a leading slash; Article carries the
    // BASE_URL-relative form, so drop it for anything that is not absolute.
    heroImage: (row.hero_image_url ?? '').replace(/^\/(?!\/)/, ''),
    heroAlt: row.hero_alt ?? '',
    // Both markup fields are printed with set:html, so they pass the same
    // allow-list the feed does; the editor's paste scrub is not the last line.
    heroCreditHtml: sanitizeAuthoredHtml(row.hero_credit_html ?? ''),
    description: row.description ?? '',
    tags: row.tags ?? [],
    summary: row.summary ?? '',
    bodyHtml: sanitizeAuthoredHtml(row.body_html ?? ''),
    source: 'site',
  };
}

/** Source order is not load bearing: everything sorts newest first from here. */
function sortByDateDesc(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate));
}
