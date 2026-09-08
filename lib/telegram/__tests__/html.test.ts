import { describe, it, expect } from 'vitest'
import { escapeHtml, monoTable, splitMessage } from '../html'

describe('escapeHtml', () => {
  it('escapes only the three characters Telegram HTML mode requires', () => {
    expect(escapeHtml('a < b & c > d "q"')).toBe('a &lt; b &amp; c &gt; d "q"')
  })
})

describe('monoTable', () => {
  it('pads columns, right-aligns numeric cells, and wraps in <pre>', () => {
    const out = monoTable(['Month', 'Income'], [
      ['Jul 2026', '1,200.00'],
      ['Aug 2026', '950.50'],
    ])
    expect(out).toBe(
      ['<pre>', 'Month     Income', 'Jul 2026  1,200.00', 'Aug 2026    950.50', '</pre>'].join('\n')
    )
  })

  it('escapes cell contents', () => {
    expect(monoTable(['Name'], [['A&B']])).toContain('A&amp;B')
  })
})

describe('splitMessage', () => {
  it('returns a single chunk when under the limit', () => {
    expect(splitMessage('hello', 4000)).toEqual(['hello'])
  })

  it('splits on line boundaries without exceeding the limit', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`)
    const chunks = splitMessage(lines.join('\n'), 20)
    expect(chunks.every((c) => c.length <= 20)).toBe(true)
    expect(chunks.join('\n')).toBe(lines.join('\n'))
  })

  it('closes and reopens <pre> blocks across a split', () => {
    const rows = Array.from({ length: 6 }, (_, i) => `row ${i}`)
    const text = ['<pre>', ...rows, '</pre>'].join('\n')
    const chunks = splitMessage(text, 30)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.startsWith('<pre>')).toBe(true)
      expect(chunk.endsWith('</pre>')).toBe(true)
      expect(chunk.length).toBeLessThanOrEqual(30)
    }
    const stripped = chunks
      .map((c) => c.replace(/^<pre>\n?/, '').replace(/\n?<\/pre>$/, ''))
      .join('\n')
    expect(stripped).toBe(rows.join('\n'))
  })
})
