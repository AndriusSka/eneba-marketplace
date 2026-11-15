const orderDate = new Intl.DateTimeFormat('en-IE', { dateStyle: 'medium', timeStyle: 'short' })

/** "2026-11-15T13:04:51+00:00" → "15 Nov 2026, 13:04" (in the viewer's time zone). */
export function formatOrderDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : orderDate.format(date)
}
