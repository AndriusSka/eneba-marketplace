// Prices are integer euro cents everywhere (CLAUDE.md). These helpers only format and parse
// at the edges, using integer arithmetic so no float ever holds money.

const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })

/** 3449 → "€34.49" */
export function formatCents(cents: number): string {
  // Display only: Intl needs euros, and cents / 100 always formats back to the exact cents.
  return euro.format(cents / 100)
}

/** 3449 → "34.49", 3400 → "34" (the value shown in a price input). */
export function centsToInput(cents: number): string {
  const whole = Math.trunc(cents / 100)
  const rest = cents % 100
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, '0')}`
}

/** "34.49" / "34,49" / "34" → cents; null for anything else (empty, negative, 3+ decimals). */
export function inputToCents(value: string): number | null {
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(value.trim())
  if (!match) return null
  const whole = Number(match[1])
  const fraction = Number((match[2] ?? '').padEnd(2, '0'))
  return whole * 100 + fraction
}
