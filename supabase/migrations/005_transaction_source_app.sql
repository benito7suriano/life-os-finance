-- =============================================================================
-- Add `source_app` to finance.transactions so future Life OS modules and
-- AI agents can identify which app created each row.
-- =============================================================================

ALTER TABLE finance.transactions
ADD COLUMN IF NOT EXISTS source_app text NOT NULL DEFAULT 'financial-ledger';
