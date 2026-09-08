-- Wealth-manager agent: daily balance snapshots (net-worth history) and
-- per-chat conversation memory for the Telegram agent.

-- One row per account per day. balance_usd is frozen at capture time because
-- FX rates are hardcoded in lib/fx.ts and may change later; the historical
-- series must not silently restate when they do.
CREATE TABLE finance.account_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES finance.accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  account_type TEXT NOT NULL,
  balance NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  balance_usd NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, snapshot_date)
);

CREATE INDEX idx_account_balance_snapshots_user_date
  ON finance.account_balance_snapshots(user_id, snapshot_date);

ALTER TABLE finance.account_balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own balance snapshots"
  ON finance.account_balance_snapshots FOR ALL
  USING (auth.uid() = user_id);

-- Text turns only (no tool calls) — the agent re-fetches fresh data on every
-- question, so memory is just conversational continuity.
CREATE TABLE finance.telegram_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_agent_messages_chat_created
  ON finance.telegram_agent_messages(telegram_chat_id, created_at DESC);

ALTER TABLE finance.telegram_agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own agent messages"
  ON finance.telegram_agent_messages FOR ALL
  USING (auth.uid() = user_id);
