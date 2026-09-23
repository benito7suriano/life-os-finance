// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260914020054_asset_portfolio.sql'),
  'utf8'
)
const sameDayMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260914023956_allow_same_day_asset_valuations.sql'),
  'utf8'
)
const activityBackfillMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260914024310_backfill_asset_activity_attribution.sql'),
  'utf8'
)

describe('asset portfolio migration', () => {
  it('creates the normalized asset profile, ownership, valuation, and subtype tables', () => {
    for (const table of [
      'asset_profiles',
      'asset_owners',
      'asset_ownerships',
      'asset_valuations',
      'real_estate_assets',
      'vehicle_assets',
      'private_investment_assets',
      'retirement_assets',
    ]) {
      expect(migration).toContain(`CREATE TABLE finance.${table}`)
      expect(migration).toContain(`ALTER TABLE finance.${table} ENABLE ROW LEVEL SECURITY`)
    }
  })

  it('normalizes legacy classes and backfills profiles without replacing accounts', () => {
    expect(migration).toMatch(/investment_fund'[\s\S]*private_investment/)
    expect(migration).toMatch(/business'[\s\S]*private_investment/)
    expect(migration).toMatch(/pension'[\s\S]*retirement/)
    expect(migration).toMatch(/INSERT INTO finance\.asset_profiles[\s\S]*/)
    expect(migration).not.toMatch(/DELETE FROM finance\.accounts/i)
  })

  it('adds asset attribution to ledger transactions', () => {
    expect(migration).toContain('related_asset_id')
    expect(migration).toContain('asset_activity_kind')
    expect(activityBackfillMigration).toContain("asset_activity_kind = 'capital_contribution'")
    expect(activityBackfillMigration).toContain("asset_activity_kind = 'capital_distribution'")
    expect(activityBackfillMigration).toContain("source_account.type <> 'investment'")
    expect(activityBackfillMigration).toContain("destination_account.type <> 'investment'")
    expect(activityBackfillMigration).not.toMatch(/type = 'income'|type = 'expense'/)
  })

  it('provides atomic creation, ownership replacement, and valuation functions', () => {
    expect(migration).toContain('FUNCTION finance.create_asset(')
    expect(migration).toContain('FUNCTION finance.replace_asset_ownerships(')
    expect(migration).toContain('FUNCTION finance.record_asset_valuation(')
    expect(migration.match(/SECURITY INVOKER/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('uses authenticated owner-scoped policies and indexes RLS columns', () => {
    expect(migration).toContain('TO authenticated')
    expect(migration).toContain('(select auth.uid()) = user_id')
    expect(migration).toMatch(/CREATE INDEX[\s\S]*asset_profiles[\s\S]*user_id/i)
  })

  it('keeps valuations append-only and snapshots ownership', () => {
    expect(migration).toContain('ownership_snapshot JSONB')
    expect(migration).toMatch(/GRANT SELECT, INSERT ON TABLE finance\.asset_valuations TO authenticated/)
    expect(migration).not.toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE[^;]*asset_valuations/)
    expect(sameDayMigration).toContain('DROP CONSTRAINT IF EXISTS asset_valuations_account_id_valued_on_key')
  })
})
