/**
 * Banco Popular checking/savings "Consulta de Transacciones" export
 * (accounts …8471 USD and …9652 DOP).
 *
 * Two tables share the header `Fecha Posteo,…,Monto Transacción,Balance,…`:
 * the FIRST is credits (money in), the SECOND is debits (money out) — row
 * labels are unreliable (e.g. "RETENCION DGII" debits sit in the debit table
 * with an empty short-description). Dates are D/M/YY. A running Balance
 * column is present; the last row of the file is the freshest balance.
 */
import { CanonicalTxn, ParsedFile, iso, money, normDesc } from '../lib'
import { RawFile } from './index'

function parseDate(s: string): string {
  const [d, m, y] = s.split('/').map((x) => parseInt(x, 10))
  return iso(2000 + y, m, d)
}

export function parsePopularChecking(file: RawFile): ParsedFile {
  const lines = file.buffer.toString('utf8').split(/\r?\n/)
  let currency: 'USD' | 'DOP' | null = null
  let accountNumber = ''
  const rows: CanonicalTxn[] = []
  let tableIndex = -1 // 0 = credits, 1 = debits
  let inTable = false
  let latest: { amount: number; asOf: string } | undefined

  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i].split(',')
    const first = cells[0]?.trim() ?? ''
    if (first === 'Moneda') { currency = cells[1].trim() as 'USD' | 'DOP'; continue }
    if (first.startsWith('Cuenta:')) { accountNumber = first.replace(/\D/g, ''); continue }
    if (first === 'Fecha Posteo') { tableIndex++; inTable = true; continue }
    if (!inTable || !first || !/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(first)) {
      if (inTable && first) inTable = false
      continue
    }

    const amount = money(cells[2])
    const balance = cells[3]?.trim() ? money(cells[3]) : null
    if (!amount) continue
    if (!currency) throw new Error(`${file.name}: transaction before Moneda row`)
    const date = parseDate(first)
    const shortDesc = cells[1]?.trim()
    const longDesc = normDesc(cells.slice(6).join(','))
    rows.push({
      id: `${file.name}:${i + 1}`,
      sourceFile: file.name,
      statementAccount: `popular-${accountNumber.slice(-4)}`,
      date,
      description: longDesc || shortDesc,
      amount,
      direction: tableIndex === 0 ? 'in' : 'out',
      currency,
      balanceAfter: balance,
    })
    if (balance !== null && (!latest || date >= latest.asOf)) latest = { amount: balance, asOf: date }
  }

  if (!currency) throw new Error(`${file.name}: no Moneda row found`)
  return {
    sourceFile: file.name,
    statementAccount: `popular-${accountNumber.slice(-4)}`,
    currency,
    closingBalance: latest,
    rows,
  }
}
