/**
 * BAC Credomatic credit-card "Estado de cuenta" export (latin1).
 *
 * Statement-summary layout: line 2 has the masked product number and the
 * statement cut-off date (DD/MM/YYYY). Transaction rows are
 * `date, description, Local, Dollars` where positive = charge (out) and
 * negative = credit/payment/refund (in). Rows without a date but with an
 * amount (e.g. "CARGOS POR SERVICIO SALDO DOLARES") are dated at cut-off.
 * Skipped: Previous balance, masked-card rows, zero-amount rows (LifeMiles,
 * PUNTOS…), and the final interest/balance summary (used as closingBalance).
 */
import { CanonicalTxn, ParsedFile, iso, money, normDesc } from '../lib'
import { RawFile } from './index'

const SKIP = /previous balance|^\d{4}-\d{2}\*\*|SOCIO LifeMiles|PUNTOS CREDOMATIC|ASIGNADO|REDIMIBLE/i

function parseDate(s: string): string {
  const [d, m, y] = s.split('/').map((x) => parseInt(x, 10))
  return iso(y, m, d)
}

export function parseBacCard(file: RawFile): ParsedFile {
  const lines = file.buffer.toString('latin1').split(/\r?\n/)
  const rows: CanonicalTxn[] = []

  const meta = lines[1].split(',').map((c) => c.trim())
  const product = meta[0] // e.g. 3777-31**-****-7785
  const last4 = product.slice(-4)
  const key = last4 === '7785' ? 'bac-amex-7785' : last4 === '3448' ? 'bac-visa-3448' : `bac-card-${last4}`
  const cutoffDate = parseDate(meta[2])

  let closing: number | undefined
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim())
    if (cells[0].startsWith('CURRENT Interest')) {
      // next line: interest local, interest dollars, cut-off local, cut-off dollars
      const vals = (lines[i + 1] ?? '').split(',').map((c) => money(c.trim() || '0'))
      if (vals.length >= 4 && Number.isFinite(vals[3])) closing = vals[3]
      // Interest is charged in the summary only, never as a transaction row —
      // synthesize one or the card balance drifts by exactly the interest.
      const interest = vals[1] || vals[0]
      if (interest) {
        rows.push({
          id: `${file.name}:interest`,
          sourceFile: file.name,
          statementAccount: key,
          date: cutoffDate,
          description: `Interés tarjeta (estado ${meta[2]})`,
          amount: interest,
          direction: 'out',
          currency: vals[1] ? 'USD' : 'DOP',
        })
      }
      break
    }
    if (cells.length < 4) continue
    const desc = cells[1]
    if (!desc || SKIP.test(desc)) continue
    const local = money(cells[2] || '0')
    const dollars = money(cells[3] || '0')
    const signed = dollars || local
    if (!signed) continue
    const dated = /^\d{2}\/\d{2}\/\d{4}$/.test(cells[0])
    rows.push({
      id: `${file.name}:${i + 1}`,
      sourceFile: file.name,
      statementAccount: key,
      date: dated ? parseDate(cells[0]) : cutoffDate,
      description: normDesc(desc),
      amount: Math.abs(signed),
      direction: signed > 0 ? 'out' : 'in',
      currency: dollars ? 'USD' : 'DOP',
    })
  }

  return {
    sourceFile: file.name,
    statementAccount: key,
    currency: 'USD',
    closingBalance: closing !== undefined ? { amount: closing, asOf: cutoffDate } : undefined,
    rows,
  }
}
