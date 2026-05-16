-- =============================================================================
-- Budget Monthly Snapshots
-- =============================================================================

CREATE TABLE budget_monthly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  budgeted_amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_budget_snapshots_budget_month ON budget_monthly_snapshots(budget_id, month);
CREATE INDEX idx_budget_snapshots_user_month ON budget_monthly_snapshots(user_id, month);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE budget_monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget snapshots" ON budget_monthly_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budget snapshots" ON budget_monthly_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budget snapshots" ON budget_monthly_snapshots
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budget snapshots" ON budget_monthly_snapshots
  FOR DELETE USING (auth.uid() = user_id);
