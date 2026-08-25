// Public "submit an event" endpoint.
//
// The static site posts here instead of writing to the database directly, so a
// Cloudflare Turnstile token can be verified server-side before anything is
// stored. Inserts run with the service role (bypassing RLS); the public has no
// direct insert access to public.event_submissions.
//
// Production setup:
//   1. Create a Cloudflare Turnstile widget and copy the site + secret keys.
//   2. Set TURNSTILE_SECRET as an Edge Function secret in Supabase.
//   3. Set PUBLIC_TURNSTILE_SITE_KEY (build var) to the matching site key.
// The site key and the secret must come from the same widget. If they drift
// apart, or TURNSTILE_SECRET goes missing, every submission is rejected and the
// reason lands in the function logs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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
const LOCATION_TYPES = ["Chicago", "Suburb", "Other Illinois", "Outside Illinois"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
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

function nullable(value: unknown): string | null {
  const clean = str(value);
  return clean.length ? clean.slice(0, 2000) : null;
}

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) {
    // Fail closed. A missing secret used to fall back to Cloudflare's TEST
    // secret, which accepts every token, so a misconfigured deploy would have
    // quietly waved bots through instead of breaking loudly.
    console.error("TURNSTILE_SECRET is not set; rejecting the submission.");
    return false;
  }
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
    const data = await res.json();
    if (data?.success !== true) {
      // Cloudflare names the reason here, and the two worth telling apart are a
      // stale token from the visitor and a secret that belongs to a different
      // widget than the site key the page renders.
      console.warn("Turnstile rejected the token:", JSON.stringify(data?.["error-codes"] ?? []));
      return false;
    }
    return true;
  } catch (err) {
    console.error("Turnstile siteverify request failed:", err);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: "Invalid request." }, 400);
  }

  // Honeypot: real visitors never fill this hidden field. Accept silently so a
  // bot cannot tell it was rejected, but store nothing. "company" is the legacy
  // field name (still checked so older cached pages stay protected); the form
  // now uses "event_sponsor", which no browser autofill token matches.
  if (str(body.company) || str(body.event_sponsor)) return json({ ok: true });

  const token = str(body.token);
  if (!token) return json({ error: "Please complete the captcha." }, 400);

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for");
  if (!(await verifyTurnstile(token, ip))) {
    return json({ error: "Captcha verification failed. Please try again." }, 400);
  }

  const submitter_name = str(body.submitter_name);
  const title = str(body.title);
  const event_date = str(body.event_date);
  const venue = str(body.venue);
  const diaspora_tag = str(body.diaspora_tag);
  const location_type = str(body.location_type);
  const description = str(body.description);

  const missing: string[] = [];
  if (!submitter_name) missing.push("your name");
  if (!title) missing.push("an event title");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) missing.push("a valid event date");
  if (!venue) missing.push("a venue");
  if (!DIASPORA_TAGS.includes(diaspora_tag)) missing.push("a community tag");
  if (!LOCATION_TYPES.includes(location_type)) missing.push("a location type");
  if (!description) missing.push("a description");
  if (missing.length) return json({ error: `Please provide: ${missing.join(", ")}.` }, 400);

  // Descriptions are capped at 150 words (stated on the form and counted live
  // there); this mirror check stops anything that skips the form's validation.
  const DESCRIPTION_WORD_LIMIT = 150;
  const descriptionWords = description.split(/\s+/).filter(Boolean).length;
  if (descriptionWords > DESCRIPTION_WORD_LIMIT) {
    return json({
      error:
        `Your description is ${descriptionWords} words; the limit is ${DESCRIPTION_WORD_LIMIT}. Trim it down and resubmit.`,
    }, 400);
  }

  // The regex above only checks the shape; reject impossible calendar dates
  // (2026-99-99) and dates that have already passed in Chicago.
  const [yy, mm, dd] = event_date.split("-").map(Number);
  const parsed = new Date(Date.UTC(yy, mm - 1, dd));
  const isRealDate = parsed.getUTCFullYear() === yy &&
    parsed.getUTCMonth() === mm - 1 &&
    parsed.getUTCDate() === dd;
  if (!isRealDate) {
    return json({ error: "That event date does not exist. Use a real calendar date." }, 400);
  }
  const chicagoToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" })
    .format(new Date());
  if (event_date < chicagoToday) {
    return json({ error: "That event date has already passed. Pick an upcoming date." }, 400);
  }

  const chicago_neighborhood = nullable(body.chicago_neighborhood);
  const suburb = nullable(body.suburb);
  if (location_type === "Chicago" && !chicago_neighborhood) {
    return json({ error: "Please choose a Chicago neighborhood." }, 400);
  }
  if (location_type === "Suburb" && !suburb) {
    return json({ error: "Please choose or enter a suburb." }, 400);
  }

  const event_url = nullable(body.event_url);
  if (event_url && !/^https?:\/\//i.test(event_url)) {
    return json({ error: "Event URL must start with http:// or https://." }, 400);
  }

  const image_url = nullable(body.image_url);
  if (image_url && !/^https?:\/\//i.test(image_url)) {
    return json({ error: "Photo URL must start with http:// or https://." }, 400);
  }

  const submitter_email = nullable(body.submitter_email);
  if (submitter_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(submitter_email)) {
    return json({ error: "Please enter a valid email or leave it blank." }, 400);
  }

  const event_time = str(body.event_time);
  const start_time = /^\d{2}:\d{2}/.test(event_time) ? event_time : null;

  const event_time_end = str(body.event_time_end);
  const end_time = /^\d{2}:\d{2}/.test(event_time_end) ? event_time_end : null;

  const neighborhood = location_type === "Chicago"
    ? chicago_neighborhood
    : location_type === "Suburb"
    ? suburb
    : null;

  const record = {
    submitter_name: submitter_name.slice(0, 200),
    submitter_email,
    title: title.slice(0, 300),
    event_date,
    start_time,
    end_time,
    venue: venue.slice(0, 300),
    organizer: nullable(body.organizer),
    cost_info: nullable(body.cost),
    event_url,
    image_url,
    description: description.slice(0, 6000),
    tags: [diaspora_tag],
    neighborhood,
    address: nullable(body.address),
    location_type,
    chicago_neighborhood,
    suburb,
  };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await supabase.from("event_submissions").insert(record);
  if (error) {
    console.error("submit-event insert failed:", error.message);
    return json({ error: "Could not save your submission. Please try again." }, 500);
  }

  return json({ ok: true });
});
