/**
 * Which stored image links are worth rendering, and which are worth telling
 * search engines and share cards about.
 *
 * Event flyers arrive as pasted links. Two kinds cause trouble: a link to an
 * Instagram *post page* (HTML, which an <img> can never show) and a link into
 * Instagram's or Facebook's image CDN, which is signed and expires within
 * weeks. The first is refused everywhere; the second still renders while it
 * lasts (the card keeps a fallback panel underneath) but is never advertised
 * as the page's image, so structured data and share previews do not point at
 * a URL that will be dead by the time a crawler or a friend opens it.
 */

/** Image hosts whose links are signed and stop resolving after a few weeks. */
const EPHEMERAL_IMAGE_HOSTS = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

/** A social post page, not an image file. */
const SOCIAL_POST_PATH = /^\/(?:[^/]+\/)?(?:p|reel|reels|tv)\//i;

/** Only real web links, with nothing that could smuggle in markup or a line break. */
function safeHttpUrl(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  // eslint-disable-next-line no-control-regex
  return /^https?:\/\/\S+$/i.test(trimmed) && !/[\x00-\x1f\x7f]/.test(trimmed) ? trimmed : '';
}

/**
 * Instagram and Facebook sign their CDN links with an `oe=` parameter: the
 * expiry as a hex Unix timestamp. Once that moment has passed the link is a
 * guaranteed 403, so there is no point printing an <img> for it. Read at build
 * time; the site rebuilds every four hours, so this is accurate to within that.
 */
function signedLinkHasExpired(parsed: URL): boolean {
  if (!EPHEMERAL_IMAGE_HOSTS.test(parsed.hostname)) return false;
  const stamp = parsed.searchParams.get('oe');
  if (!stamp || !/^[0-9a-f]{6,10}$/i.test(stamp)) return false;
  return Number.parseInt(stamp, 16) * 1000 < Date.now();
}

/**
 * The URL an <img> can render, or '' when the link is not an image at all or
 * is a signed link that has already expired.
 */
export function displayImageUrl(value: string | null | undefined): string {
  const url = safeHttpUrl(value);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (/(^|\.)instagram\.com$/i.test(parsed.hostname) && SOCIAL_POST_PATH.test(parsed.pathname)) return '';
    if (signedLinkHasExpired(parsed)) return '';
  } catch {
    return '';
  }
  return url;
}

/**
 * The URL worth putting in share cards and structured data: renderable now
 * and not from a host whose links expire.
 */
export function durableImageUrl(value: string | null | undefined): string {
  const url = displayImageUrl(value);
  if (!url) return '';
  try {
    return EPHEMERAL_IMAGE_HOSTS.test(new URL(url).hostname) ? '' : url;
  } catch {
    return '';
  }
}
