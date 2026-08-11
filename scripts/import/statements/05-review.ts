/**
 * Stage 05 — render deduped.json into a human-readable review.md.
 * Nothing is inserted until the user approves this file in chat.
 *
 *   npx tsx scripts/import/statements/05-review.ts
 */
import { CanonicalTxn, ParsedFile, readRunJson, writeRunJson, RUN_DIR, RUN_NAME } from './lib'
import { promises as fs } from 'node:fs'
import path from 'node:path'

type FileMeta = Omit<ParsedFile, 'rows'>

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function main() {
  const data = await readRunJson<{ files: FileMeta[]; rows: CanonicalTxn[] }>('deduped.json')
  const rows = data.rows

  const byAccount = new Map<string, CanonicalTxn[]>()
  for (const r of rows) {
    const key = r.accountName ?? r.statementAccount
    if (!byAccount.has(key)) byAccount.set(key, [])
    byAccount.get(key)!.push(r)
  }

  const lines: string[] = []
  lines.push(`# Statement import review — run ${RUN_NAME}`, '')
  lines.push('Legend: **new** = will be inserted · db_dup / intra_dup = skipped · **review** = needs a decision', '')

  // ---- summary ------------------------------------------------------------
  lines.push('## Summary by account', '')
  lines.push('| Account | new | db dup | intra dup | review | in (new) | out (new) |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const [name, list] of byAccount) {
    const c = (s: string) => list.filter((r) => r.dedupStatus === s && !r.mergedIntoPair).length
    const cur = list[0].currency
    const inSum = list.filter((r) => r.dedupStatus === 'new' && r.direction === 'in' && !r.mergedIntoPair).reduce((s, r) => s + r.amount, 0)
    const outSum = list.filter((r) => r.dedupStatus === 'new' && r.direction === 'out' && !r.mergedIntoPair).reduce((s, r) => s + r.amount, 0)
    lines.push(`| ${name} | ${c('new')} | ${c('db_duplicate')} | ${c('intra_duplicate')} | ${c('needs_review')} | ${fmt(inSum)} ${cur} | ${fmt(outSum)} ${cur} |`)
  }
  lines.push('')

  lines.push('## Statement closing balances (for post-import verification)', '')
  for (const f of data.files) {
    if (f.closingBalance) lines.push(`- ${f.statementAccount} — ${fmt(f.closingBalance.amount)} ${f.currency} as of ${f.closingBalance.asOf} (${f.sourceFile})`)
  }
  lines.push('')

  // ---- needs review -------------------------------------------------------
  const review = rows.filter((r) => r.dedupStatus === 'needs_review' && !r.mergedIntoPair)
  lines.push(`## Needs review (${review.length})`, '')
  for (const r of review.sort((a, b) => a.date.localeCompare(b.date))) {
    lines.push(`- \`${r.id}\` ${r.date} · ${r.accountName} · ${r.direction} ${fmt(r.amount)} ${r.currency} · "${r.description}"`)
    lines.push(`  - ${r.dedupNote}${r.notes?.length ? ` · ${r.notes.join(' · ')}` : ''}`)
  }
  lines.push('')

  // ---- uncategorized ------------------------------------------------------
  const uncat = new Map<string, { n: number; total: number; cur: string }>()
  for (const r of rows) {
    if (r.categoryId === null && r.inferredType !== 'transfer' && r.dedupStatus === 'new') {
      const k = r.description
      const e = uncat.get(k) ?? { n: 0, total: 0, cur: r.currency }
      e.n++; e.total += r.amount
      uncat.set(k, e)
    }
  }
  lines.push(`## Uncategorized descriptions (${uncat.size})`, '')
  for (const [desc, e] of [...uncat].sort((a, b) => b[1].total - a[1].total)) {
    lines.push(`- "${desc}" ×${e.n} — ${fmt(e.total)} ${e.cur}`)
  }
  lines.push('')

  // ---- full listing -------------------------------------------------------
  lines.push('## All rows', '')
  for (const [name, list] of byAccount) {
    lines.push(`### ${name}`, '')
    lines.push('| Date | Status | Type | Amount | Category | Description | Notes |')
    lines.push('|---|---|---|---|---|---|---|')
    for (const r of list.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
      const status = r.mergedIntoPair ? 'merged→pair' : (r.dedupStatus ?? '?')
      const sign = r.direction === 'out' ? '−' : '+'
      const xfer = r.inferredType === 'transfer' && r.toAmount ? ` (→ ${fmt(r.toAmount)} ${r.toCurrency})` : ''
      lines.push(`| ${r.date} | ${status} | ${r.inferredType} | ${sign}${fmt(r.amount)} ${r.currency}${xfer} | ${r.categoryName ?? (r.inferredType === 'transfer' ? '—' : '(none)')} | ${(r.cleanDescription ?? r.description).replace(/\|/g, '/')} | ${(r.notes ?? []).join('; ').replace(/\|/g, '/')} |`)
    }
    lines.push('')
  }

  await fs.mkdir(RUN_DIR, { recursive: true })
  const out = path.join(RUN_DIR, 'review.md')
  await fs.writeFile(out, lines.join('\n'))
  console.log(`wrote ${out}`)
  // review.md is derived from deduped.json; 06-insert reads deduped.json.
  await writeRunJson('review-stats.json', {
    counts: {
      new: rows.filter((r) => r.dedupStatus === 'new' && !r.mergedIntoPair).length,
      needs_review: review.length,
    },
  })
}

main().catch((e) => { console.error(e); process.exit(1) })
