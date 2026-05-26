-- Add 'telegram' as a valid transaction source for the bot webhook.
-- Migration 008 extended the constraint to include 'import' but omitted
-- 'telegram', causing bot confirms to fail with a check constraint violation.
ALTER TABLE finance.transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE finance.transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'whatsapp', 'email', 'import', 'telegram'));
