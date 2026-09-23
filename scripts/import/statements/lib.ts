/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shared helpers for the incremental statement-import pipeline.
 *
 * Unlike the money-pro scripts (which read .env.local → local sandbox), this
 * pipeline targets the HOSTED project: it loads `.env`, which carries the
 * production Supabase URL + service-role key. The target host is printed at
 * startup by every stage that builds clients.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const USER_EMAIL = 'bjsuriano@gmail.com'
/** DB is complete for card accounts through 2026-05-16 (last Money Pro row). */
export const CUTOFF_DATE = '2026-05-17'
export const SOURCE_APP = 'statement-import'

export type Direction = 'in' | 'out'

export interface ParsedFile {
  sourceFile: string
  statementAccount: string
  currency: 'USD' | 'DOP'
  /** Closing balance stated by the file, if any, with its as-of date. */
  closingBalance?: { amount: number; asOf: string }
  rows: CanonicalTxn[]
}

export interface CanonicalTxn {
  /** `${sourceFile}:${line}` — stable within a run. */
  id: string
  sourceFile: string
  statementAccount: string
  date: string // YYYY-MM-DD
  description: string
  amount: number // always positive
  /** Cash-flow from the statement account's perspective. */
  direction: Direction
  currency: 'USD' | 'DOP'
  balanceAfter?: number | null
  // added by 02-map
  accountId?: string
  accountName?: string
  inferredType?: 'expense' | 'income' | 'transfer'
  categoryId?: string | null
  categoryName?: string | null
  cleanDescription?: string
  notes?: string[]
  // added by 03-pair-transfers
  transferCounterAccountId?: string
  transferPairId?: string
  /** true on the leg that was folded into its counterpart's transfer row */
  mergedIntoPair?: boolean
  toAmount?: number | null
  toCurrency?: string | null
  // added by 04-dedup
  dedupStatus?: 'new' | 'db_duplicate' | 'intra_duplicate' | 'needs_review'
  dedupNote?: string
}

// ---------------------------------------------------------------------------
// env + clients (service role, finance schema)
// ---------------------------------------------------------------------------

export async function loadEnv() {
  // repo root is three levels up from scripts/import/statements
  const envPath = path.resolve(__dirname, '..', '..', '..', '.env')
  const text = await fs.readFile(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value // .env wins over anything inherited
  }
}

type AnySupabaseClient = SupabaseClient<any, any, any>

export function buildFinanceClient(): AnySupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase URL / service key missing from .env')
  console.log(`[statements] target: ${new URL(url).host}`)
  return createClient(url, serviceKey, {
    db: { schema: 'finance' },
    auth: { persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// run workdir
// ---------------------------------------------------------------------------

export const RUN_NAME = process.env.STMT_RUN ?? '2026-08-catchup'
export const RUN_DIR = path.resolve(__dirname, 'runs', RUN_NAME)

export async function readRunJson<T>(name: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(RUN_DIR, name), 'utf8')) as T
}

export async function writeRunJson(name: string, data: unknown) {
  await fs.mkdir(RUN_DIR, { recursive: true })
  await fs.writeFile(path.join(RUN_DIR, name), JSON.stringify(data, null, 2))
  console.log(`[statements] wrote runs/${RUN_NAME}/${name}`)
}

export async function readMapping<T>(name: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.resolve(__dirname, 'mappings', name), 'utf8')) as T
}

// ---------------------------------------------------------------------------
// small shared utilities
// ---------------------------------------------------------------------------

export function normDesc(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

export function money(s: string): number {
  return Math.round(parseFloat(s.replace(/,/g, '')) * 100) / 100
}

export function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function dayDiff(a: string, b: string): number {
  return Math.abs(Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) -
    Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))) / 86_400_000
}

/** Exact dedup key (mirrors money-pro/01-consolidate). */
export function exactKey(t: { date: string; amount: number; currency: string; accountId?: string; inferredType?: string }): string {
  return [t.date, t.amount.toFixed(2), t.currency, t.accountId ?? '?', t.inferredType ?? '?'].join('|')
}

/** Loose key: date-window matching handled by caller; this is amount+account. */
export function looseKey(t: { amount: number; accountId?: string }): string {
  return [t.amount.toFixed(2), t.accountId ?? '?'].join('|')
}
