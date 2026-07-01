export interface Issue {
  category: string;
  date: string;
  title: string;
  href: string;
  accent: 'amber' | 'cayenne';
  publishedAt?: number;
}

const BEEHIIV_RSS_URL = 'https://rss.beehiiv.com/feeds/utXCBZV29P.xml';

const fallbackIssues: Issue[] = [
  {
    category: 'Culture',
    date: 'Sep 4, 2025',
    title: '💃🏾Chicago Latinos dance in defiance of 🧊deportation',
    href: 'https://www.thebrownline.co/p/chicago-latinos-dance-in-defiance-of-deportation',
    accent: 'cayenne',
    publishedAt: Date.parse('2025-09-04T12:00:00-05:00'),
  },
  {
    category: 'Global South',
    date: 'Aug 25, 2025',
    title: '🌆 Last stops, late summer vibes, & all that jazz before Labor Day',
    href: 'https://www.thebrownline.co/p/last-stops-late-summer-vibes-all-that-jazz-before-labor-day',
    accent: 'amber',
    publishedAt: Date.parse('2025-08-25T12:00:00-05:00'),
  },
  {
    category: 'Culture',
    date: 'Aug 19, 2025',
    title: 'This train runs on solidarity 🚉🤎✊🏾',
    href: 'https://www.thebrownline.co/p/this-train-runs-on-solidarity',
    accent: 'cayenne',
    publishedAt: Date.parse('2025-08-19T12:00:00-05:00'),
  },
  {
    category: 'Culture',
    date: 'Aug 10, 2025',
    title: 'Issue #2: Back in service! 🚆',
    href: 'https://www.thebrownline.co/p/issue-2-back-in-service-527769c8d207ab1d',
    accent: 'amber',
    publishedAt: Date.parse('2025-08-10T12:00:00-05:00'),
  },
  {
    category: 'Global South',
    date: 'Jul 29, 2025',
    title: 'Welcome aboard The Brown Line 🚉',
    href: 'https://www.thebrownline.co/p/welcome-aboard-the-brown-line-35bfa6886556f128',
    accent: 'cayenne',
    publishedAt: Date.parse('2025-07-29T12:00:00-05:00'),
  },
];

let issueCache: Issue[] | undefined;

export async function getRecentIssues() {
  if (issueCache) return issueCache;

  try {
    const response = await fetch(BEEHIIV_RSS_URL);
    if (!response.ok) {
      throw new Error(`Beehiiv RSS request failed with ${response.status}`);
    }

    const issues = parseIssueRss(await response.text());
    issueCache = issues.length > 0 ? issues : fallbackIssues;
  } catch (error) {
    console.error('Error fetching or parsing Beehiiv RSS feed, falling back to static list:', error);
    issueCache = fallbackIssues;
  }

  return issueCache;
}

function parseIssueRss(xmlText: string): Issue[] {
  const items = Array.from(xmlText.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi));

  return items
    .map((match, feedIndex) => {
      const itemXml = match[1];
      const title = decodeXmlText(getFirstXmlValue(itemXml, 'title'));
      const href = normalizeIssueHref(decodeXmlText(getFirstXmlValue(itemXml, 'link')));
      const pubDateRaw = decodeXmlText(getFirstXmlValue(itemXml, 'pubDate'));
      const category = decodeXmlText(getFirstXmlValue(itemXml, 'category')) || 'Culture';
      const publishedAt = Date.parse(pubDateRaw);

      if (!title || !href) return null;

      return {
        category,
        date: formatIssueDate(pubDateRaw, publishedAt),
        title,
        href,
        publishedAt: Number.isNaN(publishedAt) ? 0 : publishedAt,
        feedIndex,
      };
    })
    .filter((issue): issue is Omit<Issue, 'accent'> & { feedIndex: number } => Boolean(issue))
    .sort((a, b) => b.publishedAt - a.publishedAt || a.feedIndex - b.feedIndex)
    .map(({ feedIndex: _feedIndex, ...issue }, index) => ({
      ...issue,
      accent: index % 2 === 0 ? 'cayenne' : 'amber',
    }));
}

// Issues live on the .co (Beehiiv) domain; normalize any .com the feed emits so
// the "Recent dispatches" links always point at the newsletter (see design.md §5).
function normalizeIssueHref(href: string) {
  return href.replace(/\/\/(?:www\.)?thebrownline\.com/i, '//www.thebrownline.co');
}

function getFirstXmlValue(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return stripCdata(match?.[1] ?? '');
}

function stripCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function decodeXmlText(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .trim();
}

function formatIssueDate(rawDate: string, publishedAt: number) {
  if (!rawDate || Number.isNaN(publishedAt)) return rawDate;

  return new Date(publishedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
