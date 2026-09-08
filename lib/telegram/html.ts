// Helpers for Telegram's HTML parse mode (agent answers + reports).
// The extraction/confirm cards in lib/automation/telegram/format.ts stay
// plain text; only these callers pass `parseMode: 'HTML'`.

/** Telegram HTML mode only requires escaping these three characters. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const NUMERIC_CELL = /^[-+]?[$€£]?[\d,]+(\.\d+)?%?$/

/** Column-padded monospace table inside <pre>. Columns whose body cells are
 * all numeric are right-aligned; headers stay left-aligned. */
export function monoTable(headers: string[], rows: string[][]): string {
  const colCount = headers.length
  const widths = headers.map((h) => h.length)
  const numeric = headers.map(() => rows.length > 0)
  for (const row of rows) {
    for (let c = 0; c < colCount; c++) {
      const cell = row[c] ?? ''
      widths[c] = Math.max(widths[c], cell.length)
      if (cell !== '' && !NUMERIC_CELL.test(cell)) numeric[c] = false
    }
  }

  const renderLine = (cells: string[], alignRight: boolean) =>
    cells
      .map((cell, c) => {
        const text = cell ?? ''
        const pad = ' '.repeat(Math.max(0, widths[c] - text.length))
        return alignRight && numeric[c] ? pad + escapeHtml(text) : escapeHtml(text) + pad
      })
      .join('  ')
      .trimEnd()

  return ['<pre>', renderLine(headers, false), ...rows.map((r) => renderLine(r, true)), '</pre>'].join('\n')
}

const PRE_OPEN = '<pre>'
const PRE_CLOSE = '</pre>'

/** Telegram caps messages at 4096 chars. Split on line boundaries, closing
 * and reopening any <pre> block that straddles a split so every chunk is
 * valid HTML on its own. */
export function splitMessage(text: string, max = 4000): string[] {
  const chunks: string[] = []
  let current = ''
  let inPre = false

  const flush = () => {
    if (current === '') return
    chunks.push(inPre ? `${current}\n${PRE_CLOSE}` : current)
    current = inPre ? PRE_OPEN : ''
  }

  for (const rawLine of text.split('\n')) {
    for (const line of hardWrap(rawLine, max - PRE_OPEN.length - PRE_CLOSE.length - 2)) {
      const opens = countOccurrences(line, PRE_OPEN)
      const closes = countOccurrences(line, PRE_CLOSE)
      const afterInPre: boolean = opens > closes ? true : closes > opens ? false : inPre

      const candidate = current === '' ? line : `${current}\n${line}`
      const reserve = afterInPre ? PRE_CLOSE.length + 1 : 0
      if (candidate.length + reserve > max && current !== '' && current !== PRE_OPEN) {
        flush()
        current = current === '' ? line : `${current}\n${line}`
      } else {
        current = candidate
      }
      inPre = afterInPre
    }
  }
  if (current !== '' && current !== PRE_OPEN) chunks.push(current)
  return chunks.length > 0 ? chunks : ['']
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/** A single line longer than the limit is sliced — rare, but must not stall. */
function hardWrap(line: string, width: number): string[] {
  if (line.length <= width) return [line]
  const parts: string[] = []
  for (let i = 0; i < line.length; i += width) parts.push(line.slice(i, i + width))
  return parts
}
