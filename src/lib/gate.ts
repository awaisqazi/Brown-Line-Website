/**
 * The subscribe-to-unlock preview on newsletter issue pages. The site is
 * static with no accounts, so this is a soft gate: the whole issue ships in
 * the HTML (search engines read all of it), and the page script in
 * NewsletterArticle.astro reveals the rest for anyone who subscribes or
 * arrives from a newsletter email. See design.md § 5 Newsletter issue gate.
 */

/** Read about this many words before the gate. */
export const PREVIEW_WORDS = 220;
/**
 * The shortest preview worth showing. A long list right after the opening can
 * push the first paragraph past the target by hundreds of words; an earlier
 * paragraph boundary at least this deep wins in that case.
 */
const MIN_PREVIEW_WORDS = 150;
/** Issues shorter than this are shown whole. */
export const MIN_GATED_WORDS = 320;
/** Never gate a remainder this short; a few lines behind a wall reads as a trick. */
const MIN_REMAINDER_WORDS = 80;

/** The class on the hidden remainder. The Article JSON-LD points at it. */
export const GATED_CLASS = 'article-gated';

export interface SplitBody {
  /** Everything up to and including the cut paragraph. */
  preview: string;
  /** The rest of the issue, or '' when the issue is not gated. */
  remainder: string;
  gated: boolean;
}

/**
 * Build-time switch. PUBLIC_NEWSLETTER_GATE=off (or false / 0) turns the gate
 * off on every issue; anything else, including unset, leaves it on.
 */
export function isGateEnabled(): boolean {
  const value = (import.meta.env.PUBLIC_NEWSLETTER_GATE ?? '').trim().toLowerCase();
  return !['off', 'false', '0'].includes(value);
}

// Elements that never take a closing tag. The bodies are sanitize-html output,
// so everything else is balanced.
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
]);
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;

interface Block {
  html: string;
  /** Lowercase tag name of the top-level element. */
  tag: string;
  words: number;
}

/**
 * Splits rendered body HTML into a preview and a gated remainder. The cut only
 * falls between top-level blocks, right after a top-level paragraph, so it
 * never lands inside a list, figure, blockquote, table, or embed. Of those
 * paragraph boundaries at least MIN_PREVIEW_WORDS deep, the one closest to
 * PREVIEW_WORDS wins (the later one on a tie). Short issues, and issues with
 * no such boundary, come back whole.
 */
export function splitArticleBody(html: string): SplitBody {
  const whole: SplitBody = { preview: html, remainder: '', gated: false };
  if (!isGateEnabled()) return whole;

  const blocks = topLevelBlocks(html);
  const total = blocks.reduce((sum, block) => sum + block.words, 0);
  if (total < MIN_GATED_WORDS) return whole;

  let cut = -1;
  let cutDistance = Infinity;
  let running = 0;
  for (let i = 0; i < blocks.length - 1; i++) {
    running += blocks[i].words;
    if (blocks[i].tag !== 'p' || running < MIN_PREVIEW_WORDS) continue;
    if (total - running < MIN_REMAINDER_WORDS) break;

    const distance = Math.abs(running - PREVIEW_WORDS);
    if (distance <= cutDistance) {
      cut = i;
      cutDistance = distance;
    }
    if (running >= PREVIEW_WORDS) break;
  }
  if (cut === -1) return whole;

  return {
    preview: blocks.slice(0, cut + 1).map((block) => block.html).join('').trim(),
    remainder: blocks.slice(cut + 1).map((block) => block.html).join('').trim(),
    gated: true,
  };
}

/** Top-level elements in order, each with any loose text that precedes it. */
function topLevelBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  let depth = 0;
  let start = 0;
  let tag = '';
  TAG.lastIndex = 0;

  for (let match = TAG.exec(html); match; match = TAG.exec(html)) {
    const [, closing, rawName, selfClosing] = match;
    const name = rawName.toLowerCase();
    const end = match.index + match[0].length;

    if (closing) {
      depth = Math.max(0, depth - 1);
    } else {
      if (depth === 0) tag = name;
      if (!VOID_TAGS.has(name) && !selfClosing) depth += 1;
    }

    if (depth === 0) {
      const chunk = html.slice(start, end);
      blocks.push({ html: chunk, tag, words: countWords(chunk) });
      start = end;
    }
  }

  const tail = html.slice(start);
  if (tail.trim()) blocks.push({ html: tail, tag: '#text', words: countWords(tail) });
  return blocks;
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ');
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
