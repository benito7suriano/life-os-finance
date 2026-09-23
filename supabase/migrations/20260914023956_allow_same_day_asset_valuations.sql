-- Multiple valuations may share an effective date. created_at provides the
-- deterministic correction order while every record remains append-only.
ALTER TABLE finance.asset_valuations
  DROP CONSTRAINT IF EXISTS asset_valuations_account_id_valued_on_key;
