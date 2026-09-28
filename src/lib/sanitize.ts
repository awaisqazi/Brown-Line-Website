/**
 * HTML allow-lists shared by everything that prints stored markup with
 * `set:html`. Two sources reach the page that way: newsletter issues rendered
 * from the feed (see beehiiv.ts, which adds its own platform-specific cleanup
 * on top of this) and issues written in /admin/articles. The admin editor
 * scrubs pastes as they land, but the build is the last line, so both go
 * through the same allow-list here before a visitor sees them.
 */
import sanitizeHtml from 'sanitize-html';

/** Embed hosts the article prose is allowed to frame. */
export const EMBED_HOSTS = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'open.spotify.com',
  'embed.music.apple.com',
  'w.soundcloud.com',
  'bandcamp.com',
  'www.instagram.com',
];

/** Body tags the article typography knows how to style. */
export const ARTICLE_TAGS = [
  'p', 'a', 'strong', 'em', 'u', 's', 'br', 'hr',
  'h2', 'h3', 'h4',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'sup', 'sub',
  'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'iframe',
];

export const ARTICLE_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
  iframe: ['src', 'title', 'allow', 'allowfullscreen', 'height', 'width'],
  hr: ['class'],
  h2: ['id'],
  h3: ['id'],
  h4: ['id'],
};

export const ARTICLE_SCHEMES = ['http', 'https', 'mailto'];

/** An iframe whose src was rejected (off-list host) is an empty shell; drop it. */
export const dropEmptyFrames: sanitizeHtml.IOptions['exclusiveFilter'] = (frame) =>
  frame.tag === 'iframe' && !frame.attribs.src;

/**
 * Cleans an issue written in the admin editor. Keeps exactly what the editor
 * produces (the tags above, the `transit-divider-slot` rule, and the
 * `embed-frame` wrapper around an allow-listed iframe) and drops anything
 * else: event handlers, scripts, styles, unknown embeds, odd URL schemes.
 * Links out get the usual new-tab attributes.
 */
export function sanitizeAuthoredHtml(html: string): string {
  if (!html) return '';

  return sanitizeHtml(html, {
    allowedTags: [...ARTICLE_TAGS, 'div'],
    allowedAttributes: { ...ARTICLE_ATTRIBUTES, div: ['class'] },
    allowedClasses: { div: ['embed-frame'], hr: ['transit-divider-slot'] },
    allowedSchemes: ARTICLE_SCHEMES,
    allowProtocolRelative: false,
    allowedIframeHostnames: EMBED_HOSTS,
    exclusiveFilter: dropEmptyFrames,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? '';
        const external = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: {
            ...(href ? { href } : {}),
            ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
          },
        };
      },
    },
  });
}
