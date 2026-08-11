-- Clarification state machine for MoneyPenny pending transactions.
-- status 'clarifying' = bot is asking the user for missing fields;
-- status 'confirming' = all fields resolved, Confirm/Cancel card shown.

ALTER TABLE finance.pending_telegram_transactions
  ADD COLUMN status TEXT NOT NULL DEFAULT 'confirming'
    CHECK (status IN ('clarifying', 'confirming')),
  ADD COLUMN missing_fields TEXT[] NOT NULL DEFAULT '{}';

-- Exactly one active clarification per chat.
CREATE UNIQUE INDEX idx_pending_tg_tx_one_clarifying_per_chat
  ON finance.pending_telegram_transactions (telegram_chat_id)
  WHERE status = 'clarifying';

CREATE INDEX idx_pending_tg_tx_chat_status
  ON finance.pending_telegram_transactions (telegram_chat_id, status);
