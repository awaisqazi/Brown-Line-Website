/**
 * The one place that decides where newsletter issues come from at build time.
 *
 * Preferred: the Beehiiv API (beehiiv-api.ts), when the build has a key and
 * publication id. Fallback: the RSS feed (beehiiv.ts), which is also what a
 * local build with no key reads, exactly as before the API path existed.
 * Both sources yield the same `FeedItem` shape, so articles.ts, issues.ts,
 * and the /p/<slug> stubs never know which one answered.
 */
import { getApiPosts } from './beehiiv-api';
import { getFeedItems, type FeedItem } from './beehiiv';

export type NewsletterSource = 'api' | 'rss';

let itemsCache: Promise<{ source: NewsletterSource; items: FeedItem[] }> | undefined;

/** Every issue the platform lists, newest first. Empty (never throws) when both sources fail. */
export async function getNewsletterItems(): Promise<FeedItem[]> {
  return (await load()).items;
}

/** Which source answered this build, for logs and the build summary. */
export async function getNewsletterSource(): Promise<NewsletterSource> {
  return (await load()).source;
}

function load() {
  if (!itemsCache) {
    itemsCache = (async () => {
      const fromApi = await getApiPosts();
      if (fromApi) return { source: 'api' as const, items: fromApi };
      return { source: 'rss' as const, items: await getFeedItems() };
    })();
  }

  return itemsCache;
}
