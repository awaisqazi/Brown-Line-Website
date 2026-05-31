import { getRecentIssues } from './issues';
import type { TransitEvent } from './supabase';

export interface TickerItem {
  label: string;
  text: string;
}

type TickerEvent = Pick<TransitEvent, 'event_date' | 'display_date' | 'title' | 'venue' | 'event_url'>;

const EVENT_WINDOW_DAYS = 7;
const SITE_TIME_ZONE = 'America/Chicago';

let tickerCache: Promise<TickerItem[]> | undefined;

export function getTickerItems() {
  if (!tickerCache) {
    tickerCache = buildTickerItems();
  }

  return tickerCache;
}

async function buildTickerItems() {
  const [issues, events] = await Promise.all([getRecentIssues(), getUpcomingEvents()]);
  const latestIssue = issues[0];
  const items: TickerItem[] = [];

  if (latestIssue) {
    items.push({
      label: 'Latest Issue',
      text: latestIssue.title,
    });
  }

  if (events.length > 0) {
    items.push({
      label: 'Next 7 Days',
      text: '',
    });

    groupEventsByDate(events).forEach(({ date, events }) => {
      items.push({
        label: date,
        text: events.map(formatEventDetail).join(' / '),
      });
    });
  } else {
    items.push({
      label: 'Next 7 Days',
      text: 'No scheduled stops',
    });
  }

  return items;
}

async function getUpcomingEvents() {
  const today = getSiteDateString();
  const windowEnd = addDaysToDateString(today, EVENT_WINDOW_DAYS);

  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase
      .from('events')
      .select('event_date,display_date,title,venue,event_url')
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

function groupEventsByDate(events: TickerEvent[]) {
  const groups = new Map<string, TickerEvent[]>();

  events.forEach((event) => {
    const date = event.display_date?.trim() || formatDateString(event.event_date);
    groups.set(date, [...(groups.get(date) ?? []), event]);
  });

  return Array.from(groups, ([date, events]) => ({ date, events }));
}

function formatEventDetail(event: TickerEvent) {
  const venue = event.venue?.trim();
  return venue ? `${event.title} at ${venue}` : event.title;
}

function getSiteDateString() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SITE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function addDaysToDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function formatDateString(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);

  if (!year || !month || !day) return dateString;

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
