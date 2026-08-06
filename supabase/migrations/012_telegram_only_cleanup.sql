-- Automation is Telegram-only; WhatsApp/Email were never wired up. Narrow the
-- constraints and drop their columns. Guarded: refuses to run if legacy rows
-- exist, so it can never orphan real data on any environment.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM finance.transactions WHERE source IN ('whatsapp', 'email')) THEN
    RAISE EXCEPTION 'legacy whatsapp/email transaction rows exist - resolve before narrowing source check';
  END IF;
  IF EXISTS (SELECT 1 FROM finance.automation_channels WHERE type <> 'telegram') THEN
    RAISE EXCEPTION 'non-telegram automation channels exist - resolve before narrowing type check';
  END IF;
END $$;

ALTER TABLE finance.transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE finance.transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'import', 'telegram'));

ALTER TABLE finance.automation_channels
  DROP CONSTRAINT IF EXISTS automation_channels_type_check;
ALTER TABLE finance.automation_channels
  ADD CONSTRAINT automation_channels_type_check
  CHECK (type = 'telegram');

ALTER TABLE finance.automation_channels
  DROP COLUMN IF EXISTS whatsapp_phone_number,
  DROP COLUMN IF EXISTS whatsapp_phone_number_masked,
  DROP COLUMN IF EXISTS email_forwarding_address;
