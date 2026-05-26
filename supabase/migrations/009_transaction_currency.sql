-- =============================================================================
-- Transaction currency: make transactions self-describing
--
-- Until now a transaction's currency was *inferred* from its source/destination
-- account at read time (the fragile `txCurrency()` helper). That inference is
-- duplicated across the summary + budgets routes and is easy to get wrong.
--
-- Store the currency on the row itself, denormalized from the account that the
-- money moved out of / into at write time. The API can then convert to USD at a
-- single seam and every view sums a precomputed `*Usd` field.
--
-- `to_amount` / `to_currency` (migration 008) already capture the destination
-- leg of a cross-currency transfer; this migration only adds the source-leg
-- `currency`.
-- =============================================================================

ALTER TABLE finance.transactions
  ADD COLUMN IF NOT EXISTS currency TEXT;

-- Backfill from the account the money moved out of (expense / transfer source)
-- or into (income), falling back to USD.
UPDATE finance.transactions t
SET currency = COALESCE(
  (SELECT a.currency FROM finance.accounts a WHERE a.id = t.from_account_id),
  (SELECT a.currency FROM finance.accounts a WHERE a.id = t.to_account_id),
  'USD'
)
WHERE t.currency IS NULL;

ALTER TABLE finance.transactions
  ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE finance.transactions
  ALTER COLUMN currency SET NOT NULL;
