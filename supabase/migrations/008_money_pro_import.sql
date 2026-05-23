-- =============================================================================
-- Money Pro import: schema additions
--
-- 1. New `investment` account type + nullable `asset_class` discriminator for
--    investment funds, businesses, pensions, retirement, real estate, vehicles.
-- 2. Nullable `to_amount` + `to_currency` columns on transactions so
--    cross-currency transfers preserve both legs of the FX.
-- 3. Extend `transactions.source` to include `'import'` so bulk-imported rows
--    are distinguishable from manual / channel-extracted ones.
-- =============================================================================

-- 1. investment account type + asset_class discriminator -----------------------

ALTER TABLE finance.accounts
  DROP CONSTRAINT IF EXISTS accounts_type_check;

ALTER TABLE finance.accounts
  ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('checking', 'savings', 'credit_card', 'loan', 'wallet', 'investment'));

ALTER TABLE finance.accounts
  ADD COLUMN IF NOT EXISTS asset_class TEXT;

ALTER TABLE finance.accounts
  DROP CONSTRAINT IF EXISTS accounts_asset_class_check;
ALTER TABLE finance.accounts
  ADD CONSTRAINT accounts_asset_class_check
  CHECK (
    asset_class IS NULL
    OR asset_class IN (
      'investment_fund',
      'business',
      'pension',
      'retirement',
      'real_estate',
      'vehicle'
    )
  );

ALTER TABLE finance.accounts
  DROP CONSTRAINT IF EXISTS accounts_asset_class_requires_investment;
ALTER TABLE finance.accounts
  ADD CONSTRAINT accounts_asset_class_requires_investment
  CHECK (asset_class IS NULL OR type = 'investment');

-- 2. cross-currency transfer fields -------------------------------------------

ALTER TABLE finance.transactions
  ADD COLUMN IF NOT EXISTS to_amount NUMERIC(14, 2);

ALTER TABLE finance.transactions
  ADD COLUMN IF NOT EXISTS to_currency TEXT;

ALTER TABLE finance.transactions
  DROP CONSTRAINT IF EXISTS transactions_to_amount_requires_transfer;
ALTER TABLE finance.transactions
  ADD CONSTRAINT transactions_to_amount_requires_transfer
  CHECK (
    to_amount IS NULL
    OR (type = 'transfer' AND to_currency IS NOT NULL)
  );

-- 3. extend source enum to track imports cleanly ------------------------------

ALTER TABLE finance.transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;

ALTER TABLE finance.transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'whatsapp', 'email', 'import'));
