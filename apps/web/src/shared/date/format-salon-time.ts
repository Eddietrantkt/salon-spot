/** Formats booking snapshots in the Salon's timezone, never in the viewer's timezone. */
export function formatSalonTimeRange(startsAt: string, endsAt: string, timezone: string, locale = 'en-GB'): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
}

/** A date-only snapshot must not shift when the browser is in another timezone. */
export function formatSalonLocalDate(localDate: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(`${localDate}T12:00:00.000Z`));
}
