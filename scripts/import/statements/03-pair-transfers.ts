/**
 * Stage 03 — recognize transfer legs and pair them across accounts.
 *
 * A transfer between two owned accounts shows up in BOTH statements as
 * opposite-direction rows. Description rules mark legs and name the plausible
 * counterparty accounts; pairing then matches out-leg ↔ in-leg within ±4 days
 * by equal amount (same currency) or by a DOP/USD ratio inside FX_BAND
 * (cross-currency — both real amounts are kept, no rate is ever guessed).
 * The out-leg becomes the single transfer row (money-pro convention); the
 * matched in-leg is flagged mergedIntoPair. Unpaired legs still become
 * single-sided transfers against the rule's default counterparty.
 *
 *   npx tsx scripts/import/statements/03-pair-transfers.ts
 */
import { CanonicalTxn, dayDiff, readMapping, readRunJson, writeRunJson } from './lib'

const FX_BAND: [number, number] = [55, 65] // plausible DOP per USD, mid-2026
const MAX_DAY_GAP = 4

interface LegRule {
  account: RegExp
  direction: 'in' | 'out'
  match: RegExp
  /** account.json keys of plausible counterparties; first = default for single-sided legs */
  counters: string[]
  note?: string
}

const LEG_RULES: LegRule[] = [
  { account: /^popular-9652$/, direction: 'out', match: /Transf\. INTERNET a 832238471/i, counters: ['popular-8471'] },
  { account: /^popular-8471$/, direction: 'in', match: /Desde INTERNET/i, counters: ['popular-9652'] },
  { account: /^popular-(9652|8471)$/, direction: 'out', match: /PagoTC Via MB|AUT PAGO\s+\d*4857/i, counters: ['popular-4857-DOP', 'popular-4857-USD'] },
  { account: /^popular-4857-/, direction: 'in', match: /Pago Via App|Pago via CEL|TRASLADO DE BALANCE/i, counters: ['popular-9652', 'popular-8471'] },
  { account: /^bac-9114$/, direction: 'out', match: /^PAGO 4919/i, counters: ['bac-visa-3448'] },
  { account: /^bac-visa-3448$/, direction: 'in', match: /SU PAGO RECIBIDO/i, counters: ['bac-9114'] },
  { account: /^bac-9114$/, direction: 'out', match: /T365 A: FONDO ATLANTIDA DE LIQ/i, counters: ['atlantida-liquidez'] },
  { account: /^bac-9114$/, direction: 'out', match: /T365 A: FONDO ATLANTIDA CRECIM/i, counters: ['atlantida-crecimiento'] },
  {
    account: /^bac-9114$/, direction: 'in', match: /T365 DE: FONDO DE INVERSION AB/i, counters: ['atlantida-liquidez'],
    note: 'statement only says "FONDO DE INVERSION AB…" — assumed Atlántida (Liquidez), confirm',
  },
  { account: /^popular-9652$/, direction: 'in', match: /LBTR .*ALPHA/i, counters: ['alpha-inversiones'] },
  { account: /^popular-9652$/, direction: 'out', match: /Débito ATM|RET DE AHO/i, counters: ['cash-dop'], note: 'ATM withdrawal → Cash DOP wallet' },
  { account: /^bac-9114$/, direction: 'in', match: /DEPOSITO BENITO SURIAN/i, counters: ['cash-usd'], note: 'cash deposit → transfer from Cash USD wallet' },
]

function fxCompatible(a: CanonicalTxn, b: CanonicalTxn): boolean {
  if (a.currency === b.currency) return Math.abs(a.amount - b.amount) < 0.005
  const dop = a.currency === 'DOP' ? a : b
  const usd = a.currency === 'DOP' ? b : a
  const rate = dop.amount / usd.amount
  return rate >= FX_BAND[0] && rate <= FX_BAND[1]
}

async function main() {
  const accounts = await readMapping<Record<string, { accountId: string; name: string }>>('accounts.json')
  const idOf = (key: string) => {
    const e = accounts[key]
    if (!e) throw new Error(`transfer rule references unknown account key ${key}`)
    return e.accountId
  }

  const data = await readRunJson<{ files: unknown[]; rows: CanonicalTxn[] }>('mapped.json')
  interface Leg { row: CanonicalTxn; rule: LegRule; counterIds: string[] }
  const legs: Leg[] = []

  for (const row of data.rows) {
    const rule = LEG_RULES.find((r) => r.account.test(row.statementAccount) && r.direction === row.direction && r.match.test(row.description))
    if (!rule) continue
    legs.push({ row, rule, counterIds: rule.counters.map(idOf) })
    row.inferredType = 'transfer'
    row.categoryId = null
    row.categoryName = null
    // Transfers carry no category, so drop whatever a merchant rule set —
    // including the `[Uncategorized: …]` marker and misleading clean names
    // (e.g. an ATM row matching the "SHELL" gas-station rule).
    row.cleanDescription = row.description
    if (rule.note) (row.notes ??= []).push(rule.note)
  }

  const outLegs = legs.filter((l) => l.row.direction === 'out')
  const inLegs = legs.filter((l) => l.row.direction === 'in')
  const consumed = new Set<string>()
  let pairs = 0

  for (const out of outLegs) {
    const candidates = inLegs
      .filter((inn) =>
        !consumed.has(inn.row.id) &&
        out.counterIds.includes(inn.row.accountId!) &&
        inn.counterIds.includes(out.row.accountId!) &&
        dayDiff(out.row.date, inn.row.date) <= MAX_DAY_GAP &&
        fxCompatible(out.row, inn.row))
      .sort((a, b) =>
        // prefer same-currency exact matches, then closest date
        (Number(a.row.currency !== out.row.currency) - Number(b.row.currency !== out.row.currency)) ||
        (dayDiff(out.row.date, a.row.date) - dayDiff(out.row.date, b.row.date)))
    const match = candidates[0]
    if (match) {
      pairs++
      consumed.add(match.row.id)
      const pairId = `pair:${out.row.id}`
      out.row.transferPairId = pairId
      match.row.transferPairId = pairId
      match.row.mergedIntoPair = true
      out.row.transferCounterAccountId = match.row.accountId
      match.row.transferCounterAccountId = out.row.accountId
      if (match.row.currency !== out.row.currency) {
        out.row.toAmount = match.row.amount
        out.row.toCurrency = match.row.currency
      }
    } else {
      out.row.transferCounterAccountId = out.counterIds[0]
      ;(out.row.notes ??= []).push('single-sided transfer: counterpart statement row not found')
    }
  }
  for (const inn of inLegs) {
    if (consumed.has(inn.row.id)) continue
    inn.row.transferCounterAccountId = inn.counterIds[0]
    ;(inn.row.notes ??= []).push('single-sided transfer: counterpart statement row not found')
  }

  const single = legs.length - pairs * 2
  console.log(`${legs.length} transfer legs → ${pairs} pairs, ${single} single-sided`)
  await writeRunJson('paired.json', data)
}

main().catch((e) => { console.error(e); process.exit(1) })
