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
