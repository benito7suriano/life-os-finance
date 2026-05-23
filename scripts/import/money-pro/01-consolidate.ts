/**
 * Phase 0: Consolidate Money Pro CSV exports.
 *
 * Reads all six "Money Pro - Transactions 18-5-26, 08:57 N.csv" files from
 * ~/Downloads, normalizes them, deduplicates, sorts chronologically, and
 * writes:
 *   - data/consolidated.csv  (single human-readable CSV — the user-facing artifact)
 *   - data/raw.json          (typed rows for downstream phases)
 *   - data/unique-accounts.json, unique-categories.json, unique-types.json
 *
 * Run with: npx tsx scripts/import/money-pro/01-consolidate.ts
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import Papa from 'papaparse'

const DOWNLOADS = path.join(os.homedir(), 'Downloads')
const FILE_PATTERN = /^Money Pro - Transactions 18-5-26, 08:57 (\d+)\.csv$/
const OUT_DIR = path.resolve(__dirname, 'data')

type RawRow = Record<string, string>

type Currency = 'USD' | 'DOP'

interface NormalizedRow {
  sourceFile: number
  sourceLine: number
  dateIso: string // YYYY-MM-DDTHH:mm
  date: string // YYYY-MM-DD
  amount: number // always positive
  currency: Currency
  account: string
  amountReceived: number | null
  amountReceivedCurrency: Currency | null
  accountTo: string | null
  balance: number | null
  balanceCurrency: Currency | null
  category: string | null
  categoryParent: string | null
  categoryChild: string | null
  description: string | null
  transactionType: string
}

function parseAmount(raw: string): { value: number; currency: Currency } | null {
  if (!raw || !raw.trim()) return null
  let s = raw.trim()
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1)
  }
  let currency: Currency
  if (s.startsWith('US$')) {
    currency = 'USD'
    s = s.slice(3)
  } else if (s.startsWith('RD$')) {
    currency = 'DOP'
    s = s.slice(3)
  } else {
    // Unknown prefix — log and skip
    return null
  }
  s = s.replace(/,/g, '')
  const n = parseFloat(s)
  if (!Number.isFinite(n)) return null
  return { value: negative ? -n : n, currency }
}

function parseDate(raw: string): { iso: string; date: string } | null {
  // "d/M/yy, HH:mm"
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const [, dStr, monStr, yStr, hStr, minStr] = m
  const d = parseInt(dStr, 10)
  const mon = parseInt(monStr, 10)
  let y = parseInt(yStr, 10)
  if (y < 100) y += 2000
  if (y < 2000 || y > 2099) return null
  const h = parseInt(hStr, 10)
  const min = parseInt(minStr, 10)
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0')
  const date = `${y}-${pad(mon)}-${pad(d)}`
  const iso = `${date}T${pad(h)}:${pad(min)}`
  return { iso, date }
}

function normalizeCategory(raw: string | undefined): {
  category: string | null
  parent: string | null
  child: string | null
} {
  if (!raw) return { category: null, parent: null, child: null }
  let s = raw.trim().replace(/\s+/g, ' ')
  if (!s) return { category: null, parent: null, child: null }
  // Dedup adjacent equal tokens: "Gifts Gifts" → "Gifts"
  const tokens = s.split(' ')
  const collapsed: string[] = []
  for (const t of tokens) {
    if (collapsed.length === 0 || collapsed[collapsed.length - 1].toLowerCase() !== t.toLowerCase()) {
      collapsed.push(t)
    }
  }
  s = collapsed.join(' ')
  if (s.includes(':')) {
    const [parent, ...rest] = s.split(':')
    const child = rest.join(':').trim()
    return {
      category: `${parent.trim()}: ${child}`,
      parent: parent.trim(),
      child: child || null,
    }
  }
  return { category: s, parent: s, child: null }
}

async function discoverFiles(): Promise<{ file: string; index: number }[]> {
  const entries = await fs.readdir(DOWNLOADS)
  const matched: { file: string; index: number }[] = []
  for (const name of entries) {
    const m = name.match(FILE_PATTERN)
    if (m) matched.push({ file: path.join(DOWNLOADS, name), index: parseInt(m[1], 10) })
  }
  matched.sort((a, b) => a.index - b.index)
  return matched
}

async function readCsv(file: string): Promise<RawRow[]> {
  const text = await fs.readFile(file, 'utf8')
  const parsed = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true })
  if (parsed.errors.length) {
    console.warn(`[warn] ${path.basename(file)}: ${parsed.errors.length} CSV parse warnings`)
  }
  return parsed.data
}

function normalize(file: number, line: number, row: RawRow): NormalizedRow | { skip: string } {
  const date = parseDate(row['Date'] || '')
  if (!date) return { skip: `bad date "${row['Date']}"` }
  const amt = parseAmount(row['Amount'] || '')
  if (!amt) return { skip: `bad amount "${row['Amount']}"` }
  const amtRecv = parseAmount(row['Amount received'] || '')
  const bal = parseAmount(row['Balance'] || '')
  const cat = normalizeCategory(row['Category'])
  const account = (row['Account'] || '').trim()
  const accountTo = (row['Account (to)'] || '').trim() || null
  const description = (row['Description'] || '').trim() || null
  const transactionType = (row['Transaction Type'] || '').trim()
  return {
    sourceFile: file,
    sourceLine: line,
    dateIso: date.iso,
    date: date.date,
    amount: Math.abs(amt.value),
    currency: amt.currency,
    account,
    amountReceived: amtRecv?.value ?? null,
    amountReceivedCurrency: amtRecv?.currency ?? null,
    accountTo,
    balance: bal?.value ?? null,
    balanceCurrency: bal?.currency ?? null,
    category: cat.category,
    categoryParent: cat.parent,
    categoryChild: cat.child,
    description,
    transactionType,
  }
}

function dedupKey(r: NormalizedRow): string {
  // For Money Transfer, treat (A→B) and (B→A) as the same pair on the same date+amount.
  if (r.transactionType === 'Money Transfer') {
    const pair = [r.account, r.accountTo || ''].sort().join('||')
    return [r.dateIso, r.amount, r.currency, pair, r.description || '', r.transactionType].join('|')
  }
  return [
    r.dateIso,
    r.amount,
    r.currency,
    r.account,
    r.accountTo || '',
    r.description || '',
    r.transactionType,
  ].join('|')
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })

  const files = await discoverFiles()
  if (files.length === 0) {
    throw new Error(`No matching CSVs found in ${DOWNLOADS}`)
  }
  console.log(`Found ${files.length} CSV files:`)
  for (const f of files) console.log(`  ${path.basename(f.file)}`)

  const skipReasons: Record<string, number> = {}
  const seen = new Map<string, NormalizedRow>()
  let totalRows = 0
  let dupCount = 0

  for (const { file, index } of files) {
    const rows = await readCsv(file)
    let lineNo = 1
    for (const row of rows) {
      lineNo++
      totalRows++
      const result = normalize(index, lineNo, row)
      if ('skip' in result) {
        skipReasons[result.skip] = (skipReasons[result.skip] || 0) + 1
        continue
      }
      const key = dedupKey(result)
      if (seen.has(key)) {
        dupCount++
        continue
      }
      seen.set(key, result)
    }
  }

  const allRows = Array.from(seen.values())
  allRows.sort((a, b) => {
    if (a.dateIso < b.dateIso) return -1
    if (a.dateIso > b.dateIso) return 1
    if (a.sourceFile !== b.sourceFile) return a.sourceFile - b.sourceFile
    return a.sourceLine - b.sourceLine
  })

  // Inventories
  const uniqueAccounts = new Map<string, { currency: Set<Currency>; firstSeen: string; lastSeen: string; count: number }>()
  const uniqueCategories = new Map<string, { parent: string; child: string | null; count: number; sampleTypes: Set<string> }>()
  const uniqueTypes = new Map<string, number>()

  for (const r of allRows) {
    if (r.account) {
      const a = uniqueAccounts.get(r.account) || {
        currency: new Set<Currency>(),
        firstSeen: r.date,
        lastSeen: r.date,
        count: 0,
      }
      a.currency.add(r.currency)
      a.count++
      if (r.date < a.firstSeen) a.firstSeen = r.date
      if (r.date > a.lastSeen) a.lastSeen = r.date
      uniqueAccounts.set(r.account, a)
    }
    if (r.accountTo) {
      const a = uniqueAccounts.get(r.accountTo) || {
        currency: new Set<Currency>(),
        firstSeen: r.date,
        lastSeen: r.date,
        count: 0,
      }
      if (r.amountReceivedCurrency) a.currency.add(r.amountReceivedCurrency)
      a.count++
      if (r.date < a.firstSeen) a.firstSeen = r.date
      if (r.date > a.lastSeen) a.lastSeen = r.date
      uniqueAccounts.set(r.accountTo, a)
    }
    if (r.category) {
      const c = uniqueCategories.get(r.category) || {
        parent: r.categoryParent || r.category,
        child: r.categoryChild,
        count: 0,
        sampleTypes: new Set<string>(),
      }
      c.count++
      c.sampleTypes.add(r.transactionType)
      uniqueCategories.set(r.category, c)
    }
    uniqueTypes.set(r.transactionType, (uniqueTypes.get(r.transactionType) || 0) + 1)
  }

  // Write consolidated.csv in original Money Pro column order
  const csvHeader = [
    'Date',
    'Amount',
    'Account',
    'Amount received',
    'Account (to)',
    'Balance',
    'Category',
    'Description',
    'Transaction Type',
  ]
  const formatAmount = (v: number | null, cur: Currency | null): string => {
    if (v == null || !cur) return ''
    const prefix = cur === 'USD' ? 'US$' : 'RD$'
    const absStr = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return v < 0 ? `(${prefix}${absStr})` : `${prefix}${absStr}`
  }
  const formatDate = (iso: string): string => {
    // back to "d/M/yy, HH:mm"
    const [datePart, timePart] = iso.split('T')
    const [y, mo, d] = datePart.split('-').map((s) => parseInt(s, 10))
    const yy = y % 100
    return `${d}/${mo}/${yy.toString().padStart(2, '0')}, ${timePart}`
  }
  const csvRows = allRows.map((r) => ({
    Date: formatDate(r.dateIso),
    Amount: formatAmount(r.amount, r.currency),
    Account: r.account,
    'Amount received': formatAmount(r.amountReceived, r.amountReceivedCurrency),
    'Account (to)': r.accountTo || '',
    Balance: formatAmount(r.balance, r.balanceCurrency),
    Category: r.category || '',
    Description: r.description || '',
    'Transaction Type': r.transactionType,
  }))
  const csv = Papa.unparse(csvRows, { columns: csvHeader })
  await fs.writeFile(path.join(OUT_DIR, 'consolidated.csv'), csv, 'utf8')

  // Write raw.json — full normalized rows
  await fs.writeFile(path.join(OUT_DIR, 'raw.json'), JSON.stringify(allRows, null, 2), 'utf8')

  // Inventories
  const accountsOut = Array.from(uniqueAccounts.entries())
    .map(([name, v]) => ({
      name,
      currencies: Array.from(v.currency).sort(),
      firstSeen: v.firstSeen,
      lastSeen: v.lastSeen,
      txnCount: v.count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  await fs.writeFile(path.join(OUT_DIR, 'unique-accounts.json'), JSON.stringify(accountsOut, null, 2), 'utf8')

  const categoriesOut = Array.from(uniqueCategories.entries())
    .map(([name, v]) => ({
      name,
      parent: v.parent,
      child: v.child,
      txnCount: v.count,
      transactionTypes: Array.from(v.sampleTypes).sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  await fs.writeFile(path.join(OUT_DIR, 'unique-categories.json'), JSON.stringify(categoriesOut, null, 2), 'utf8')

  const typesOut = Array.from(uniqueTypes.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
  await fs.writeFile(path.join(OUT_DIR, 'unique-types.json'), JSON.stringify(typesOut, null, 2), 'utf8')

  // Report
  console.log('')
  console.log('=== Consolidation Report ===')
  console.log(`Raw rows read       : ${totalRows}`)
  console.log(`Skipped (bad parse) : ${Object.values(skipReasons).reduce((a, b) => a + b, 0)}`)
  for (const [reason, n] of Object.entries(skipReasons)) console.log(`  - ${reason}: ${n}`)
  console.log(`Duplicates dropped  : ${dupCount}`)
  console.log(`Consolidated rows   : ${allRows.length}`)
  console.log(`Unique accounts     : ${uniqueAccounts.size}`)
  console.log(`Unique categories   : ${uniqueCategories.size}`)
  console.log('')
  console.log(`Transaction types:`)
  for (const t of typesOut) console.log(`  ${t.type.padEnd(20)} ${t.count}`)
  console.log('')
  console.log(`Date range          : ${allRows[0]?.date} → ${allRows[allRows.length - 1]?.date}`)
  console.log('')
  console.log(`Wrote:`)
  console.log(`  ${path.relative(process.cwd(), path.join(OUT_DIR, 'consolidated.csv'))}`)
  console.log(`  ${path.relative(process.cwd(), path.join(OUT_DIR, 'raw.json'))}`)
  console.log(`  ${path.relative(process.cwd(), path.join(OUT_DIR, 'unique-accounts.json'))}`)
  console.log(`  ${path.relative(process.cwd(), path.join(OUT_DIR, 'unique-categories.json'))}`)
  console.log(`  ${path.relative(process.cwd(), path.join(OUT_DIR, 'unique-types.json'))}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
