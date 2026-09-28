// Copies an event flyer into the project's own Storage bucket so the link in
// public.events never expires.
//
// Why: flyers arrive as pasted links, usually into Instagram's image CDN,
// whose URLs are signed and stop resolving after a few weeks. Fetching the
// bytes once, at the moment the link is fresh, and storing them under a
// content-addressed path gives the site a permanent URL. The same bytes
// stored twice land on the same path, so re-mirroring is free.
//
// Shared by mirror-event-image (admin portal), parse-event-image (the flyer
// scanner already holds the bytes) and submit-event (public submissions are
// mirrored as they arrive, best effort).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const IMAGE_BUCKET = "event-images";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Browsers block server-side clients without a UA; a plain one is enough. */
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; TheBrownLineFlyerMirror/1.0; +https://thebrownlinechi.com)",
  "Accept": "image/*,text/html;q=0.5,*/*;q=0.1",
};

export type MirrorResult =
  | { ok: true; url: string; alreadyStored: boolean }
  | { ok: false; error: string; status?: number };

/** Bytes from a base64 string (a data: prefix is tolerated), or null. */
export function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value.replace(/^data:[^,]*,/, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch (_) {
    return null;
  }
}

/** Public URL of an object in the bucket. */
export function publicImageUrl(path: string): string {
  return `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
}

/** True when a link already points into the bucket, so there is nothing to do. */
export function isStoredImageUrl(url: string): boolean {
  return url.startsWith(`${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${IMAGE_BUCKET}/`);
}

function safeHttpUrl(value: string): string {
  const trimmed = value.trim();
  // eslint-disable-next-line no-control-regex
  return /^https?:\/\/\S+$/i.test(trimmed) && !/[\x00-\x1f\x7f]/.test(trimmed) ? trimmed : "";
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { headers: FETCH_HEADERS, redirect: "follow", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Reads a body up to the byte cap; returns null when it would exceed it. */
async function readCapped(res: Response, cap: number): Promise<Uint8Array | null> {
  const declared = Number.parseInt(res.headers.get("content-length") ?? "0", 10);
  if (declared > cap) return null;
  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** An Instagram post page is HTML; its og:image is the flyer itself. */
function ogImageFrom(html: string): string {
  const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
    ?? html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
  return match ? match[1].replace(/&amp;/g, "&") : "";
}

/**
 * Stores image bytes and returns their permanent URL. The path is derived from
 * the bytes, so identical images share one object.
 */
export async function storeImageBytes(
  service: SupabaseClient,
  bytes: Uint8Array,
  contentType: string,
): Promise<MirrorResult> {
  const type = contentType.toLowerCase().split(";")[0].trim();
  const ext = CONTENT_TYPES[type];
  if (!ext) return { ok: false, error: "That link is not a JPEG, PNG, WebP, or GIF image.", status: 415 };
  if (bytes.byteLength === 0) return { ok: false, error: "The image was empty.", status: 422 };
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, error: "The image is larger than 5 MB.", status: 413 };
  }

  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const path = `flyers/${new Date().getUTCFullYear()}/${hash.slice(0, 24)}.${ext}`;

  const { error } = await service.storage.from(IMAGE_BUCKET).upload(path, bytes, {
    contentType: type,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    // The same bytes were stored before: the existing object is the answer.
    const message = (error as { message?: string }).message ?? "";
    if (/exists|duplicate/i.test(message)) return { ok: true, url: publicImageUrl(path), alreadyStored: true };
    console.error("storage upload failed:", message);
    return { ok: false, error: "Could not store the image. Try again.", status: 502 };
  }

  return { ok: true, url: publicImageUrl(path), alreadyStored: false };
}

/**
 * Fetches a flyer link and stores a copy. A link that is already in the
 * bucket comes back untouched. An Instagram post page is followed to its
 * og:image once. Anything that is not an image, is too large, or does not
 * resolve (an expired signed link returns 403) comes back as a clear error.
 */
export async function mirrorImageFromUrl(
  service: SupabaseClient,
  sourceUrl: string,
  timeoutMs = 10_000,
): Promise<MirrorResult> {
  const url = safeHttpUrl(sourceUrl);
  if (!url) return { ok: false, error: "The flyer link must start with http:// or https://.", status: 400 };
  if (isStoredImageUrl(url)) return { ok: true, url, alreadyStored: true };

  let res: Response;
  try {
    res = await fetchWithTimeout(url, timeoutMs);
  } catch (_) {
    return { ok: false, error: "The flyer link did not respond in time.", status: 504 };
  }

  if (!res.ok) {
    const expired = res.status === 403 && /cdninstagram\.com|fbcdn\.net/i.test(url);
    return {
      ok: false,
      error: expired
        ? "That Instagram image link has expired. Open the post, save the image, and upload it instead."
        : `The flyer link returned HTTP ${res.status}.`,
      status: 422,
    };
  }

  let contentType = (res.headers.get("content-type") ?? "").toLowerCase();

  // A post page instead of an image: follow its og:image once.
  if (contentType.startsWith("text/html")) {
    const html = await res.text();
    const og = ogImageFrom(html);
    if (!og || !safeHttpUrl(og)) {
      return { ok: false, error: "That link is a web page, not an image. Paste the image itself.", status: 415 };
    }
    try {
      res = await fetchWithTimeout(og, timeoutMs);
    } catch (_) {
      return { ok: false, error: "The flyer link did not respond in time.", status: 504 };
    }
    if (!res.ok) return { ok: false, error: `The page's image returned HTTP ${res.status}.`, status: 422 };
    contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  }

  if (!contentType.startsWith("image/")) {
    return { ok: false, error: "That link is not an image file.", status: 415 };
  }

  const bytes = await readCapped(res, MAX_IMAGE_BYTES);
  if (!bytes) return { ok: false, error: "The image is larger than 5 MB.", status: 413 };

  return storeImageBytes(service, bytes, contentType);
}
