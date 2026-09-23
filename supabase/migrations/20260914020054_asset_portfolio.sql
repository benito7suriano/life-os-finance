-- Asset portfolio: typed profiles, ownership, valuations, and ledger attribution.

ALTER TABLE finance.accounts DROP CONSTRAINT IF EXISTS accounts_asset_class_requires_investment;
ALTER TABLE finance.accounts DROP CONSTRAINT IF EXISTS accounts_asset_class_check;

CREATE TABLE finance.asset_profiles (
  account_id UUID PRIMARY KEY REFERENCES finance.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);

CREATE TABLE finance.asset_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  owner_type TEXT NOT NULL DEFAULT 'person'
    CHECK (owner_type IN ('person', 'company', 'trust', 'other')),
  include_in_net_worth BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX asset_owners_active_name_key
  ON finance.asset_owners (user_id, lower(name))
  WHERE archived_at IS NULL;

CREATE TABLE finance.asset_ownerships (
  asset_account_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  percentage NUMERIC(7,4) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_account_id, owner_id),
  FOREIGN KEY (asset_account_id, user_id)
    REFERENCES finance.asset_profiles(account_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, user_id)
    REFERENCES finance.asset_owners(id, user_id) ON DELETE RESTRICT
);

CREATE TABLE finance.asset_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  valued_on DATE NOT NULL,
  total_value NUMERIC(14,2) NOT NULL CHECK (total_value >= 0),
  included_ownership_percentage NUMERIC(7,4) NOT NULL
    CHECK (included_ownership_percentage >= 0 AND included_ownership_percentage <= 100),
  net_worth_value NUMERIC(14,2) NOT NULL CHECK (net_worth_value >= 0),
  ownership_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  currency TEXT NOT NULL,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (account_id, user_id)
    REFERENCES finance.asset_profiles(account_id, user_id) ON DELETE CASCADE,
  UNIQUE (account_id, valued_on)
);

CREATE TABLE finance.real_estate_assets (
  account_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  property_type TEXT,
  primary_residence BOOLEAN NOT NULL DEFAULT false,
  purchase_price NUMERIC(14,2) CHECK (purchase_price IS NULL OR purchase_price >= 0),
  purchase_date DATE,
  street TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT,
  FOREIGN KEY (account_id, user_id)
    REFERENCES finance.asset_profiles(account_id, user_id) ON DELETE CASCADE
);

CREATE TABLE finance.vehicle_assets (
  account_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vin TEXT,
  make TEXT,
  model TEXT,
  year INTEGER CHECK (year IS NULL OR year BETWEEN 1886 AND 2200),
  purchase_price NUMERIC(14,2) CHECK (purchase_price IS NULL OR purchase_price >= 0),
  purchase_date DATE,
  current_mileage NUMERIC(12,1) CHECK (current_mileage IS NULL OR current_mileage >= 0),
  mileage_as_of DATE,
  FOREIGN KEY (account_id, user_id)
    REFERENCES finance.asset_profiles(account_id, user_id) ON DELETE CASCADE
);

CREATE TABLE finance.private_investment_assets (
  account_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  investment_type TEXT,
  investment_name TEXT,
  company_name TEXT,
  company_description TEXT,
  website TEXT,
  investment_date DATE,
  cost_basis NUMERIC(14,2) CHECK (cost_basis IS NULL OR cost_basis >= 0),
  shares_or_units NUMERIC(20,6) CHECK (shares_or_units IS NULL OR shares_or_units >= 0),
  unit_label TEXT,
  FOREIGN KEY (account_id, user_id)
    REFERENCES finance.asset_profiles(account_id, user_id) ON DELETE CASCADE
);

CREATE TABLE finance.retirement_assets (
  account_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_type TEXT,
  plan_name TEXT,
  provider_name TEXT,
  account_reference_last4 TEXT
    CHECK (account_reference_last4 IS NULL OR account_reference_last4 ~ '^[A-Za-z0-9]{1,4}$'),
  start_date DATE,
  contribution_amount NUMERIC(14,2)
    CHECK (contribution_amount IS NULL OR contribution_amount >= 0),
  contribution_frequency TEXT
    CHECK (contribution_frequency IS NULL OR contribution_frequency IN
      ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
  target_retirement_date DATE,
  FOREIGN KEY (account_id, user_id)
    REFERENCES finance.asset_profiles(account_id, user_id) ON DELETE CASCADE
);

ALTER TABLE finance.transactions
  ADD COLUMN related_asset_id UUID REFERENCES finance.accounts(id) ON DELETE SET NULL,
  ADD COLUMN asset_activity_kind TEXT;

ALTER TABLE finance.transactions
  ADD CONSTRAINT transactions_asset_activity_check CHECK (
    (related_asset_id IS NULL AND asset_activity_kind IS NULL)
    OR (
      related_asset_id IS NOT NULL
      AND (
        (type = 'transfer' AND asset_activity_kind IN ('capital_contribution', 'capital_distribution'))
        OR (type = 'income' AND asset_activity_kind IN ('dividend', 'interest', 'rent', 'other_income'))
        OR (type = 'expense' AND asset_activity_kind IN ('fee', 'tax', 'insurance', 'maintenance', 'other_expense'))
      )
    )
  );

CREATE INDEX asset_profiles_user_id_idx ON finance.asset_profiles(user_id);
CREATE INDEX asset_owners_user_id_idx ON finance.asset_owners(user_id);
CREATE INDEX asset_ownerships_user_id_idx ON finance.asset_ownerships(user_id);
CREATE INDEX asset_ownerships_owner_id_idx ON finance.asset_ownerships(owner_id);
CREATE INDEX asset_valuations_user_id_idx ON finance.asset_valuations(user_id);
CREATE INDEX asset_valuations_account_date_idx
  ON finance.asset_valuations(account_id, valued_on DESC, created_at DESC);
CREATE INDEX real_estate_assets_user_id_idx ON finance.real_estate_assets(user_id);
CREATE INDEX vehicle_assets_user_id_idx ON finance.vehicle_assets(user_id);
CREATE INDEX private_investment_assets_user_id_idx ON finance.private_investment_assets(user_id);
CREATE INDEX retirement_assets_user_id_idx ON finance.retirement_assets(user_id);
CREATE INDEX transactions_related_asset_idx
  ON finance.transactions(user_id, related_asset_id, date DESC)
  WHERE related_asset_id IS NOT NULL;

ALTER TABLE finance.asset_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.asset_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.asset_ownerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.asset_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.real_estate_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.vehicle_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.private_investment_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.retirement_assets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE finance.asset_profiles, finance.asset_owners,
  finance.asset_ownerships, finance.asset_valuations,
  finance.real_estate_assets, finance.vehicle_assets,
  finance.private_investment_assets, finance.retirement_assets
  FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE finance.asset_profiles,
  finance.asset_owners, finance.asset_ownerships,
  finance.real_estate_assets, finance.vehicle_assets,
  finance.private_investment_assets, finance.retirement_assets
  TO authenticated;

-- Valuation history is append-only for application users.
GRANT SELECT, INSERT ON TABLE finance.asset_valuations TO authenticated;

GRANT ALL ON TABLE finance.asset_profiles, finance.asset_owners,
  finance.asset_ownerships, finance.asset_valuations,
  finance.real_estate_assets, finance.vehicle_assets,
  finance.private_investment_assets, finance.retirement_assets
  TO service_role;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'asset_profiles', 'asset_owners', 'asset_ownerships', 'asset_valuations',
    'real_estate_assets', 'vehicle_assets', 'private_investment_assets',
    'retirement_assets'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON finance.%I FOR SELECT TO authenticated USING ((select auth.uid()) = user_id)',
      table_name || '_select_own', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON finance.%I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id)',
      table_name || '_insert_own', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON finance.%I FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)',
      table_name || '_update_own', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON finance.%I FOR DELETE TO authenticated USING ((select auth.uid()) = user_id)',
      table_name || '_delete_own', table_name
    );
  END LOOP;
END;
$$;

-- Ownership totals are enforced at transaction commit. Multi-owner replacement
-- happens inside one RPC, so intermediate partial totals are never observed.
CREATE OR REPLACE FUNCTION finance.check_asset_ownership_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_account_id UUID := COALESCE(NEW.asset_account_id, OLD.asset_account_id);
  ownership_total NUMERIC;
BEGIN
  SELECT COALESCE(sum(percentage), 0)
    INTO ownership_total
    FROM finance.asset_ownerships
   WHERE asset_account_id = target_account_id;

  IF EXISTS (SELECT 1 FROM finance.asset_profiles WHERE account_id = target_account_id)
     AND abs(ownership_total - 100) > 0.001 THEN
    RAISE EXCEPTION 'Ownership allocations must total 100%%';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER asset_ownership_total_check
AFTER INSERT OR UPDATE OR DELETE ON finance.asset_ownerships
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION finance.check_asset_ownership_total();

CREATE OR REPLACE FUNCTION finance.check_asset_profile_has_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  ownership_total NUMERIC;
BEGIN
  SELECT COALESCE(sum(percentage), 0) INTO ownership_total
  FROM finance.asset_ownerships WHERE asset_account_id = NEW.account_id;
  IF abs(ownership_total - 100) > 0.001 THEN
    RAISE EXCEPTION 'Ownership allocations must total 100%%';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER asset_profile_ownership_check
AFTER INSERT ON finance.asset_profiles
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION finance.check_asset_profile_has_ownership();

-- Backfill typed profiles while the legacy discriminator is still available.
INSERT INTO finance.asset_profiles (account_id, user_id)
SELECT id, user_id FROM finance.accounts WHERE type = 'investment'
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO finance.asset_owners (user_id, name, owner_type, include_in_net_worth)
SELECT DISTINCT a.user_id, 'Beno', 'person', true
FROM finance.accounts a
WHERE a.type = 'investment'
  AND NOT EXISTS (
    SELECT 1 FROM finance.asset_owners o
    WHERE o.user_id = a.user_id AND lower(o.name) = 'beno' AND o.archived_at IS NULL
  );

INSERT INTO finance.asset_ownerships (asset_account_id, owner_id, user_id, percentage)
SELECT a.id, o.id, a.user_id, 100
FROM finance.accounts a
JOIN finance.asset_owners o
  ON o.user_id = a.user_id AND lower(o.name) = 'beno' AND o.archived_at IS NULL
WHERE a.type = 'investment'
ON CONFLICT (asset_account_id, owner_id) DO NOTHING;

INSERT INTO finance.real_estate_assets (account_id, user_id)
SELECT id, user_id FROM finance.accounts
WHERE type = 'investment' AND asset_class = 'real_estate'
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO finance.vehicle_assets (account_id, user_id)
SELECT id, user_id FROM finance.accounts
WHERE type = 'investment' AND asset_class = 'vehicle'
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO finance.private_investment_assets (account_id, user_id, investment_type, investment_name)
SELECT id, user_id,
  CASE asset_class WHEN 'investment_fund' THEN 'fund' WHEN 'business' THEN 'business' END,
  name
FROM finance.accounts
WHERE type = 'investment' AND asset_class IN ('investment_fund', 'business')
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO finance.retirement_assets (account_id, user_id, plan_type, plan_name)
SELECT id, user_id,
  CASE asset_class WHEN 'pension' THEN 'pension' ELSE 'retirement_account' END,
  name
FROM finance.accounts
WHERE type = 'investment' AND asset_class IN ('pension', 'retirement')
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO finance.asset_valuations (
  account_id, user_id, valued_on, total_value,
  included_ownership_percentage, net_worth_value, ownership_snapshot,
  currency, source, notes
)
SELECT a.id, a.user_id, CURRENT_DATE, GREATEST(a.balance, 0), 100,
  GREATEST(a.balance, 0), jsonb_build_array(jsonb_build_object(
    'ownerId', o.id, 'ownerName', o.name, 'percentage', 100,
    'includeInNetWorth', o.include_in_net_worth
  )), COALESCE(a.currency, 'USD'),
  'Opening ledger balance', 'Created by the asset portfolio migration'
FROM finance.accounts a
JOIN finance.asset_owners o ON o.user_id = a.user_id AND lower(o.name) = 'beno' AND o.archived_at IS NULL
WHERE a.type = 'investment'
ON CONFLICT (account_id, valued_on) DO NOTHING;

UPDATE finance.accounts
SET asset_class = CASE
  WHEN asset_class IN ('investment_fund', 'business') THEN 'private_investment'
  WHEN asset_class IN ('pension', 'retirement') THEN 'retirement'
  ELSE asset_class
END
WHERE type = 'investment';

ALTER TABLE finance.accounts
  ADD CONSTRAINT accounts_asset_class_check CHECK (
    asset_class IS NULL OR asset_class IN
      ('real_estate', 'vehicle', 'private_investment', 'retirement')
  );

ALTER TABLE finance.accounts
  ADD CONSTRAINT accounts_asset_class_requires_investment
  CHECK (asset_class IS NULL OR type = 'investment');

CREATE OR REPLACE FUNCTION finance.record_asset_valuation(
  p_account_id UUID,
  p_total_value NUMERIC,
  p_valued_on DATE,
  p_source TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS finance.asset_valuations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_user_id UUID := auth.uid();
  account_currency TEXT;
  included_percentage NUMERIC;
  ownership_snapshot JSONB;
  new_valuation finance.asset_valuations;
BEGIN
  IF target_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_total_value < 0 THEN RAISE EXCEPTION 'Valuation must be zero or greater'; END IF;

  SELECT currency INTO account_currency
  FROM finance.accounts
  WHERE id = p_account_id AND user_id = target_user_id
    AND type = 'investment' AND deleted_at IS NULL;
  IF account_currency IS NULL THEN RAISE EXCEPTION 'Asset not found'; END IF;

  IF p_valued_on < COALESCE(
    (SELECT max(valued_on) FROM finance.asset_valuations WHERE account_id = p_account_id),
    p_valued_on
  ) THEN
    RAISE EXCEPTION 'Valuation date cannot precede the latest valuation';
  END IF;

  SELECT COALESCE(sum(os.percentage) FILTER (WHERE o.include_in_net_worth), 0)
    INTO included_percentage
  FROM finance.asset_ownerships os
  JOIN finance.asset_owners o ON o.id = os.owner_id
  WHERE os.asset_account_id = p_account_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'ownerId', o.id, 'ownerName', o.name, 'percentage', os.percentage,
    'includeInNetWorth', o.include_in_net_worth
  ) ORDER BY o.name), '[]'::jsonb)
    INTO ownership_snapshot
  FROM finance.asset_ownerships os
  JOIN finance.asset_owners o ON o.id = os.owner_id
  WHERE os.asset_account_id = p_account_id;

  INSERT INTO finance.asset_valuations (
    account_id, user_id, valued_on, total_value,
    included_ownership_percentage, net_worth_value, ownership_snapshot,
    currency, source, notes
  ) VALUES (
    p_account_id, target_user_id, p_valued_on, p_total_value,
    included_percentage, round(p_total_value * included_percentage / 100, 2),
    ownership_snapshot, account_currency, NULLIF(trim(p_source), ''), NULLIF(trim(p_notes), '')
  ) RETURNING * INTO new_valuation;

  UPDATE finance.accounts
  SET balance = new_valuation.net_worth_value, updated_at = now()
  WHERE id = p_account_id AND user_id = target_user_id;

  RETURN new_valuation;
END;
$$;

CREATE OR REPLACE FUNCTION finance.replace_asset_ownerships(
  p_account_id UUID,
  p_owners JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_user_id UUID := auth.uid();
  supplied_total NUMERIC;
  supplied_count INTEGER;
  included_percentage NUMERIC;
  latest_total NUMERIC;
BEGIN
  IF target_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM finance.asset_profiles
    WHERE account_id = p_account_id AND user_id = target_user_id
  ) THEN RAISE EXCEPTION 'Asset not found'; END IF;

  SELECT count(*), COALESCE(sum((item->>'percentage')::numeric), 0)
    INTO supplied_count, supplied_total
  FROM jsonb_array_elements(p_owners) item;
  IF supplied_count = 0 OR abs(supplied_total - 100) > 0.001 THEN
    RAISE EXCEPTION 'Ownership allocations must total 100%%';
  END IF;
  IF supplied_count <> (
    SELECT count(DISTINCT item->>'ownerId') FROM jsonb_array_elements(p_owners) item
  ) THEN RAISE EXCEPTION 'Each owner can appear only once'; END IF;
  IF supplied_count <> (
    SELECT count(*) FROM finance.asset_owners o
    WHERE o.user_id = target_user_id AND o.archived_at IS NULL
      AND o.id IN (SELECT (item->>'ownerId')::uuid FROM jsonb_array_elements(p_owners) item)
  ) THEN RAISE EXCEPTION 'Owner not found'; END IF;

  DELETE FROM finance.asset_ownerships
  WHERE asset_account_id = p_account_id AND user_id = target_user_id;
  INSERT INTO finance.asset_ownerships (asset_account_id, owner_id, user_id, percentage)
  SELECT p_account_id, (item->>'ownerId')::uuid, target_user_id,
    (item->>'percentage')::numeric
  FROM jsonb_array_elements(p_owners) item;

  SELECT COALESCE(sum(os.percentage) FILTER (WHERE o.include_in_net_worth), 0)
    INTO included_percentage
  FROM finance.asset_ownerships os
  JOIN finance.asset_owners o ON o.id = os.owner_id
  WHERE os.asset_account_id = p_account_id;

  SELECT total_value INTO latest_total
  FROM finance.asset_valuations
  WHERE account_id = p_account_id
  ORDER BY valued_on DESC, created_at DESC LIMIT 1;

  IF latest_total IS NOT NULL THEN
    UPDATE finance.accounts
    SET balance = round(latest_total * included_percentage / 100, 2), updated_at = now()
    WHERE id = p_account_id AND user_id = target_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION finance.create_asset(
  p_name TEXT,
  p_category TEXT,
  p_currency TEXT,
  p_notes TEXT,
  p_current_value NUMERIC,
  p_valued_on DATE,
  p_valuation_source TEXT,
  p_owners JSONB,
  p_details JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_user_id UUID := auth.uid();
  new_account_id UUID;
BEGIN
  IF target_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF trim(COALESCE(p_name, '')) = '' THEN RAISE EXCEPTION 'Asset name is required'; END IF;
  IF p_category NOT IN ('real_estate', 'vehicle', 'private_investment', 'retirement') THEN
    RAISE EXCEPTION 'Unsupported asset category';
  END IF;
  IF trim(COALESCE(p_currency, '')) = '' THEN RAISE EXCEPTION 'Currency is required'; END IF;
  IF p_current_value < 0 THEN RAISE EXCEPTION 'Current value must be zero or greater'; END IF;

  INSERT INTO finance.accounts (user_id, type, name, balance, currency, asset_class)
  VALUES (target_user_id, 'investment', trim(p_name), 0, upper(trim(p_currency)), p_category)
  RETURNING id INTO new_account_id;

  INSERT INTO finance.asset_profiles (account_id, user_id, notes)
  VALUES (new_account_id, target_user_id, NULLIF(trim(p_notes), ''));

  IF p_category = 'real_estate' THEN
    INSERT INTO finance.real_estate_assets (
      account_id, user_id, property_type, primary_residence, purchase_price,
      purchase_date, street, city, state_province, postal_code, country
    ) VALUES (
      new_account_id, target_user_id, NULLIF(trim(p_details->>'propertyType'), ''),
      COALESCE((p_details->>'primaryResidence')::boolean, false),
      NULLIF(p_details->>'purchasePrice', '')::numeric,
      NULLIF(p_details->>'purchaseDate', '')::date,
      NULLIF(trim(p_details->>'street'), ''), NULLIF(trim(p_details->>'city'), ''),
      NULLIF(trim(p_details->>'stateProvince'), ''), NULLIF(trim(p_details->>'postalCode'), ''),
      NULLIF(trim(p_details->>'country'), '')
    );
  ELSIF p_category = 'vehicle' THEN
    INSERT INTO finance.vehicle_assets (
      account_id, user_id, vin, make, model, year, purchase_price,
      purchase_date, current_mileage, mileage_as_of
    ) VALUES (
      new_account_id, target_user_id, NULLIF(trim(p_details->>'vin'), ''),
      NULLIF(trim(p_details->>'make'), ''), NULLIF(trim(p_details->>'model'), ''),
      NULLIF(p_details->>'year', '')::integer,
      NULLIF(p_details->>'purchasePrice', '')::numeric,
      NULLIF(p_details->>'purchaseDate', '')::date,
      NULLIF(p_details->>'currentMileage', '')::numeric,
      NULLIF(p_details->>'mileageAsOf', '')::date
    );
  ELSIF p_category = 'private_investment' THEN
    INSERT INTO finance.private_investment_assets (
      account_id, user_id, investment_type, investment_name, company_name,
      company_description, website, investment_date, cost_basis,
      shares_or_units, unit_label
    ) VALUES (
      new_account_id, target_user_id, NULLIF(trim(p_details->>'investmentType'), ''),
      NULLIF(trim(p_details->>'investmentName'), ''), NULLIF(trim(p_details->>'companyName'), ''),
      NULLIF(trim(p_details->>'companyDescription'), ''), NULLIF(trim(p_details->>'website'), ''),
      NULLIF(p_details->>'investmentDate', '')::date,
      NULLIF(p_details->>'costBasis', '')::numeric,
      NULLIF(p_details->>'sharesOrUnits', '')::numeric,
      NULLIF(trim(p_details->>'unitLabel'), '')
    );
  ELSE
    INSERT INTO finance.retirement_assets (
      account_id, user_id, plan_type, plan_name, provider_name,
      account_reference_last4, start_date, contribution_amount,
      contribution_frequency, target_retirement_date
    ) VALUES (
      new_account_id, target_user_id, NULLIF(trim(p_details->>'planType'), ''),
      NULLIF(trim(p_details->>'planName'), ''), NULLIF(trim(p_details->>'providerName'), ''),
      NULLIF(trim(p_details->>'accountReferenceLast4'), ''),
      NULLIF(p_details->>'startDate', '')::date,
      NULLIF(p_details->>'contributionAmount', '')::numeric,
      NULLIF(trim(p_details->>'contributionFrequency'), ''),
      NULLIF(p_details->>'targetRetirementDate', '')::date
    );
  END IF;

  PERFORM finance.replace_asset_ownerships(new_account_id, p_owners);
  PERFORM finance.record_asset_valuation(
    new_account_id, p_current_value, p_valued_on,
    COALESCE(NULLIF(trim(p_valuation_source), ''), 'Opening value'), NULL
  );

  RETURN new_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION finance.record_asset_valuation(UUID, NUMERIC, DATE, TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION finance.replace_asset_ownerships(UUID, JSONB)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION finance.create_asset(TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE, TEXT, JSONB, JSONB)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION finance.record_asset_valuation(UUID, NUMERIC, DATE, TEXT, TEXT)
  FROM anon, public;
REVOKE EXECUTE ON FUNCTION finance.replace_asset_ownerships(UUID, JSONB)
  FROM anon, public;
REVOKE EXECUTE ON FUNCTION finance.create_asset(TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE, TEXT, JSONB, JSONB)
  FROM anon, public;
