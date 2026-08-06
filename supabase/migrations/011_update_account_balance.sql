-- Atomic account-balance mutation used by every transaction write path
-- (manual routes + Telegram webhook). Replaces read-modify-write updates in
-- application code, which raced and — on the expense path — called this
-- function before it existed.
--
-- SECURITY INVOKER: authenticated callers go through RLS on finance.accounts
-- (scoped to their own rows); the service-role client (webhook) bypasses RLS.
CREATE OR REPLACE FUNCTION finance.update_account_balance(p_account_id UUID, p_delta NUMERIC)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE finance.accounts SET balance = balance + p_delta WHERE id = p_account_id;
$$;

GRANT EXECUTE ON FUNCTION finance.update_account_balance(UUID, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION finance.update_account_balance(UUID, NUMERIC) FROM anon, public;
