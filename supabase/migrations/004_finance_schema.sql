-- =============================================================================
-- Life OS: Move finance tables into a dedicated `finance` schema.
-- Reserve schemas for future modules. Keep `public.users` as shared identity.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS health;
CREATE SCHEMA IF NOT EXISTS meditation;
CREATE SCHEMA IF NOT EXISTS people;
CREATE SCHEMA IF NOT EXISTS projects;
CREATE SCHEMA IF NOT EXISTS calendar;

-- Move existing finance tables. RLS policies, FKs, indexes, and triggers
-- follow the table automatically when SET SCHEMA is used.
ALTER TABLE public.accounts SET SCHEMA finance;
ALTER TABLE public.transactions SET SCHEMA finance;
ALTER TABLE public.categories SET SCHEMA finance;
ALTER TABLE public.budgets SET SCHEMA finance;
ALTER TABLE public.goals SET SCHEMA finance;
ALTER TABLE public.goal_contributions SET SCHEMA finance;
ALTER TABLE public.merchants SET SCHEMA finance;
ALTER TABLE public.institutions SET SCHEMA finance;
ALTER TABLE public.credit_card_providers SET SCHEMA finance;
ALTER TABLE public.user_subscriptions SET SCHEMA finance;
ALTER TABLE public.budget_monthly_snapshots SET SCHEMA finance;

-- Grant PostgREST roles access to the new schema.
GRANT USAGE ON SCHEMA finance TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA finance TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA finance TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA finance TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- NOTE: After this migration is applied, the `finance` schema must also be
-- added to the Exposed Schemas list in Supabase Studio:
--   Settings → API → Exposed schemas → add "finance"
-- The supabase-js client then resolves `.schema('finance').from(...)` correctly.
