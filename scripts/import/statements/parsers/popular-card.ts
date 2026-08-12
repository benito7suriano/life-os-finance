/**
 * Banco Popular credit card "Consulta de Transacciones" export (card 4857,
 * dual-currency: the `Moneda` row says DOP or USD).
 *
 * Layout: metadata rows, then one or more tables headed by
 * `Fecha Posteo,Descripción Corta,Monto Transacción,...`. Row-level
 * `Descripción Corta` is CR for charges (money OUT of the card) and DB for
 * payments/refunds (money IN) — inverted vs. bank-account intuition.
 *
 * Dates were mangled by Excel: `MMM-D` (May-28) is month/day, but for days
 * ≤ 12 the export shows `M-MMM` (5-Aug = May 8, 6-Dec = Jun 12): the first
 * token is the month number and the DAY is the month-number of the MMM token.
 * Verified against pre-existing DB rows (e.g. 5-Aug 12,016.11 = 2026-05-08).
 */
import { CanonicalTxn, ParsedFile, iso, money, normDesc } from '../lib'
import { RawFile } from './index'

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
}

export function parseCardDate(s: string, year = 2026): string {
  const [a, b] = s.split('-')
  if (MONTHS[a] !== undefined) return iso(year, MONTHS[a], parseInt(b, 10)) // MMM-D
  if (MONTHS[b] !== undefined) return iso(year, parseInt(a, 10), MONTHS[b]) // M-MMM → day = month#(MMM)
  throw new Error(`Unparseable Popular card date: ${s}`)
}

export function parsePopularCard(file: RawFile): ParsedFile {
  const lines = file.buffer.toString('utf8').split(/\r?\n/)
  let currency: 'USD' | 'DOP' | null = null
  const rows: CanonicalTxn[] = []
  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i].split(',')
    const first = cells[0]?.trim() ?? ''
    if (first === 'Moneda') {
      currency = cells[1].trim() as 'USD' | 'DOP'
      continue
    }
    if (first === 'Fecha Posteo') { inTable = true; continue }
    if (first.startsWith('Consumos Regulares') || first.startsWith('Tasa de')) { inTable = false; continue }
    if (!inTable || !first) continue

    const marker = cells[1]?.trim()
    if (marker !== 'CR' && marker !== 'DB') { inTable = false; continue }
    const amount = money(cells[2])
    if (!amount) continue
    if (!currency) throw new Error(`${file.name}: transaction before Moneda row`)
    rows.push({
      id: `${file.name}:${i + 1}`,
      sourceFile: file.name,
      statementAccount: `popular-4857-${currency}`,
      date: parseCardDate(first),
      description: normDesc(cells.slice(5).join(',')),
      amount,
      // On the card export CR = charge (out), DB = payment/refund (in).
      direction: marker === 'CR' ? 'out' : 'in',
      currency,
    })
  }

  if (!currency) throw new Error(`${file.name}: no Moneda row found`)
  return {
    sourceFile: file.name,
    statementAccount: `popular-4857-${currency}`,
    currency,
    rows,
  }
}
