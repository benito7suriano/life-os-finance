/**
 * Stage 01 — parse every statement in runs/<run>/inbox/ into normalized.json.
 *
 *   npx tsx scripts/import/statements/01-normalize.ts
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { CUTOFF_DATE, ParsedFile, RUN_DIR, writeRunJson } from './lib'
import { parseStatementFile } from './parsers'

async function main() {
  const inbox = path.join(RUN_DIR, 'inbox')
  const names = (await fs.readdir(inbox)).filter((n) => n.toLowerCase().endsWith('.csv')).sort()
  if (!names.length) throw new Error(`No CSVs in ${inbox}`)

  const files: ParsedFile[] = []
  for (const name of names) {
    const parsed = parseStatementFile({ name, buffer: await fs.readFile(path.join(inbox, name)) })
    files.push(parsed)
    const pre = parsed.rows.filter((r) => r.date < CUTOFF_DATE).length
    console.log(
      `  ${name} → ${parsed.statementAccount} [${parsed.currency}] ${parsed.rows.length} rows` +
      (pre ? ` (${pre} pre-cutoff)` : '') +
      (parsed.closingBalance ? ` closing ${parsed.closingBalance.amount} @ ${parsed.closingBalance.asOf}` : ''),
    )
  }

  const all = files.flatMap((f) => f.rows)
  const dates = all.map((r) => r.date).sort()
  console.log(`\n${files.length} files, ${all.length} rows, ${dates[0]} → ${dates[dates.length - 1]}`)

  await writeRunJson('normalized.json', {
    files: files.map(({ rows: _rows, ...meta }) => meta),
    rows: all,
  })
}

main().catch((e) => { console.error(e); process.exit(1) })
