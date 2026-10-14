// Beehiiv -> GitHub: rebuild the site the moment an issue goes out.
//
// The public site is static and reads the newsletter at build time, so a new
// issue only appears after the GitHub Pages workflow runs (push, 4-hour cron,
// or a dispatch). Beehiiv calls this function on every `post.sent`; the
// function checks the delivery's signature and fires the same
// workflow_dispatch the admin portal's Publish button (trigger-deploy) uses.
// Any other event type is acknowledged and ignored.
//
// Beehiiv delivers webhooks through Svix, so each request carries svix-id,
// svix-timestamp and svix-signature headers signed with the endpoint's
// signing secret (shown on the webhook's page in Beehiiv Settings > Webhooks).
// Verification follows Svix's manual recipe: HMAC-SHA256 over
// "<id>.<timestamp>.<raw body>" with the base64-decoded secret, compared in
// constant time against every "v1,<sig>" entry, and the timestamp must be
// within five minutes of now.
//
// Secrets:
//   BEEHIIV_WEBHOOK_SECRET  required: the Svix signing secret (whsec_...)
//   GITHUB_DEPLOY_TOKEN     required: fine-grained PAT for the site repo with
//                           Actions read+write permission, no other scopes
//   GITHUB_DEPLOY_REPO      optional, default awaisqazi/Brown-Line-Website
//   GITHUB_DEPLOY_WORKFLOW  optional, default deploy.yml
//   GITHUB_DEPLOY_REF       optional, default main

const REPO = Deno.env.get("GITHUB_DEPLOY_REPO") ?? "awaisqazi/Brown-Line-Website";
const WORKFLOW = Deno.env.get("GITHUB_DEPLOY_WORKFLOW") ?? "deploy.yml";
const REF = Deno.env.get("GITHUB_DEPLOY_REF") ?? "main";

/** Event types that mean "the public newsletter changed, rebuild". */
const REBUILD_EVENTS = new Set(["post.sent"]);

/** How far a delivery's timestamp may drift from our clock, in seconds. */
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * True when the request was signed by Beehiiv (Svix) with our secret and is
 * fresh. Logs the reason on failure without echoing any secret material.
 */
async function verifySignature(secret: string, headers: Headers, rawBody: string): Promise<boolean> {
  const id = headers.get("svix-id") ?? headers.get("webhook-id") ?? "";
  const timestamp = headers.get("svix-timestamp") ?? headers.get("webhook-timestamp") ?? "";
  const signatures = headers.get("svix-signature") ?? headers.get("webhook-signature") ?? "";
  if (!id || !timestamp || !signatures) {
    console.warn("Webhook rejected: missing svix headers.");
    return false;
  }

  const sentAt = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > TIMESTAMP_TOLERANCE_SECONDS) {
    console.warn(`Webhook rejected: timestamp ${timestamp} is outside the tolerance window.`);
    return false;
  }

  let key: Uint8Array<ArrayBuffer>;
  try {
    key = base64ToBytes(secret.replace(/^whsec_/, ""));
  } catch (_) {
    console.error("BEEHIIV_WEBHOOK_SECRET is not base64 (expected the whsec_... signing secret).");
    return false;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`)),
  );

  for (const entry of signatures.split(" ")) {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) continue;
    try {
      if (constantTimeEqual(base64ToBytes(signature), expected)) return true;
    } catch (_) {
      // Not base64; try the next entry.
    }
  }

  console.warn(`Webhook rejected: no v1 signature matched (svix-id ${id}).`);
  return false;
}

async function dispatchRebuild(token: string): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "brown-line-beehiiv-webhook",
      },
      body: JSON.stringify({ ref: REF }),
    },
  );
  if (res.status === 204) return { ok: true };
  const detail = await res.text().catch(() => "");
  return { ok: false, status: res.status, detail: detail.slice(0, 500) };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const secret = (Deno.env.get("BEEHIIV_WEBHOOK_SECRET") ?? "").trim();
  if (!secret) {
    // Fail closed: with no secret there is no way to tell Beehiiv from anyone
    // else, so nothing gets to start a build.
    console.error("BEEHIIV_WEBHOOK_SECRET is not set; rejecting the delivery.");
    return json({ error: "Webhook is not configured." }, 503);
  }

  const rawBody = await req.text();
  if (!(await verifySignature(secret, req.headers, rawBody))) {
    return json({ error: "Signature check failed." }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch (_) {
    return json({ error: "Body is not JSON." }, 400);
  }

  const eventType = typeof payload.event_type === "string"
    ? payload.event_type
    : typeof payload.type === "string"
    ? payload.type
    : "";
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const postId = typeof data.id === "string" ? data.id : "";

  if (!REBUILD_EVENTS.has(eventType)) {
    // 200, not 4xx: Svix would retry anything else, and there is nothing to
    // retry. The event simply is not one that changes the public site.
    console.log(`Ignoring ${eventType || "unknown"} event${postId ? ` for ${postId}` : ""}.`);
    return json({ ok: true, ignored: eventType || "unknown" });
  }

  const token = Deno.env.get("GITHUB_DEPLOY_TOKEN");
  if (!token) {
    console.error("GITHUB_DEPLOY_TOKEN is not set; cannot start the rebuild.");
    return json({ error: "Publishing is not set up: GITHUB_DEPLOY_TOKEN is missing." }, 503);
  }

  let result: Awaited<ReturnType<typeof dispatchRebuild>>;
  try {
    result = await dispatchRebuild(token);
  } catch (_) {
    // 502 so Svix retries: GitHub was unreachable, the event is still valid.
    return json({ error: "Could not reach GitHub." }, 502);
  }

  if (result.ok) {
    console.log(`Rebuild started for ${eventType}${postId ? ` (${postId})` : ""}.`);
    return json({ ok: true, event: eventType, post: postId || undefined, message: "Site rebuild started." });
  }

  console.error(`workflow_dispatch failed ${result.status}: ${result.detail}`);
  if (result.status === 401 || result.status === 403) {
    // Our token is bad, not Beehiiv's delivery; retrying will not help, so
    // answer 200 and leave the reason in the logs.
    return json({ ok: false, error: "GitHub rejected the deploy token; rotate GITHUB_DEPLOY_TOKEN." });
  }
  return json({ error: `GitHub could not start the rebuild (status ${result.status}).` }, 502);
});
