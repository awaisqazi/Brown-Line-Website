import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabasePublishableKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

/**
 * PostgREST answers any one request with at most `max_rows` rows (1000 on a
 * Supabase project by default) and says nothing when it trims: a build that
 * asks for every row in one go silently loses the latest-dated events once
 * the table outgrows the cap. Every build-time read goes through this helper,
 * which fetches in pages and keeps going until the exact count is in hand.
 *
 * `page(from, to)` must return the query with `.range(from, to)` applied and
 * `{ count: 'exact' }` on its `.select()`, ordered with a unique tiebreaker
 * (`id`) last so no row moves between pages.
 */
const ROW_PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
};

export async function fetchAllRows<T>(
  label: string,
  page: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const rows: T[] = [];
  let total = Number.POSITIVE_INFINITY;
  while (rows.length < total) {
    const { data, error, count } = await page(rows.length, rows.length + ROW_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load ${label}: ${error.message}`);
    if (typeof count === 'number') total = count;
    const batch = data ?? [];
    if (batch.length === 0) break;
    rows.push(...batch);
  }
  return rows;
}

export interface TransitEvent {
  id: string;
  event_date: string;
  /** Postgres `time` (e.g. "18:30:00"); null when no confirmed start time. */
  start_time: string | null;
  /** Postgres `time` (e.g. "20:30:00"); null when no confirmed end time. */
  end_time: string | null;
  title: string;
  description: string | null;
  venue: string;
  organizer: string | null;
  cost_info: string | null;
  event_url: string | null;
  is_curated: boolean;
  is_giveaway: boolean;
  emoji: string | null;
  tags: string[] | null;
  /** Chicago neighborhood (free text); null when not yet assigned. */
  neighborhood: string | null;
  author_note: string | null;
  /** Optional photo or flyer URL (http/https), usually from a submission. */
  image_url: string | null;
}
