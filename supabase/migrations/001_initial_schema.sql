-- =============================================================================
-- Reference Tables (no user dependency)
-- =============================================================================

CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'SV',
  logo TEXT
);

CREATE TABLE credit_card_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL
);

-- =============================================================================
-- Users (extends Supabase auth.users)
-- =============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'es')),
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Accounts
-- =============================================================================

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit_card', 'loan', 'wallet')),
  name TEXT NOT NULL,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Shared optional fields
  beneficiary_name TEXT,
  institution_id UUID REFERENCES institutions(id),
  account_number TEXT,
  currency TEXT DEFAULT 'USD',
  interest_rate NUMERIC(6,4),

  -- Checking-specific
  has_debit_card BOOLEAN,

  -- Credit card-specific
  provider_id UUID REFERENCES credit_card_providers(id),
  last_4_digits TEXT,
  expiration_date TEXT,
  cutoff_date INTEGER,
  payment_date INTEGER,
  credit_limit NUMERIC(12,2),

  -- Loan-specific
  original_amount NUMERIC(12,2),
  payment_amount NUMERIC(12,2),
  payment_frequency TEXT CHECK (payment_frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
  due_day INTEGER,
  term_months INTEGER,
  origination_date DATE,
  maturity_date DATE,

  -- Wallet-specific
  icon TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- =============================================================================
-- Categories
-- =============================================================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  icon TEXT NOT NULL DEFAULT 'circle',
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_user_id ON categories(user_id);

-- =============================================================================
-- Merchants
-- =============================================================================

CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_merchants_user_id ON merchants(user_id);

-- =============================================================================
-- Goals
-- =============================================================================

CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  linked_budget_id UUID, -- FK added after budgets table creation
  linked_account_id UUID NOT NULL REFERENCES accounts(id),
  target_amount NUMERIC(12,2) NOT NULL,
  target_date DATE NOT NULL,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_user_id ON goals(user_id);

-- =============================================================================
-- Budgets
-- =============================================================================

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  type TEXT NOT NULL CHECK (type IN ('monthly', 'sinking_fund')),
  amount NUMERIC(12,2) NOT NULL,
  linked_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budgets_user_id ON budgets(user_id);

-- Add the deferred FK from goals to budgets
ALTER TABLE goals
  ADD CONSTRAINT fk_goals_linked_budget
  FOREIGN KEY (linked_budget_id) REFERENCES budgets(id) ON DELETE SET NULL;

-- =============================================================================
-- Transactions
-- =============================================================================

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  from_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'whatsapp', 'email')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_from_account ON transactions(from_account_id);
CREATE INDEX idx_transactions_to_account ON transactions(to_account_id);

-- =============================================================================
-- Goal Contributions
-- =============================================================================

CREATE TABLE goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_goal_contributions_goal_id ON goal_contributions(goal_id);

-- =============================================================================
-- User Subscriptions
-- =============================================================================

CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_providers ENABLE ROW LEVEL SECURITY;

-- Users: can only see/edit their own row
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Accounts: user can CRUD their own
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Transactions: user can CRUD their own
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Categories: user can see system + own categories
CREATE POLICY "Users can view own and system categories" ON categories
  FOR SELECT USING (is_system = true OR auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories
  FOR UPDATE USING (auth.uid() = user_id AND is_system = false);
CREATE POLICY "Users can delete own categories" ON categories
  FOR DELETE USING (auth.uid() = user_id AND is_system = false);

-- Merchants: user can see global + own merchants
CREATE POLICY "Users can view own and global merchants" ON merchants
  FOR SELECT USING (is_global = true OR auth.uid() = user_id);
CREATE POLICY "Users can insert own merchants" ON merchants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own merchants" ON merchants
  FOR UPDATE USING (auth.uid() = user_id AND is_global = false);
CREATE POLICY "Users can delete own merchants" ON merchants
  FOR DELETE USING (auth.uid() = user_id AND is_global = false);

-- Budgets: user can CRUD their own
CREATE POLICY "Users can view own budgets" ON budgets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON budgets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON budgets
  FOR DELETE USING (auth.uid() = user_id);

-- Goals: user can CRUD their own
CREATE POLICY "Users can view own goals" ON goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals
  FOR DELETE USING (auth.uid() = user_id);

-- Goal contributions: access through goal ownership
CREATE POLICY "Users can view own goal contributions" ON goal_contributions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_contributions.goal_id AND goals.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own goal contributions" ON goal_contributions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_contributions.goal_id AND goals.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own goal contributions" ON goal_contributions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_contributions.goal_id AND goals.user_id = auth.uid())
  );

-- User subscriptions: user can view their own
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reference tables: readable by all authenticated users
CREATE POLICY "Authenticated users can view institutions" ON institutions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view credit card providers" ON credit_card_providers
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- Auto-create user profile on signup (trigger)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON merchants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- Seed reference data
-- =============================================================================

INSERT INTO institutions (id, name, country) VALUES
  (gen_random_uuid(), 'Banco Agricola', 'SV'),
  (gen_random_uuid(), 'Banco Cuscatlan', 'SV'),
  (gen_random_uuid(), 'BAC Credomatic', 'SV');

INSERT INTO credit_card_providers (id, name, icon) VALUES
  (gen_random_uuid(), 'Visa', 'visa'),
  (gen_random_uuid(), 'Mastercard', 'mastercard'),
  (gen_random_uuid(), 'American Express', 'amex');

INSERT INTO categories (id, name, color, icon, type, is_system) VALUES
  (gen_random_uuid(), 'Food & Dining', '#f97316', 'utensils', 'expense', true),
  (gen_random_uuid(), 'Auto & Transportation', '#3b82f6', 'car', 'expense', true),
  (gen_random_uuid(), 'Housing', '#8b5cf6', 'home', 'expense', true),
  (gen_random_uuid(), 'Bills & Utilities', '#ec4899', 'zap', 'expense', true),
  (gen_random_uuid(), 'Shopping', '#14b8a6', 'shopping-bag', 'expense', true),
  (gen_random_uuid(), 'Health & Wellness', '#ef4444', 'heart', 'expense', true),
  (gen_random_uuid(), 'Travel & Lifestyle', '#f59e0b', 'plane', 'expense', true),
  (gen_random_uuid(), 'Income', '#10b981', 'dollar-sign', 'income', true);
