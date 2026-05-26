import { describe, it, expect } from 'vitest'
import { toUsd, fromUsd, formatCurrency, DOP_PER_USD } from '../fx'

describe('fx', () => {
  describe('toUsd', () => {
    it('passes USD through unchanged', () => {
      expect(toUsd(1000, 'USD')).toBe(1000)
    })

    it('converts DOP to USD at the central rate', () => {
      expect(toUsd(59000, 'DOP')).toBeCloseTo(59000 / DOP_PER_USD, 6)
    })

    it('treats null/undefined currency as USD', () => {
      expect(toUsd(42, null)).toBe(42)
      expect(toUsd(42, undefined)).toBe(42)
    })
  })

  describe('fromUsd', () => {
    it('is the inverse of toUsd for DOP', () => {
      const dop = 252822
      expect(fromUsd(toUsd(dop, 'DOP'), 'DOP')).toBeCloseTo(dop, 6)
    })

    it('converts USD to DOP at the central rate', () => {
      expect(fromUsd(1000, 'DOP')).toBeCloseTo(1000 * DOP_PER_USD, 6)
    })
  })

  describe('formatCurrency', () => {
    it('labels DOP distinctly from USD', () => {
      // Exact symbol ("RD$" vs "DOP ") depends on the runtime's ICU data; the
      // contract is that it is currency-labeled and clearly not a bare "$".
      const formatted = formatCurrency(252822, 'DOP')
      expect(formatted).toContain('252,822.00')
      expect(formatted).toMatch(/DOP|RD\$/)
    })

    it('labels USD with the $ symbol', () => {
      expect(formatCurrency(4285.12, 'USD')).toBe('$4,285.12')
    })

    it('renders negatives in parentheses with accounting option', () => {
      expect(formatCurrency(-674.18, 'USD', { accounting: true })).toBe('($674.18)')
    })
  })
})
