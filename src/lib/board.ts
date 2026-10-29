/**
 * How the events board turns `public.events` rows into cards, shared with the
 * stop pages so a "Back to the board" link always lands on the card that
 * exists for that row.
 *
 * Rows that share a title and venue are one run (that is how the admin stores
 * a date range: one row per day). A run with at most `SHORT_RUN_MAX_DATES`
 * dates in the window gets a card on each date still to come, each naming the
 * others, so a four-night show is found on every night. A longer run (an
 * exhibit, a course) collapses to one card on its first still-relevant date,
 * carrying the full date range.
 */
import { formatMonthDay, SHORT_RUN_MAX_DATES } from './dates';
import { buildStopAnchor } from './seo';
import type { TransitEvent } from './supabase';

export { SHORT_RUN_MAX_DATES };

export interface BoardStop {
  /** The row the card renders. */
  rep: TransitEvent;
  /** The card's window for the week and weekend filters. */
  start: string;
  end: string;
  /** "Oct 2 – Nov 7" for a collapsed run, "Also Oct 31, Nov 6 and Nov 7" for a short one, '' otherwise. */
  recurrenceLabel: string;
  /** The day section the card sits in. */
  sortDate: string;
  /** The card's `id` on the board; a short run's later cards carry a date suffix so ids stay unique. */
  anchor: string;
}

function joinDates(dates: string[]) {
  const labels = dates.map(formatMonthDay);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function groupRuns(rows: TransitEvent[]) {
  const runs = new Map<string, TransitEvent[]>();
  for (const row of rows) {
    const key = `${row.title}||${row.venue}`;
    const bucket = runs.get(key);
    if (bucket) bucket.push(row);
    else runs.set(key, [row]);
  }
  return Array.from(runs.values());
}

/** One entry per card, in no particular order; the board sorts them by day. */
export function groupBoardStops(rows: TransitEvent[], today: string): BoardStop[] {
  return groupRuns(rows).flatMap((run) => {
    const dates = Array.from(new Set(run.map((r) => r.event_date).filter(Boolean))).sort();
    // A run whose every date has passed is not on the board at all.
    const upcoming = dates.filter((d) => d >= today);
    if (upcoming.length === 0) return [];
    const rowFor = (date: string) => run.find((r) => r.event_date === date) ?? run[0];

    if (dates.length <= SHORT_RUN_MAX_DATES) {
      const baseAnchor = buildStopAnchor(rowFor(upcoming[0]));
      return upcoming.map((date, index) => {
        const others = upcoming.filter((d) => d !== date);
        return {
          rep: rowFor(date),
          start: date,
          end: date,
          recurrenceLabel: others.length > 0 ? `Also ${joinDates(others)}` : '',
          sortDate: date,
          anchor: index === 0 ? baseAnchor : `${baseAnchor}-${date}`,
        };
      });
    }

    const sortDate = upcoming[0];
    const start = dates[0];
    const end = dates[dates.length - 1];
    const rep = rowFor(sortDate);
    const recurrenceLabel = start !== end ? `${formatMonthDay(start)} – ${formatMonthDay(end)}` : '';
    return [{ rep, start, end, recurrenceLabel, sortDate, anchor: buildStopAnchor(rep) }];
  });
}

/**
 * Row id to the board anchor of the card that shows it: its own card for a
 * short run, the run's one card for a long run. Rows with no card on the
 * board (their run has no date left) are absent.
 */
export function boardAnchorsById(rows: TransitEvent[], today: string): Map<string, string> {
  const anchors = new Map<string, string>();
  for (const run of groupRuns(rows)) {
    const stops = groupBoardStops(run, today);
    if (stops.length === 0) continue;
    if (stops.length === 1 && run.length > 1 && stops[0].start !== stops[0].end) {
      // A collapsed run: every row, past days included, points at the one card.
      for (const row of run) anchors.set(row.id, stops[0].anchor);
      continue;
    }
    for (const stop of stops) anchors.set(stop.rep.id, stop.anchor);
  }
  return anchors;
}
