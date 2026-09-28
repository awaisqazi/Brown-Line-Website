// Client-safe helpers shared by the admin command center panels
// (src/components/admin/*). No Supabase import here: anything that needs the
// session (client, password) takes it as an argument or lives in
// admin-session.ts. Lifted verbatim from the former /admin/events and
// /admin/articles page scripts; keep behavior identical when editing.

export type AdminEventRecord = {
  event_date: string;
  title: string;
  venue: string;
  start_time: string | null;
  end_time: string | null;
  neighborhood: string | null;
  description: string | null;
  organizer: string | null;
  cost_info: string | null;
  event_url: string | null;
  image_url: string | null;
  author_note: string | null;
  emoji: string | null;
  tags: string[] | null;
  is_curated: boolean;
  is_giveaway: boolean;
};

// The fixed diaspora category taxonomy. Events carry only these tags. Used for
// the admin checkbox groups (markup) and for validation (scripts). Keep in sync
// with DIASPORA_TAGS in src/lib/locations.ts (values) and the public submit form.
export const ALLOWED_TAGS = [
  'South Asian',
  'SWANA',
  'East Asian',
  'Southeast Asian',
  'Black Diaspora',
  'Latine',
  'Afro-Latine',
  'Indigenous',
  'Cross-cultural',
];

export function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function nullableText(value: unknown) {
  const clean = cleanText(value);
  return clean.length > 0 ? clean : null;
}

export function requiredText(value: unknown, fieldName: string) {
  const clean = cleanText(value);
  if (!clean) throw new Error(`${fieldName} is required.`);
  return clean;
}

export function requiredDate(value: unknown) {
  const clean = requiredText(value, 'event_date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    throw new Error('event_date must use YYYY-MM-DD format.');
  }
  return clean;
}

export function normalizeUrl(value: unknown, fieldName = 'event_url') {
  const clean = nullableText(value);
  if (!clean) return null;
  if (!/^https?:\/\//i.test(clean)) {
    throw new Error(`${fieldName} must start with http:// or https://.`);
  }
  return clean;
}

// Shared by start_time and end_time. An end time is never compared against
// its start time: events that run past midnight legitimately end earlier in
// clock terms than they begin.
export function normalizeTimeOfDay(value: unknown, fieldName: string) {
  const clean = nullableText(value);
  if (!clean) return null;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(clean)) {
    throw new Error(`${fieldName} must use 24-hour HH:MM format.`);
  }
  return clean.slice(0, 5);
}

export function requiredTimeOfDay(value: unknown, fieldName: string) {
  const clean = normalizeTimeOfDay(value, fieldName);
  if (!clean) throw new Error(`${fieldName} is required.`);
  return clean;
}

export function requiredUrl(value: unknown, fieldName: string) {
  const clean = normalizeUrl(value, fieldName);
  if (!clean) throw new Error(`${fieldName} is required.`);
  return clean;
}

// Every event ships with a description, and the uniform preview cards on
// the public board depend on descriptions staying short. 150 words, stated
// on every description field and enforced on every write path.
export const DESCRIPTION_WORD_LIMIT = 150;

export function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function requiredDescription(value: unknown) {
  const clean = requiredText(value, 'description');
  const words = countWords(clean);
  if (words > DESCRIPTION_WORD_LIMIT) {
    throw new Error(
      `description is ${words} words; the limit is ${DESCRIPTION_WORD_LIMIT}. Trim it down.`
    );
  }
  return clean;
}

/* ---------- Description word counters ---------- */
export function updateWordCounter(textarea: HTMLTextAreaElement) {
  const counter = textarea.closest('label')?.querySelector('[data-word-count]');
  if (!counter) return;
  const limit = Number(textarea.dataset.wordLimit) || DESCRIPTION_WORD_LIMIT;
  const words = countWords(textarea.value);
  counter.textContent = `${words} / ${limit} words`;
  counter.classList.toggle('text-cayenneInk', words > limit);
  counter.classList.toggle('text-darkWalnut/60', words <= limit);
}

export function updateWordCounters(scope: ParentNode) {
  scope
    .querySelectorAll('textarea[data-word-limit]')
    .forEach((el) => updateWordCounter(el as HTMLTextAreaElement));
}

// One delegated listener per panel root covers its static forms plus every
// cloned review card and row editor inside it.
export function attachWordCounters(root: HTMLElement) {
  root.addEventListener('input', (event) => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && target.dataset.wordLimit) {
      updateWordCounter(target);
    }
  });
}

// Case-insensitive match against the fixed taxonomy, normalized to the
// canonical casing. Unknown tags are an error so free-form labels can
// never leak onto the public board.
export function validateTags(tags: string[] | null) {
  if (!tags) return null;
  const normalized = tags.map((tag) => {
    const match = ALLOWED_TAGS.find((allowed) => allowed.toLowerCase() === tag.toLowerCase());
    if (!match) {
      throw new Error(`Unknown tag "${tag}". Allowed tags: ${ALLOWED_TAGS.join(', ')}.`);
    }
    return match;
  });
  return [...new Set(normalized)];
}

export function setInlineStatus(el: HTMLElement | null, message: string, isError = false) {
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('text-cayenneInk', isError);
  el.classList.toggle('text-darkWalnut', !isError);
}

// Buttons with work in flight. The disabled attribute already blocks a second
// click; this also blocks programmatic re-entry (a form submitted with Enter
// while its button is busy, a second listener on the same control).
const busyButtons = new WeakSet<HTMLButtonElement>();

// Disable a button and show progress text while `work` runs. Returns
// undefined without running `work` when the button is already busy.
export async function withBusy<T>(
  button: HTMLButtonElement | null,
  busyLabel: string,
  work: () => Promise<T>
): Promise<T | undefined> {
  if (button && busyButtons.has(button)) return undefined;
  const restore = button?.textContent ?? '';
  if (button) {
    busyButtons.add(button);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = busyLabel;
  }
  try {
    return await work();
  } finally {
    if (button) {
      busyButtons.delete(button);
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = restore;
    }
  }
}

// Browsers word a dropped connection differently ("Failed to fetch",
// "Load failed", "NetworkError when attempting to fetch resource"), and
// supabase-js passes those through as the error message. Say it plainly.
const NETWORK_ERROR_PATTERN = /failed to fetch|load failed|networkerror|network request failed|fetch failed/i;

export const NETWORK_ERROR_MESSAGE =
  'Could not reach the server. Check your internet connection and try again.';

export function errorMessage(error: unknown, fallback = 'Unknown error.') {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message) return fallback;
  if (NETWORK_ERROR_PATTERN.test(message)) return NETWORK_ERROR_MESSAGE;
  return message;
}

export function chicagoToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
}

export function addDaysToDateString(dateString: string, days: number) {
  const [y, m, d] = dateString.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

// Flyer links that enter the system get copied into our own Storage so
// they never expire (Instagram's signed image links do, within weeks). A
// copy that fails never blocks a save: the link is kept as pasted and the
// warning is shown, since the public site skips a dead link on its own.
export const STORED_IMAGE_PATH = '/storage/v1/object/public/event-images/';

// Same body as the former page-level mirrorImageUrl; the password and the
// functions URL now come from the shared session instead of page globals.
export async function mirrorImageUrl(
  url: string | null,
  adminPassword: string,
  functionsBase: string
): Promise<{ url: string | null; warning: string }> {
  if (!url || !adminPassword || !functionsBase || url.includes(STORED_IMAGE_PATH)) {
    return { url, warning: '' };
  }
  try {
    const res = await fetch(`${functionsBase}/mirror-event-image`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-password': adminPassword },
      body: JSON.stringify({ source_url: url }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || typeof body?.url !== 'string') {
      return {
        url,
        warning: `Flyer not copied: ${body?.error ?? `status ${res.status}.`} The link was saved as pasted and may stop working.`,
      };
    }
    return { url: body.url, warning: '' };
  } catch (_) {
    return { url, warning: 'Flyer not copied (network error). The link was saved as pasted and may stop working.' };
  }
}

// sessionStorage can throw (private mode, blocked site data); treat that as
// "nothing remembered".
export function readSessionFlag(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

export function writeSessionFlag(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch (_) {
    // Not remembering is fine.
  }
}
