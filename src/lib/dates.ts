const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Standardized descriptive label for a `YYYY-MM-DD` event date, e.g. "Sun. Jun 28".
 * Derived purely from the date so every event on the same day renders identically
 * (this replaced the free-text `display_date` column, which drifted between formats
 * like "Tue. Jun 23" and "Tue. Jun. 23" and split a single day into two segments).
 * Parsed in UTC so the calendar day never shifts across time zones.
 */
export function formatStopDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[date.getUTCDay()]}. ${MONTHS[month - 1]} ${day}`;
}

/**
 * Compact 12-hour label for a `HH:MM[:SS]` start time, e.g. "8 PM" or "5:30 PM".
 * Returns '' for missing or unparseable values so callers can render nothing.
 */
export function formatStartTime(value: string | null | undefined): string {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours)) return '';
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes ? `${hour12}:${String(minutes).padStart(2, '0')} ${period}` : `${hour12} ${period}`;
}

/**
 * Time label for a start/end pair, e.g. "7 PM to 9 PM". Falls back to the
 * single start-time label (via formatStartTime) when there is no end time.
 */
export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  const startLabel = formatStartTime(start);
  const endLabel = formatStartTime(end);
  if (!endLabel) return startLabel;
  if (!startLabel) return endLabel;
  return `${startLabel} to ${endLabel}`;
}

/**
 * Today's calendar date in America/Chicago as `YYYY-MM-DD`, so "upcoming"
 * queries stay anchored to the site's home time zone no matter where the
 * build runs. Falls back to the UTC date if the Intl parts are missing.
 */
export function getChicagoDateString(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
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
