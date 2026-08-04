// Admin-only "scan a flyer" endpoint.
//
// The admin portal posts a photo here; Gemini reads it and returns a draft
// event matching the public.events columns, which the admin reviews before
// inserting through the normal RLS-gated path. The Gemini API key never
// reaches the browser: it lives only in this function's secrets.
//
// Free-tier protection: every parse consumes one row in the shared
// private.gemini_usage ledger (capped per day across ALL admins, midnight
// America/Chicago). A scan is refunded ONLY when the request never reached
// Gemini (network failure); any HTTP response from Google keeps the charge,
// because the request may have counted against Google's own daily quota.
// Refunds credit the exact date that was charged, not "today".
//
// Secrets:
//   GEMINI_API_KEY        required
//   GEMINI_MODEL          optional, default gemini-3.5-flash
//   GEMINI_FALLBACK_MODEL optional, default gemini-3.5-flash-lite. Also
//                         covers the primary model's own Google quota being
//                         exhausted (HTTP 429), not just server overload.
//   GEMINI_DAILY_LIMIT    optional, default 20

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash";
// Google's overload errors (500/503/504) are transient and usually clear in a
// second or two, but a run of bad luck on the primary model should not fail
// the whole scan. This model only gets used after the primary has already
// been retried a few times.
const GEMINI_FALLBACK_MODEL = Deno.env.get("GEMINI_FALLBACK_MODEL") ?? "gemini-3.5-flash-lite";
const DAILY_LIMIT = Number.parseInt(Deno.env.get("GEMINI_DAILY_LIMIT") ?? "20", 10) || 20;

const DIASPORA_TAGS = [
  "South Asian",
  "SWANA",
  "East Asian",
  "Southeast Asian",
  "Black Diaspora",
  "Latine",
  "Afro-Latine",
  "Indigenous",
  "Cross-cultural",
];

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
// ~6 MB of binary once base64 is decoded. The portal downscales before upload,
// so hitting this means something bypassed the client.
const MAX_BASE64_LENGTH = 8_000_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-admin-password, authorization, apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clamp(value: unknown, max: number): string | null {
  const clean = str(value);
  return clean.length ? clean.slice(0, max) : null;
}

async function adminPasswordIsValid(password: string): Promise<boolean> {
  if (!password) return false;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { "x-admin-password": password } } },
  );
  const { data, error } = await client.rpc("events_admin_login_check");
  return !error && data === true;
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

type Quota = { used: number; remaining: number; limit: number };

function withLimit(raw: Record<string, number> | null): Quota {
  return {
    used: raw?.used ?? 0,
    remaining: raw?.remaining ?? DAILY_LIMIT,
    limit: DAILY_LIMIT,
  };
}

function chicagoToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}

function buildPrompt(): string {
  return [
    `You are transcribing a Chicago cultural event flyer for The Brown Line, a newsletter covering diaspora and immigrant community events. Today's date in Chicago is ${chicagoToday()}.`,
    "",
    "Read the attached image and extract one event. Rules:",
    "- Transcribe only what the flyer supports. Never invent details. Use null for anything the image does not show.",
    "- event_date: YYYY-MM-DD. If the flyer omits the year, choose the next occurrence of that date on or after today.",
    "- start_time: 24-hour HH:MM. Use the event start, not doors, unless only a doors time is given.",
    "- end_time: 24-hour HH:MM. Only when the flyer clearly shows an end time, like \"7-10 PM\" or \"until 10\". Null otherwise. Never guess.",
    "- venue: the place name, plus the neighborhood after a comma if the flyer names one (example: \"Sleeping Village, Avondale\").",
    "- neighborhood: the Chicago neighborhood or suburb name alone, if identifiable.",
    "- cost_info: exactly what the flyer says about price, like \"Free\" or \"$15\", including \"Free\" when it says free. Null if no price appears.",
    "- event_url: only a URL printed on the flyer, with https:// added if missing. Social handles like @name are not URLs; put those in organizer instead.",
    "- organizer: the presenting group, collective, or host if named.",
    "- description: 1 to 3 sentences summarizing the event in plain, factual language drawn from the flyer text. No hype words the flyer does not use.",
    "- emoji: one single emoji that fits the event, or null.",
    `- tags: pick from exactly these community categories: ${DIASPORA_TAGS.join(", ")}. Most events get exactly one tag, matching how the event or organizer identifies itself. Use multiple only when the event intentionally spans several of these communities. Use "Afro-Latine" only when the flyer explicitly centers that identity. Use an empty list when the event has no genuine connection to any of the nine.`,
    "- is_giveaway: true only if the flyer is about winning or giving away tickets or prizes.",
    "- scan_notes: one short sentence flagging anything you were unsure about (unreadable text, guessed year, ambiguous venue). Null if nothing was ambiguous.",
  ].join("\n");
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    event_date: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
    start_time: { type: "STRING", nullable: true, description: "24-hour HH:MM" },
    end_time: { type: "STRING", nullable: true, description: "24-hour HH:MM" },
    venue: { type: "STRING", nullable: true },
    neighborhood: { type: "STRING", nullable: true },
    organizer: { type: "STRING", nullable: true },
    cost_info: { type: "STRING", nullable: true },
    event_url: { type: "STRING", nullable: true },
    description: { type: "STRING", nullable: true },
    emoji: { type: "STRING", nullable: true },
    tags: { type: "ARRAY", items: { type: "STRING", enum: DIASPORA_TAGS } },
    is_giveaway: { type: "BOOLEAN" },
    scan_notes: { type: "STRING", nullable: true },
  },
  required: ["title", "tags", "is_giveaway"],
};

// Trust nothing from the model: re-validate every field against the same
// constraints the database and admin form enforce.
function sanitizeEvent(raw: Record<string, unknown>) {
  const event_date = str(raw.event_date);
  const start_time = str(raw.start_time);
  const end_time = str(raw.end_time);
  const event_url = str(raw.event_url);
  const tags = Array.isArray(raw.tags)
    ? [...new Set(
        raw.tags
          .map((tag) => DIASPORA_TAGS.find((allowed) => allowed.toLowerCase() === str(tag).toLowerCase()))
          .filter((tag): tag is string => Boolean(tag)),
      )]
    : [];

  return {
    title: clamp(raw.title, 300),
    event_date: /^\d{4}-\d{2}-\d{2}$/.test(event_date) ? event_date : null,
    start_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(start_time) ? start_time : null,
    end_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(end_time) ? end_time : null,
    venue: clamp(raw.venue, 300),
    neighborhood: clamp(raw.neighborhood, 120),
    organizer: clamp(raw.organizer, 300),
    cost_info: clamp(raw.cost_info, 300),
    event_url: /^https?:\/\//i.test(event_url) ? event_url.slice(0, 2000) : null,
    description: clamp(raw.description, 6000),
    emoji: clamp(raw.emoji, 16),
    tags,
    is_giveaway: raw.is_giveaway === true,
    scan_notes: clamp(raw.scan_notes, 500),
  };
}

// reached=false means the request never made it to Gemini, so the scan can be
// refunded safely. Anything with reached=true may have counted at Google.
type GeminiFailure = { ok: false; reached: boolean; status: number; message: string };
type GeminiSuccess = { ok: true; event: ReturnType<typeof sanitizeEvent>; model: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Statuses worth retrying on the SAME model: they mean Google's infrastructure
// had a moment, not that the request itself was bad. 429 is handled on its
// own below, since retrying the same model against its own quota is pointless
// but switching models is not.
const RETRYABLE_STATUSES = new Set([500, 503, 504]);

// Google answers a generic INVALID_ARGUMENT 400 when the image bytes do not
// decode cleanly (a malformed JPEG from the client downscaler, an odd color
// profile). The status alone reads like our bug, so translate it into advice
// the admin can act on.
function nonRetryableMessage(status: number): string {
  if (status === 400) {
    return "Gemini could not read this image file. Try re-taking the photo or uploading it as a plain JPEG.";
  }
  return `Gemini responded with status ${status}.`;
}

// Shown when the primary and backup model were both tried and both came back
// 429: either Google's per-minute rate limit or the daily free-tier quota is
// exhausted, and only time fixes either one. The no-backup-configured case
// gets its own wording where it is handled.
const QUOTA_EXHAUSTED_MESSAGE =
  "Gemini's primary model and backup model are both out of quota or rate limited right now. " +
  "Wait a minute if this is a per-minute limit, or until tomorrow if today's quota is used up.";

// Raw HTTP call for one model, one attempt. Kept tiny on purpose so the retry
// and fallback logic in callGemini can stay linear and easy to follow.
async function fetchGemini(model: string, apiKey: string, imageBase64: string, mimeType: string): Promise<
  { kind: "response"; res: Response } | { kind: "network-error" }
> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: buildPrompt() },
            ],
          }],
          generationConfig: {
            temperature: 0.2,
            response_mime_type: "application/json",
            response_schema: RESPONSE_SCHEMA,
          },
        }),
      },
    );
    return { kind: "response", res };
  } catch (_) {
    return { kind: "network-error" };
  }
}

// Turns a successful HTTP response into either a parsed event or a
// content-level failure (blocked, unparseable, empty). These are not
// retried: the model answered, it just did not give us something usable.
async function readGeminiResponse(res: Response, model: string): Promise<GeminiSuccess | GeminiFailure> {
  const data = await res.json().catch(() => null);

  const blockReason = data?.promptFeedback?.blockReason;
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (blockReason || (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS")) {
    console.error(`Gemini declined: model=${model} blockReason=${blockReason ?? "none"} finishReason=${finishReason ?? "none"}`);
    return {
      ok: false,
      reached: true,
      status: 200,
      message: "Gemini declined to read this image (content filter). Try a different photo of the flyer.",
    };
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .filter((part: Record<string, unknown>) => typeof part?.text === "string" && part?.thought !== true)
        .map((part: { text: string }) => part.text)
        .join("")
    : "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    console.error(`Gemini returned unparseable JSON: model=${model} text=${String(text).slice(0, 300)}`);
    return {
      ok: false,
      reached: true,
      status: 200,
      message: "Gemini returned an unreadable result. Try again or use a clearer photo.",
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.error(`Gemini returned a non-object result: model=${model} text=${String(text).slice(0, 300)}`);
    return {
      ok: false,
      reached: true,
      status: 200,
      message: "Gemini could not find an event in this image.",
    };
  }

  const event = sanitizeEvent(parsed as Record<string, unknown>);
  if (!event.title) {
    return {
      ok: false,
      reached: true,
      status: 200,
      message: "Gemini could not find an event in this image.",
    };
  }
  return { ok: true, event, model };
}

async function callGemini(imageBase64: string, mimeType: string): Promise<GeminiSuccess | GeminiFailure> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      reached: false,
      status: 0,
      message: "GEMINI_API_KEY is not configured on this function.",
    };
  }

  const usesFallback = GEMINI_FALLBACK_MODEL !== GEMINI_MODEL;
  // Primary model gets three tries with a short backoff (Google's overload
  // errors usually clear within a couple seconds). Total sleep stays around
  // 3 seconds so the admin waiting on this request is not stuck long.
  const primaryDelaysMs = [0, 1000, 2000];

  let reachedGoogle = false;
  let lastRetryableStatus = 0;
  let primaryQuotaExhausted = false;

  for (let i = 0; i < primaryDelaysMs.length; i++) {
    const delayMs = primaryDelaysMs[i];
    if (delayMs > 0) await sleep(delayMs);

    const fetched = await fetchGemini(GEMINI_MODEL, apiKey, imageBase64, mimeType);

    if (fetched.kind === "network-error") {
      console.error(`Gemini fetch failed: model=${GEMINI_MODEL} attempt=${i + 1}`);
      if (!reachedGoogle) {
        // Nothing from Google yet on this whole request, so it is safe to
        // refund the scan.
        return { ok: false, reached: false, status: 0, message: "Could not reach Gemini." };
      }
      // We already got at least one HTTP response earlier in this request,
      // so it may have counted at Google even though this attempt failed
      // before getting a response.
      continue;
    }

    const res = fetched.res;
    reachedGoogle = true;

    if (res.status === 429) {
      // The primary model's own quota (daily free-tier cap or per-minute
      // rate limit) is exhausted. Retrying the same model within this
      // request would just get the same answer, so stop the primary
      // attempts here and fall through to the fallback model below.
      const detail = await res.text().catch(() => "");
      console.error(`Gemini responded 429: model=${GEMINI_MODEL} attempt=${i + 1} body=${detail.slice(0, 500)}`);
      primaryQuotaExhausted = true;
      break;
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`Gemini responded ${res.status}: model=${GEMINI_MODEL} attempt=${i + 1} body=${detail.slice(0, 500)}`);
      if (RETRYABLE_STATUSES.has(res.status)) {
        lastRetryableStatus = res.status;
        continue;
      }
      // Not a retryable status: the same request would fail the same way
      // again, so return immediately instead of burning the rest of the
      // attempt budget.
      return {
        ok: false,
        reached: true,
        status: res.status,
        message: nonRetryableMessage(res.status),
      };
    }

    return await readGeminiResponse(res, GEMINI_MODEL);
  }

  if (!usesFallback) {
    // No distinct fallback configured, so behave the same as before: report
    // whichever failure ended the primary attempts. The wording must not
    // claim a backup model was tried, because none exists in this setup.
    if (primaryQuotaExhausted) {
      return {
        ok: false,
        reached: true,
        status: 429,
        message:
          "Gemini is out of quota or rate limited right now. " +
          "Wait a minute if this is a per-minute limit, or until tomorrow if today's quota is used up.",
      };
    }
    return {
      ok: false,
      reached: true,
      status: lastRetryableStatus || 503,
      message: "Gemini's servers are overloaded right now.",
    };
  }

  // Single fallback attempt, no delay: either the primary ran out of quota
  // (jumped straight here) or exhausted its 500/503/504 retries.
  const fallbackFetch = await fetchGemini(GEMINI_FALLBACK_MODEL, apiKey, imageBase64, mimeType);

  if (fallbackFetch.kind === "network-error") {
    console.error(`Gemini fetch failed: model=${GEMINI_FALLBACK_MODEL} attempt=fallback`);
    if (!reachedGoogle) {
      return { ok: false, reached: false, status: 0, message: "Could not reach Gemini." };
    }
    return {
      ok: false,
      reached: true,
      status: primaryQuotaExhausted ? 429 : (lastRetryableStatus || 503),
      message: primaryQuotaExhausted
        ? QUOTA_EXHAUSTED_MESSAGE
        : "Gemini's servers are overloaded right now (tried a backup model too).",
    };
  }

  const fallbackRes = fallbackFetch.res;
  reachedGoogle = true;

  if (fallbackRes.status === 429) {
    const detail = await fallbackRes.text().catch(() => "");
    console.error(`Gemini responded 429: model=${GEMINI_FALLBACK_MODEL} attempt=fallback body=${detail.slice(0, 500)}`);
    return { ok: false, reached: true, status: 429, message: QUOTA_EXHAUSTED_MESSAGE };
  }

  if (!fallbackRes.ok) {
    const detail = await fallbackRes.text().catch(() => "");
    console.error(`Gemini responded ${fallbackRes.status}: model=${GEMINI_FALLBACK_MODEL} attempt=fallback body=${detail.slice(0, 500)}`);
    if (RETRYABLE_STATUSES.has(fallbackRes.status)) {
      // Every attempt (primary retries plus the fallback) came back
      // 500/503/504, or the primary was 429 and the fallback overloaded too.
      return {
        ok: false,
        reached: true,
        status: fallbackRes.status,
        message: primaryQuotaExhausted
          ? "Gemini's primary model is out of quota right now, and the backup model's servers are overloaded too. Try again shortly."
          : "Gemini's servers are overloaded right now (tried a backup model too).",
      };
    }
    return {
      ok: false,
      reached: true,
      status: fallbackRes.status,
      message: nonRetryableMessage(fallbackRes.status),
    };
  }

  return await readGeminiResponse(fallbackRes, GEMINI_FALLBACK_MODEL);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  // Auth first: the password rides in a header, so nothing needs to buffer or
  // parse an anonymous caller's body.
  const password = str(req.headers.get("x-admin-password"));
  if (!(await adminPasswordIsValid(password))) {
    return json({ error: "Admin password check failed. Lock the portal and unlock it again." }, 401);
  }

  const contentLength = Number.parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BASE64_LENGTH + 4096) {
    return json({ error: "Image is too large. Use a photo under about 5 MB." }, 413);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: "Invalid request." }, 400);
  }

  const service = serviceClient();
  const action = str(body.action) || "parse";

  if (action === "status") {
    const { data, error } = await service.rpc("gemini_quota_status", { p_limit: DAILY_LIMIT });
    if (error) return json({ error: "Could not read today's scan count." }, 500);
    console.log(`action=status used=${data?.used ?? "?"} remaining=${data?.remaining ?? "?"}`);
    return json({ quota: withLimit(data), model: GEMINI_MODEL });
  }

  if (action !== "parse") return json({ error: "Unknown action." }, 400);

  const mimeType = str(body.mime_type).toLowerCase();
  const imageBase64 = typeof body.image_base64 === "string" ? body.image_base64 : "";
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return json({ error: "Unsupported image type. Use a JPEG, PNG, WebP, or HEIC photo." }, 400);
  }
  if (!imageBase64) return json({ error: "No image received." }, 400);
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return json({ error: "Image is too large. Use a photo under about 5 MB." }, 400);
  }

  const { data: consumeData, error: consumeError } = await service.rpc("gemini_quota_consume", {
    p_limit: DAILY_LIMIT,
  });
  if (consumeError) return json({ error: "Could not check today's scan count. Try again." }, 500);
  if (consumeData?.allowed !== true) {
    return json({
      error: `Today's ${DAILY_LIMIT} flyer scans are used up (shared across all admins). The counter resets at midnight Chicago time.`,
      quota: withLimit(consumeData),
    }, 429);
  }

  console.log(
    `action=parse consumed used=${consumeData?.used ?? "?"} remaining=${consumeData?.remaining ?? "?"} mime=${mimeType} b64len=${imageBase64.length}`,
  );
  const result = await callGemini(imageBase64, mimeType);

  if (!result.ok) {
    if (!result.reached) {
      // The request never made it to Google, so the scan is safe to give back,
      // credited to the exact date the consume charged.
      await service.rpc("gemini_quota_refund", { p_usage_date: consumeData?.usage_date ?? null });
      const { data: statusData } = await service.rpc("gemini_quota_status", { p_limit: DAILY_LIMIT });
      return json({
        error: `${result.message} This scan was not counted.`,
        quota: withLimit(statusData),
      }, 502);
    }
    // Gemini answered (even if unhelpfully), so the request may have counted
    // against Google's own daily cap. Keep the charge so the shared counter
    // never understates real usage.
    if (result.status === 429) {
      // callGemini already worded the message for whichever case applied
      // (backup model tried, backup also limited, or no backup configured),
      // so pass it through instead of restating it here.
      return json({
        error: `${result.message} This attempt still used one of today's scans.`,
        quota: withLimit(consumeData),
      }, 429);
    }
    return json({
      error: `${result.message} This attempt still used one of today's scans.`,
      quota: withLimit(consumeData),
    }, 502);
  }

  return json({ event: result.event, quota: withLimit(consumeData), model: result.model });
});
