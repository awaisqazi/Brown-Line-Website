/**
 * Data behind the nav's mini calendar: every event from a month back to about
 * four months out, with the labels the popover panel prints. Loaded once per
 * build and cached (the way ticker.ts does it), because the calendar renders
 * twice on every page (desktop header and mobile drawer) and the page should
 * carry the list exactly once.
 */
import { formatStopDate, formatTimeRange, getChicagoDateString } from './dates';

export interface PanelEvent {
  date: string;
  title: string;
  venue: string;
  dateLabel: string;
  timeLabel: string;
  blurb: string;
}

export interface MiniCalendarData {
  /** Today in Chicago, `YYYY-MM-DD`, so the widget matches the rest of the site. */
  todayString: string;
  windowStart: string;
  windowEnd: string;
  panelEvents: PanelEvent[];
  /** True when the query failed; the calendar still renders, without dots. */
  loadError: boolean;
}

const DAY_MS = 86400000;
const pad = (value: number) => String(value).padStart(2, '0');
const toDateString = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

let cache: Promise<MiniCalendarData> | undefined;

export function getMiniCalendarData(): Promise<MiniCalendarData> {
  if (!cache) {
    cache = load();
  }

  return cache;
}

async function load(): Promise<MiniCalendarData> {
  const todayString = getChicagoDateString();
  const [todayYear, todayMonth, todayDay] = todayString.split('-').map(Number);

  // A month back (so recently passed days still show context) through roughly
  // four months out, which is enough for the panel's month arrows.
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);
  const windowStart = toDateString(new Date(todayUtc - 30 * DAY_MS));
  const windowEnd = toDateString(new Date(todayUtc + 120 * DAY_MS));

  const panelEvents: PanelEvent[] = [];
  let loadError = false;

  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase
      .from('events')
      .select('event_date, title, venue, start_time, end_time, description')
      .gte('event_date', windowStart)
      .lte('event_date', windowEnd)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: true });

    if (error) throw error;

    for (const row of data ?? []) {
      const blurb = (row.description ?? '').replace(/\s+/g, ' ').trim();
      panelEvents.push({
        date: row.event_date,
        title: row.title ?? '',
        venue: row.venue ?? '',
        dateLabel: formatStopDate(row.event_date),
        timeLabel: formatTimeRange(row.start_time, row.end_time),
        blurb: blurb.length > 160 ? `${blurb.slice(0, 157)}...` : blurb,
      });
    }
  } catch (error) {
    // Never let a database hiccup break the nav.
    loadError = true;
    console.warn('MiniCalendar: could not load events', error);
  }

  return { todayString, windowStart, windowEnd, panelEvents, loadError };
}
