/**
 * The dispatch list: every issue of the newsletter, newest first, with the
 * link each card should carry. Issues that exist on the site (hand-migrated
 * rows or feed-rendered pages, see articles.ts) link to their page here;
 * premium issues the feed cannot render keep their off-site link.
 */
import { getFeedItems, MIGRATED_ISSUES } from './beehiiv';
import { buildArticlePath, getSortedArticles } from './articles';

export interface Issue {
  category: string;
  date: string;
  title: string;
  href: string;
  accent: 'amber' | 'cayenne';
  publishedAt?: number;
}

/** Kicker for issues that carry no category in the feed. */
const DEFAULT_CATEGORY = 'Culture';

/**
 * The issues that predate the feed's public run, all premium on the platform.
 * Only used when the feed itself cannot be fetched, so the list is never empty.
 */
const fallbackIssues: Omit<Issue, 'accent'>[] = [
  {
    category: 'Culture',
    date: 'Sep 4, 2025',
    title: '💃🏾Chicago Latinos dance in defiance of 🧊deportation',
    href: 'https://www.thebrownline.co/p/chicago-latinos-dance-in-defiance-of-deportation',
    publishedAt: Date.parse('2025-09-04T12:00:00-05:00'),
  },
  {
    category: 'Global South',
    date: 'Aug 25, 2025',
    title: '🌆 Last stops, late summer vibes, & all that jazz before Labor Day',
    href: 'https://www.thebrownline.co/p/last-stops-late-summer-vibes-all-that-jazz-before-labor-day',
    publishedAt: Date.parse('2025-08-25T12:00:00-05:00'),
  },
  {
    category: 'Culture',
    date: 'Aug 19, 2025',
    title: 'This train runs on solidarity 🚉🤎✊🏾',
    href: 'https://www.thebrownline.co/p/this-train-runs-on-solidarity',
    publishedAt: Date.parse('2025-08-19T12:00:00-05:00'),
  },
  {
    category: 'Culture',
    date: 'Aug 10, 2025',
    title: 'Issue #2: Back in service! 🚆',
    href: 'https://www.thebrownline.co/p/issue-2-back-in-service-527769c8d207ab1d',
    publishedAt: Date.parse('2025-08-10T12:00:00-05:00'),
  },
  {
    category: 'Global South',
    date: 'Jul 29, 2025',
    title: 'Welcome aboard The Brown Line 🚉',
    href: 'https://www.thebrownline.co/p/welcome-aboard-the-brown-line-35bfa6886556f128',
    publishedAt: Date.parse('2025-07-29T12:00:00-05:00'),
  },
];

let issueCache: Promise<Issue[]> | undefined;

export function getRecentIssues(): Promise<Issue[]> {
  if (!issueCache) {
    issueCache = buildIssues();
  }

  return issueCache;
}

async function buildIssues(): Promise<Issue[]> {
  const base = import.meta.env.BASE_URL;
  const [items, articles] = await Promise.all([getFeedItems(), getSortedArticles()]);

  const articleBySlug = new Map(articles.map((article) => [article.slug, article]));
  const covered = new Set<string>();
  const issues: Omit<Issue, 'accent'>[] = [];

  for (const item of items) {
    const article = articleBySlug.get(MIGRATED_ISSUES[item.slug] ?? item.slug);
    if (article) covered.add(article.slug);

    issues.push({
      category: article?.category ?? item.categories[0] ?? DEFAULT_CATEGORY,
      date: formatIssueDate(item.publishedAt),
      title: item.title,
      href: article ? buildArticlePath(article.slug, base) : item.link,
      publishedAt: item.publishedAt,
    });
  }

  // Issues published on the site without a feed counterpart still belong in
  // the list.
  for (const article of articles) {
    if (covered.has(article.slug)) continue;
    const publishedAt = Date.parse(article.pubDate);
    issues.push({
      category: article.category,
      date: formatIssueDate(publishedAt),
      title: article.title,
      href: buildArticlePath(article.slug, base),
      publishedAt: Number.isNaN(publishedAt) ? 0 : publishedAt,
    });
  }

  if (items.length === 0) {
    console.warn('Newsletter feed unavailable; listing the bundled issues alongside on-site articles.');
    issues.push(...fallbackIssues);
  }

  return issues
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .map((issue, index) => ({
      ...issue,
      accent: index % 2 === 0 ? 'cayenne' : 'amber',
    }));
}

function formatIssueDate(publishedAt: number) {
  if (!publishedAt) return '';

  return new Date(publishedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
