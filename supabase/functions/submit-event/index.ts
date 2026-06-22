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
// Until TURNSTILE_SECRET is set, the function falls back to Cloudflare's public
// TEST secret (which accepts the matching TEST site key), so the flow works end
// to end before real keys are wired in. Replace it before promoting the form.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
// Cloudflare's documented "always passes" TEST secret.
const TEST_SECRET = "1x0000000000000000000000000000000AA";

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
  const secret = Deno.env.get("TURNSTILE_SECRET") ?? TEST_SECRET;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
    const data = await res.json();
    return data?.success === true;
  } catch (_) {
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
  // bot cannot tell it was rejected, but store nothing.
  if (str(body.company)) return json({ ok: true });

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

  const submitter_email = nullable(body.submitter_email);
  if (submitter_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(submitter_email)) {
    return json({ error: "Please enter a valid email or leave it blank." }, 400);
  }

  const event_time = str(body.event_time);
  const start_time = /^\d{2}:\d{2}/.test(event_time) ? event_time : null;

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
    venue: venue.slice(0, 300),
    organizer: nullable(body.organizer),
    cost_info: nullable(body.cost),
    event_url,
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
