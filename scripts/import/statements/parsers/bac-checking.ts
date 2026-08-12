/**
 * BAC Credomatic checking "Transacciones del mes" export (latin1).
 *
 * Line 2 carries account metadata (Producto, Moneda, Saldo Inicial, Saldo en
 * Libros). Detail rows follow the `Fecha de Transacción,…` header until the
 * `Resumen de Estado Bancario` section: date DD/MM/YYYY, reference, code,
 * description, débito, crédito, running balance.
 */
import { CanonicalTxn, ParsedFile, iso, money, normDesc } from '../lib'
import { RawFile } from './index'

export function parseBacChecking(file: RawFile): ParsedFile {
  const lines = file.buffer.toString('latin1').split(/\r?\n/)
  const rows: CanonicalTxn[] = []
  let currency: 'USD' | 'DOP' = 'USD'
  let product = ''
  let bookBalance: number | null = null
  let inDetail = false
  let latest: { amount: number; asOf: string } | undefined

  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim())
    if (i === 1 && cells.length > 6) {
      product = cells[2]
      currency = cells[3] as 'USD' | 'DOP'
      bookBalance = money(cells[5])
      continue
    }
    if (cells[0]?.startsWith('Fecha de Transacci')) { inDetail = true; continue }
    if (cells[0]?.startsWith('Resumen')) { inDetail = false; continue }
    if (!inDetail || !/^\d{2}\/\d{2}\/\d{4}$/.test(cells[0] ?? '')) continue

    const [d, m, y] = cells[0].split('/').map((x) => parseInt(x, 10))
    const date = iso(y, m, d)
    const debit = money(cells[4] || '0')
    const credit = money(cells[5] || '0')
    const amount = debit || credit
    if (!amount) continue
    const balance = cells[6] ? money(cells[6]) : null
    rows.push({
      id: `${file.name}:${i + 1}`,
      sourceFile: file.name,
      statementAccount: `bac-${product.slice(-4)}`,
      date,
      description: normDesc(cells[3]),
      amount,
      direction: debit ? 'out' : 'in',
      currency,
      balanceAfter: balance,
    })
    if (balance !== null && (!latest || date >= latest.asOf)) latest = { amount: balance, asOf: date }
  }

  return {
    sourceFile: file.name,
    statementAccount: `bac-${product.slice(-4)}`,
    currency,
    // Prefer the per-row running balance; Saldo en Libros on line 2 is the
    // account-wide current balance at export time, same in every monthly file.
    closingBalance: latest ?? (bookBalance !== null ? { amount: bookBalance, asOf: 'export' } : undefined),
    rows,
  }
}
