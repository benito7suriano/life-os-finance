-- Pending Telegram transactions
-- Holds the extracted+resolved fields between bot reply and user Confirm tap.
-- Short-lived; cleaned up on Confirm/Cancel or by the expires_at filter.

CREATE TABLE finance.pending_telegram_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES finance.automation_channels(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL,
  telegram_message_id BIGINT NOT NULL,
  -- { extracted: ExtractedTransaction, resolved: ResolvedReferences }
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour')
);

CREATE INDEX idx_pending_tg_tx_chat_msg
  ON finance.pending_telegram_transactions(telegram_chat_id, telegram_message_id);

ALTER TABLE finance.pending_telegram_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own pending tx"
  ON finance.pending_telegram_transactions FOR ALL
  USING (auth.uid() = user_id);
