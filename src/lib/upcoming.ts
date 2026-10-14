/**
 * The site's "next stops" selection, shared by the homepage rail and the
 * links page so both always agree on what is coming up soonest.
 *
 * Rows that belong to one run (same title and venue, one row per day, which is
 * how the admin stores a date range) collapse into a single stop with a date
 * range, mirroring the events board. Date order first; within a day,
 * Conductor's Picks, then single stops ahead of runs, then title. Long runs
 * (an exhibit, a course, a festival) take at most `seriesLimit` seats so a
 * two-month series never crowds out the week's one-night stops.
 *
 * The events query runs once per build and is cached, the way ticker.ts and
 * mini-calendar.ts do it.
 */
import { addDays, formatMonthDay, getChicagoDateString, SERIES_LOOKBACK_DAYS } from './dates';
import { supabase } from './supabase';
import type { TransitEvent } from './supabase';

export interface UpcomingStop {
  /** The row for the run's next date, the one a card renders. */
  event: TransitEvent;
  /** "Sep 27 – Nov 29" for a run; '' for a single date. */
  recurrenceLabel: string;
  /** More than one row shares this title and venue. */
  isSeries: boolean;
  /** First date on or after today. */
  nextDate: string;
  /** The run's final date. */
  lastDate: string;
}

export interface UpcomingStopsOptions {
  /** How many stops to seat. */
  limit: number;
  /** At most this many multi-day runs among them. */
  seriesLimit: number;
}

let rowsCache: Promise<TransitEvent[]> | undefined;

function loadRows(): Promise<TransitEvent[]> {
  if (!rowsCache) {
    rowsCache = (async () => {
      const todayDateString = getChicagoDateString();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', addDays(todayDateString, -SERIES_LOOKBACK_DAYS))
        .order('event_date', { ascending: true })
        .order('is_curated', { ascending: false, nullsFirst: false })
        .order('title', { ascending: true })
        .returns<TransitEvent[]>();
      if (error) {
        throw new Error(`Failed to load upcoming events: ${error.message}`);
      }
      return data ?? [];
    })();
  }
  return rowsCache;
}

export async function getUpcomingStops({ limit, seriesLimit }: UpcomingStopsOptions): Promise<UpcomingStop[]> {
  const todayDateString = getChicagoDateString();
  const rows = await loadRows();

  const seriesMap = new Map<string, TransitEvent[]>();
  for (const row of rows) {
    const key = `${row.title}||${row.venue}`;
    const bucket = seriesMap.get(key);
    if (bucket) bucket.push(row);
    else seriesMap.set(key, [row]);
  }

  const candidateStops: UpcomingStop[] = [];
  for (const runRows of seriesMap.values()) {
    const dates = runRows.map((row) => row.event_date).filter(Boolean).sort();
    const nextDate = dates.find((date) => date >= todayDateString);
    // The whole run has departed.
    if (!nextDate) continue;
    const first = dates[0];
    const last = dates[dates.length - 1];
    candidateStops.push({
      event: runRows.find((row) => row.event_date === nextDate) ?? runRows[0],
      recurrenceLabel: first !== last ? `${formatMonthDay(first)} – ${formatMonthDay(last)}` : '',
      isSeries: runRows.length > 1,
      nextDate,
      lastDate: last,
    });
  }

  const byDeparture = (a: UpcomingStop, b: UpcomingStop) =>
    a.nextDate.localeCompare(b.nextDate) ||
    Number(Boolean(b.event.is_curated)) - Number(Boolean(a.event.is_curated)) ||
    Number(a.isSeries) - Number(b.isSeries) ||
    a.event.title.localeCompare(b.event.title);

  const singleStops = candidateStops.filter((stop) => !stop.isSeries).sort(byDeparture);
  // Runs are seated by how soon they wrap up: a festival's closing week is
  // news, a two-month exhibit will still be there next week.
  const seriesStops = candidateStops
    .filter((stop) => stop.isSeries)
    .sort((a, b) => a.lastDate.localeCompare(b.lastDate) || byDeparture(a, b));

  // Seat the runs first (capped), then singles, then let leftover runs fill
  // any seats singles could not, so the list is as full as the calendar allows.
  const seatedSeries = seriesStops.slice(0, seriesLimit);
  const seatedSingles = singleStops.slice(0, limit - seatedSeries.length);
  const spareSeats = limit - seatedSeries.length - seatedSingles.length;
  return [
    ...seatedSingles,
    ...seatedSeries,
    ...seriesStops.slice(seatedSeries.length, seatedSeries.length + spareSeats),
  ]
    .sort(byDeparture)
    .slice(0, limit);
}
