/**
 * Chase activity export: `Details,Posting Date,Description,Amount,Type,Balance,…`
 * Signed Amount (negative = out), dates MM/DD/YYYY.
 */
import { CanonicalTxn, ParsedFile, iso, money, normDesc } from '../lib'
import { RawFile } from './index'

export function parseChase(file: RawFile): ParsedFile {
  const lines = file.buffer.toString('utf8').split(/\r?\n/)
  const rows: CanonicalTxn[] = []
  let latest: { amount: number; asOf: string } | undefined
  const accountKey = `chase-${(file.name.match(/Chase(\d{4})/)?.[1]) ?? 'unknown'}`

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',')
    if (cells.length < 6 || !cells[1]?.trim()) continue
    const [m, d, y] = cells[1].trim().split('/').map((x) => parseInt(x, 10))
    const date = iso(y, m, d)
    const signed = money(cells[3])
    if (!signed) continue
    const balance = cells[5]?.trim() ? money(cells[5]) : null
    rows.push({
      id: `${file.name}:${i + 1}`,
      sourceFile: file.name,
      statementAccount: accountKey,
      date,
      description: normDesc(cells[2]),
      amount: Math.abs(signed),
      direction: signed < 0 ? 'out' : 'in',
      currency: 'USD',
      balanceAfter: balance,
    })
    if (balance !== null && (!latest || date >= latest.asOf)) latest = { amount: balance, asOf: date }
  }

  return { sourceFile: file.name, statementAccount: accountKey, currency: 'USD', closingBalance: latest, rows }
}
