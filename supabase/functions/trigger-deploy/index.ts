// Admin-only "publish the live site now" endpoint.
//
// The public site is static: Supabase edits only reach it when the GitHub
// Pages workflow rebuilds (push, 4-hour cron, or manual dispatch). This
// function lets the admin portal fire that workflow_dispatch on demand, so a
// database change can be live in a couple of minutes.
//
// Secrets:
//   GITHUB_DEPLOY_TOKEN     required: fine-grained PAT for the site repo with
//                           Actions read+write permission, no other scopes
//   GITHUB_DEPLOY_REPO      optional, default awaisqazi/Brown-Line-Website
//   GITHUB_DEPLOY_WORKFLOW  optional, default deploy.yml
//   GITHUB_DEPLOY_REF       optional, default main

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const REPO = Deno.env.get("GITHUB_DEPLOY_REPO") ?? "awaisqazi/Brown-Line-Website";
const WORKFLOW = Deno.env.get("GITHUB_DEPLOY_WORKFLOW") ?? "deploy.yml";
const REF = Deno.env.get("GITHUB_DEPLOY_REF") ?? "main";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const password = (req.headers.get("x-admin-password") ?? "").trim();
  if (!(await adminPasswordIsValid(password))) {
    return json({ error: "Admin password check failed. Lock the portal and unlock it again." }, 401);
  }

  const token = Deno.env.get("GITHUB_DEPLOY_TOKEN");
  if (!token) {
    return json({
      error: "Publishing is not set up yet. Create a fine-grained GitHub token for the site repo (Actions: read and write) and run: supabase secrets set GITHUB_DEPLOY_TOKEN=<token>",
    }, 503);
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "brown-line-admin-portal",
        },
        body: JSON.stringify({ ref: REF }),
      },
    );
  } catch (_) {
    return json({ error: "Could not reach GitHub. Try again in a moment." }, 502);
  }

  if (res.status === 204) {
    return json({ ok: true, message: "Site rebuild started. The live site updates in about 2 to 3 minutes." });
  }

  const detail = await res.text().catch(() => "");
  console.error(`workflow_dispatch failed ${res.status}: ${detail.slice(0, 500)}`);
  if (res.status === 401 || res.status === 403) {
    return json({ error: "GitHub rejected the deploy token. It may have expired; create a new fine-grained token and update the GITHUB_DEPLOY_TOKEN secret." }, 502);
  }
  return json({ error: `GitHub could not start the rebuild (status ${res.status}).` }, 502);
});
