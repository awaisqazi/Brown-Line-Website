// Admin-only "copy this flyer into our Storage" endpoint.
//
// The admin portal calls this whenever a flyer link enters the system (single
// add, row edit, CSV import, submission approval) so the row ends up with a
// permanent URL instead of a signed one that expires. The bytes are fetched
// here, server-side, because Instagram's CDN refuses cross-origin requests
// from a browser.
//
// Body: { source_url } to fetch a link, or { image_base64, mime_type } to
// store bytes the portal already holds. Response: { url, already_stored }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decodeBase64, MAX_IMAGE_BYTES, mirrorImageFromUrl, storeImageBytes } from "../_shared/mirror.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const password = str(req.headers.get("x-admin-password"));
  if (!(await adminPasswordIsValid(password))) {
    return json({ error: "Admin password check failed. Lock the portal and unlock it again." }, 401);
  }

  const contentLength = Number.parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_IMAGE_BYTES * 1.4 + 4096) {
    return json({ error: "The image is larger than 5 MB." }, 413);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch (_) {
    return json({ error: "Invalid request." }, 400);
  }

  const service = serviceClient();
  const sourceUrl = str(body.source_url);
  const imageBase64 = typeof body.image_base64 === "string" ? body.image_base64 : "";

  const result = sourceUrl
    ? await mirrorImageFromUrl(service, sourceUrl)
    : imageBase64
    ? await (async () => {
      const bytes = decodeBase64(imageBase64);
      if (!bytes) return { ok: false as const, error: "The image data could not be read.", status: 400 };
      return storeImageBytes(service, bytes, str(body.mime_type).toLowerCase());
    })()
    : { ok: false as const, error: "Send a source_url or image_base64.", status: 400 };

  if (!result.ok) {
    console.log(`mirror failed source=${sourceUrl ? sourceUrl.slice(0, 120) : "bytes"} reason=${result.error}`);
    return json({ error: result.error }, result.status ?? 400);
  }

  console.log(`mirror ok source=${sourceUrl ? sourceUrl.slice(0, 120) : "bytes"} stored=${!result.alreadyStored}`);
  return json({ url: result.url, already_stored: result.alreadyStored });
});
