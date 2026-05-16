-- =============================================================================
-- Add soft delete support to accounts
-- =============================================================================

ALTER TABLE accounts ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_accounts_deleted_at ON accounts(deleted_at);
