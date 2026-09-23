-- Only transfers with exactly one investment leg are unambiguous capital
-- activity. Imported income and expenses intentionally remain unclassified.
UPDATE finance.transactions transaction
SET related_asset_id = transaction.to_account_id,
    asset_activity_kind = 'capital_contribution'
FROM finance.accounts source_account,
     finance.accounts asset_account
WHERE transaction.type = 'transfer'
  AND transaction.related_asset_id IS NULL
  AND source_account.id = transaction.from_account_id
  AND asset_account.id = transaction.to_account_id
  AND source_account.user_id = transaction.user_id
  AND asset_account.user_id = transaction.user_id
  AND source_account.type <> 'investment'
  AND asset_account.type = 'investment';

UPDATE finance.transactions transaction
SET related_asset_id = transaction.from_account_id,
    asset_activity_kind = 'capital_distribution'
FROM finance.accounts asset_account,
     finance.accounts destination_account
WHERE transaction.type = 'transfer'
  AND transaction.related_asset_id IS NULL
  AND asset_account.id = transaction.from_account_id
  AND destination_account.id = transaction.to_account_id
  AND asset_account.user_id = transaction.user_id
  AND destination_account.user_id = transaction.user_id
  AND asset_account.type = 'investment'
  AND destination_account.type <> 'investment';
