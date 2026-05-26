-- finance.automation_channels (was: public.automation_channels)
CREATE TABLE finance.automation_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('whatsapp', 'email', 'telegram')),
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'paused', 'disconnected')),
  connected_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  transactions_logged INTEGER NOT NULL DEFAULT 0,

  -- WhatsApp-specific (kept; harmless if unused)
  whatsapp_phone_number TEXT,
  whatsapp_phone_number_masked TEXT,

  -- Email-specific
  email_forwarding_address TEXT,

  -- Telegram-specific (NEW)
  telegram_chat_id BIGINT,           -- Telegram's numeric chat id
  telegram_username TEXT,            -- @handle for display
  telegram_link_code TEXT,           -- short-lived 6-digit code for /start <code>
  telegram_link_code_expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_channels_user_id
  ON finance.automation_channels(user_id);
CREATE UNIQUE INDEX idx_automation_channels_user_type
  ON finance.automation_channels(user_id, type);
CREATE UNIQUE INDEX idx_automation_channels_telegram_chat
  ON finance.automation_channels(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- RLS: user can only see/modify their own channels
ALTER TABLE finance.automation_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own channels"
  ON finance.automation_channels FOR ALL
  USING (auth.uid() = user_id);

-- Reuse the public.update_updated_at() trigger function from 001_initial_schema.
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON finance.automation_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
