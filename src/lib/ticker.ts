import { formatStopDate, getChicagoDateString } from './dates';
import type { TransitEvent } from './supabase';

export interface TickerItem {
  label: string;
  text: string;
}

type TickerEvent = Pick<TransitEvent, 'event_date' | 'title' | 'venue' | 'event_url' | 'is_curated'>;

// Hand-picked highlights only: a few strong stops, not the full multi-week dump.
const MAX_HIGHLIGHTS = 5;
const EVENT_WINDOW_DAYS = 21;

let tickerCache: Promise<TickerItem[]> | undefined;

export function getTickerItems() {
  if (!tickerCache) {
    tickerCache = buildTickerItems();
  }

  return tickerCache;
}

async function buildTickerItems() {
  const events = await getUpcomingEvents();
  const items: TickerItem[] = [];

  const highlights = pickHighlights(events);

  if (highlights.length > 0) {
    highlights.forEach((event) => {
      items.push({
        label: formatStopDate(event.event_date),
        text: formatEventDetail(event),
      });
    });
  } else {
    items.push({
      label: 'Next stops',
      text: 'See the events board',
    });
  }

  return items;
}

// Curate: Conductor's Picks first, then soonest, de-duplicated by title so a
// recurring series (e.g. a multi-week camp) only appears once.
function pickHighlights(events: TickerEvent[]): TickerEvent[] {
  const ranked = [...events].sort((a, b) => {
    if (a.is_curated !== b.is_curated) return a.is_curated ? -1 : 1;
    return a.event_date.localeCompare(b.event_date);
  });

  const seenTitles = new Set<string>();
  const highlights: TickerEvent[] = [];
  for (const event of ranked) {
    const key = event.title.trim().toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    highlights.push(event);
    if (highlights.length >= MAX_HIGHLIGHTS) break;
  }

  // Show highlights in chronological order once selected.
  return highlights.sort((a, b) => a.event_date.localeCompare(b.event_date));
}

async function getUpcomingEvents() {
  const today = getChicagoDateString();
  const windowEnd = addDaysToDateString(today, EVENT_WINDOW_DAYS);

  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase
      .from('events')
      .select('event_date,title,venue,event_url,is_curated')
      .gte('event_date', today)
      .lte('event_date', windowEnd)
      .order('event_date', { ascending: true })
      .order('title', { ascending: true });

    if (error) throw error;

    return (data ?? []) as TickerEvent[];
  } catch (error) {
    console.error('Error fetching upcoming ticker events:', error);
    return [];
  }
}

function formatEventDetail(event: TickerEvent) {
  return event.title.replace(/\bTurkiye\b/g, 'Türkiye').replace(/\bTURKIYE\b/g, 'TÜRKIYE');
}

function addDaysToDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
