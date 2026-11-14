import { describe, expect, it } from 'vitest'
import { centsToInput, formatCents, inputToCents } from './money'

describe('formatCents', () => {
  it('formats euro cents for display', () => {
    expect(formatCents(3449)).toBe('€34.49')
    expect(formatCents(5)).toBe('€0.05')
    expect(formatCents(123456)).toBe('€1,234.56')
  })
})

describe('inputToCents', () => {
  it.each([
    ['34', 3400],
    ['34.5', 3450],
    ['34.49', 3449],
    ['34,49', 3449],
    [' 0 ', 0],
    ['0.29', 29], // 0.29 * 100 is 28.999… as a float; integer parsing gets it right
  ])('parses %s', (input, cents) => {
    expect(inputToCents(input)).toBe(cents)
  })

  it.each(['', 'abc', '-5', '1.234', '1e3'])('rejects %s', (input) => {
    expect(inputToCents(input)).toBeNull()
  })
})

describe('centsToInput', () => {
  it('drops zero cents and pads single digits', () => {
    expect(centsToInput(3400)).toBe('34')
    expect(centsToInput(3405)).toBe('34.05')
    expect(centsToInput(3449)).toBe('34.49')
  })
})
