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
import { errorMessage } from './admin-shared';

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
  return record;
}
