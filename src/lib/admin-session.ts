// The admin command center's one session (src/pages/admin/index.astro).
//
// Holds the admin password and the Supabase client in module memory only:
// nothing is written to storage, cookies, or the URL, so a refresh relocks.
// Every panel shares this one client (its `x-admin-password` header is what the
// RLS policies and the edge functions key on) and the one realtime channel on
// public.events, which is opened on unlock and torn down on lock.
//
// Panels talk to each other through the tiny emitter below instead of
// reaching into each other's DOM.

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { errorMessage, type PublishProgress } from './admin-shared';

export type ScanQuota = { remaining?: unknown; limit?: unknown } | null | undefined;

export type PublishRecord = {
  at: Date;
  ok: boolean;
  message: string;
  source: string;
};

export type ArticleCounts = { total: number; drafts: number };

type SessionEventMap = {
  unlock: undefined;
  lock: undefined;
  // Fired while a Publish live site request starts (true) and ends (false).
  'publish-busy': boolean;
  published: PublishRecord;
  // The rebuild a successful publish started, followed through to the live
  // site (or to a failure, or to losing track of it).
  'publish-progress': PublishProgress;
  // A debounced-by-listener signal that public.events changed somewhere.
  'events-change': undefined;
  // 'connecting' | 'SUBSCRIBED' | any other channel status | 'off'
  'realtime-status': string;
  'pending-count': number;
  'scan-quota': ScanQuota;
  'scan-quota-refresh': undefined;
  'articles-count': ArticleCounts;
  // An admin wrote to public.events from this browser (add, CSV, approve).
  'events-written': undefined;
};

type SessionEvent = keyof SessionEventMap;
type Listener<K extends SessionEvent> = (detail: SessionEventMap[K]) => void;

const listeners = new Map<SessionEvent, Set<Listener<any>>>();

export function on<K extends SessionEvent>(name: K, listener: Listener<K>) {
  let set = listeners.get(name);
  if (!set) {
    set = new Set();
    listeners.set(name, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}

export function emit<K extends SessionEvent>(
  name: K,
  ...args: SessionEventMap[K] extends undefined ? [] : [SessionEventMap[K]]
) {
  const detail = args[0] as SessionEventMap[K];
  listeners.get(name)?.forEach((listener) => {
    // One panel failing must never stop the others from hearing the event.
    try {
      listener(detail);
    } catch (error) {
      console.error(`[admin] ${name} listener failed`, error);
    }
  });
}

/* ---------- Config (from the app root's data attributes) ---------- */

function appRoot() {
  return document.querySelector('[data-admin-app]') as HTMLElement | null;
}

const root = appRoot();
const supabaseUrl = root?.dataset.supabaseUrl ?? '';
const supabaseKey = root?.dataset.supabaseKey ?? '';
export const functionsBase = root?.dataset.functionsBase ?? '';
const siteUrl = root?.dataset.siteUrl ?? '';
const siteBase = root?.dataset.siteBase ?? '/';

/* ---------- Session state (memory only) ---------- */

let adminClient: SupabaseClient | null = null;
let adminPassword = '';
let eventsChannel: RealtimeChannel | null = null;
let realtimeStatus = 'off';
let lastPublish: PublishRecord | null = null;
let publishing = false;
let unlocking = false;

export function getClient() {
  return adminClient;
}

export function getPassword() {
  return adminPassword;
}

export function isUnlocked() {
  return adminClient !== null;
}

export function getRealtimeStatus() {
  return realtimeStatus;
}

export function getLastPublish() {
  return lastPublish;
}

export function isPublishing() {
  return publishing;
}

function createAdminClient(password: string) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'x-admin-password': password,
      },
    },
  });
}

function setRealtimeStatus(status: string) {
  realtimeStatus = status;
  emit('realtime-status', status);
}

// One channel per session. Every panel that cares (the schedule manager, the
// overview board) listens for 'events-change' and applies its own debounce.
function openEventsChannel(client: SupabaseClient) {
  if (eventsChannel) return;
  setRealtimeStatus('connecting');
  eventsChannel = client
    .channel('admin-events-db')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
      if (adminClient !== client) return;
      emit('events-change');
    })
    .subscribe((status) => {
      if (adminClient !== client) return;
      setRealtimeStatus(status);
    });
}

function closeEventsChannel(client: SupabaseClient | null) {
  const channel = eventsChannel;
  eventsChannel = null;
  if (client) {
    // removeAllChannels unsubscribes, tears down, and disconnects the socket.
    void client.removeAllChannels().catch(() => undefined);
  } else if (channel) {
    void channel.unsubscribe();
  }
  setRealtimeStatus('off');
}

/**
 * Verify the password against the database (the same
 * `events_admin_login_check` RPC and header as before) and open the session.
 * Resolves true on success, false on a wrong password; throws with a
 * plain-language message on a network or server error.
 */
export async function unlock(password: string): Promise<boolean> {
  if (unlocking) return false;
  unlocking = true;
  try {
    const client = createAdminClient(password);
    let data: unknown;
    try {
      const result = await client.rpc('events_admin_login_check');
      if (result.error) throw new Error(result.error.message);
      data = result.data;
    } catch (error) {
      throw new Error(errorMessage(error));
    }
    if (data !== true) return false;
    // A second unlock without a lock in between replaces the old session.
    if (adminClient) closeEventsChannel(adminClient);
    adminClient = client;
    adminPassword = password;
    lastPublish = null;
    emit('unlock');
    openEventsChannel(client);
    return true;
  } finally {
    unlocking = false;
  }
}

/** Forget the password and client, tear down realtime, and tell every panel. */
export function lock() {
  const client = adminClient;
  adminClient = null;
  adminPassword = '';
  lastPublish = null;
  stopFollowingPublish();
  closeEventsChannel(client);
  emit('lock');
}

/**
 * Publish live site: fires the `trigger-deploy` edge function. One request at
 * a time across every Publish button on the page.
 */
export async function publishLiveSite(source = 'header'): Promise<PublishRecord | null> {
  if (publishing || !adminPassword) return null;
  const password = adminPassword;
  publishing = true;
  emit('publish-busy', true);
  let record: PublishRecord;
  try {
    const res = await fetch(`${functionsBase}/trigger-deploy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-password': password },
      body: '{}',
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(payload?.error ?? `Publish failed (status ${res.status}).`);
    record = { at: new Date(), ok: true, message: payload?.message ?? 'Site rebuild started.', source };
  } catch (error) {
    record = { at: new Date(), ok: false, message: errorMessage(error), source };
  } finally {
    publishing = false;
    emit('publish-busy', false);
  }
  // Locked while the request was in flight: the result belongs to no session.
  if (adminPassword !== password) return record;
  lastPublish = record;
  emit('published', record);
  if (record.ok) followPublish(record);
  return record;
}

/* ---------- Following a publish through to the live site ---------- */

// "Site rebuild started" only means GitHub accepted the signal. The site is
// live a few minutes later, when the Actions run finishes, and nothing used to
// say when that was: an admin who looked too early saw the old page and
// pressed Publish again. The site repo is public, so its runs can be read
// without a token (60 requests an hour per address; one publish uses about
// 20 at most). The repo and workflow match trigger-deploy's defaults.
const DEPLOY_REPO = 'awaisqazi/Brown-Line-Website';
const DEPLOY_WORKFLOW = 'deploy.yml';
const PROGRESS_FIRST_POLL_MS = 6_000;
const PROGRESS_POLL_MS = 15_000;
const PROGRESS_MAX_POLLS = 24;
// Polls before giving up on GitHub ever listing the run.
const PROGRESS_UNLISTED_POLLS = 5;

type WorkflowRun = {
  id: number;
  event: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
};

let progressTimer: ReturnType<typeof setTimeout> | undefined;
let progressToken = 0;

function clockTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// The public events page with a one-off query string, so the browser and the
// CDN fetch the new build instead of a copy cached before the publish.
function liveEventsUrl() {
  const origin = siteUrl || `${window.location.origin}${siteBase}`;
  const url = new URL('events/', origin.endsWith('/') ? origin : `${origin}/`);
  url.searchParams.set('fresh', String(Date.now()));
  return url.toString();
}

function stopFollowingPublish() {
  if (progressTimer) clearTimeout(progressTimer);
  progressTimer = undefined;
  progressToken += 1;
}

async function fetchWorkflowRuns(): Promise<WorkflowRun[]> {
  const res = await fetch(
    `https://api.github.com/repos/${DEPLOY_REPO}/actions/workflows/${DEPLOY_WORKFLOW}/runs?per_page=5`,
    { headers: { Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const payload = (await res.json()) as { workflow_runs?: WorkflowRun[] };
  return payload.workflow_runs ?? [];
}

// A newer publish or a lock replaces this follow; its token stops stale ticks.
function followPublish(record: PublishRecord) {
  stopFollowingPublish();
  const token = progressToken;
  const since = record.at.getTime() - 60_000;
  const sentAt = clockTime(record.at);
  let polls = 0;
  let runId: number | null = null;

  const report = (progress: PublishProgress) => {
    if (token === progressToken) emit('publish-progress', progress);
  };
  const schedule = (ms: number) => {
    if (token !== progressToken) return;
    progressTimer = setTimeout(() => void tick(), ms);
  };

  const tick = async () => {
    if (token !== progressToken) return;
    polls += 1;
    let runs: WorkflowRun[];
    try {
      runs = await fetchWorkflowRuns();
    } catch (_) {
      report({
        phase: 'lost',
        message: `${sentAt}: Rebuild started, but its progress could not be checked from here. Give it about 3 minutes, then open the live page.`,
        liveUrl: liveEventsUrl(),
      });
      return;
    }
    const run = runId
      ? runs.find((r) => r.id === runId)
      : runs.find((r) => r.event === 'workflow_dispatch' && Date.parse(r.created_at) >= since);
    if (!run) {
      if (polls >= PROGRESS_UNLISTED_POLLS) {
        report({
          phase: 'lost',
          message: `${sentAt}: Rebuild signal sent, but GitHub has not listed the run. Give it about 3 minutes, then open the live page; if nothing changed, press Publish live site again.`,
          liveUrl: liveEventsUrl(),
        });
        return;
      }
      report({ phase: 'queued', message: `${sentAt}: Rebuild signal sent. Waiting for GitHub to pick it up...` });
      schedule(PROGRESS_POLL_MS);
      return;
    }
    runId = run.id;
    if (run.status === 'completed') {
      if (run.conclusion === 'success') {
        report({
          phase: 'live',
          message: `Live site updated at ${clockTime(new Date(run.updated_at))}. Your changes are public now.`,
          liveUrl: liveEventsUrl(),
        });
      } else {
        report({
          phase: 'failed',
          message: `The rebuild started at ${sentAt} did not finish (${run.conclusion ?? 'unknown'}). Press Publish live site once more; if it fails again, tell Fez.`,
        });
      }
      return;
    }
    if (polls >= PROGRESS_MAX_POLLS) {
      report({
        phase: 'lost',
        message: `${sentAt}: The rebuild is taking longer than usual. Check back in a few minutes and open the live page.`,
        liveUrl: liveEventsUrl(),
      });
      return;
    }
    report({ phase: 'building', message: `${sentAt}: Rebuilding the site now, usually 2 to 3 minutes. This line updates when it is live.` });
    schedule(PROGRESS_POLL_MS);
  };

  report({ phase: 'started', message: `${sentAt}: ${record.message}` });
  schedule(PROGRESS_FIRST_POLL_MS);
}
