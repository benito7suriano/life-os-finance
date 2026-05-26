# CLAUDE.md — Life OS: Financial Ledger Migration Brief

## Context & Goal

This app (the financial ledger) is being migrated from a **standalone Supabase-connected app** into the first module of a larger personal system called the **Life OS** — a multi-domain personal database that will eventually connect to apps for meditation, health/fitness, calendar/tasks, personal projects, and people/relationships.

The goal of this migration is to introduce an **API layer** between the frontend and Supabase, so that:
- No app ever talks to Supabase directly
- All business logic and future AI agents live in one central place
- Cross-domain insights become possible once other modules are added (e.g. "you have a full day tomorrow and a gift budget remaining — want to send something for Mother's Day?")

---

## Current Architecture

```
Financial Ledger (Next.js frontend)
        ↓  direct Supabase client calls
Supabase: financial-ledger-esa (project ID: ibtcggqdlljrjeaqfwfw)
```

## Target Architecture

```
Financial Ledger (Next.js frontend)
        ↓  calls internal API routes only
/app/api/* (Next.js API layer — all business logic lives here)
        ↓  only layer that touches Supabase
Supabase: financial-ledger-esa (DB, Auth, RLS)
```

---

## Current Database Schema

All tables are in the `public` schema.

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, references auth.users |
| first_name | text | |
| last_name | text | |
| email | text | |
| preferred_language | text | default 'en' |
| subscription_tier | text | default 'free' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `accounts`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| type | text | e.g. 'checking', 'credit', 'loan', 'savings' |
| name | text | |
| balance | numeric | default 0 |
| beneficiary_name | text | nullable |
| institution_id | uuid | FK → institutions.id, nullable |
| account_number | text | nullable |
| currency | text | default 'USD' |
| interest_rate | numeric | nullable |
| has_debit_card | boolean | nullable |
| provider_id | uuid | FK → credit_card_providers.id, nullable |
| last_4_digits | text | nullable |
| expiration_date | text | nullable |
| cutoff_date | integer | nullable |
| payment_date | integer | nullable |
| credit_limit | numeric | nullable |
| original_amount | numeric | nullable |
| payment_amount | numeric | nullable |
| payment_frequency | text | nullable |
| due_day | integer | nullable |
| term_months | integer | nullable |
| origination_date | date | nullable |
| maturity_date | date | nullable |
| icon | text | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `transactions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| type | text | e.g. 'income', 'expense', 'transfer' |
| amount | numeric | |
| description | text | default '' |
| date | date | default CURRENT_DATE |
| from_account_id | uuid | FK → accounts.id, nullable |
| to_account_id | uuid | FK → accounts.id, nullable |
| category_id | uuid | FK → categories.id, nullable |
| merchant_id | uuid | FK → merchants.id, nullable |
| goal_id | uuid | FK → goals.id, nullable |
| source | text | default 'manual' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `categories`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | nullable (null = system category) |
| name | text | |
| parent_id | uuid | self-referencing FK, nullable |
| color | text | default '#64748b' |
| icon | text | default 'circle' |
| type | text | e.g. 'expense', 'income' |
| is_system | boolean | default false |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `budgets`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| category_id | uuid | FK → categories.id |
| type | text | |
| amount | numeric | |
| linked_goal_id | uuid | FK → goals.id, nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `goals`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| name | text | |
| category_id | uuid | FK → categories.id |
| linked_budget_id | uuid | FK → budgets.id, nullable |
| linked_account_id | uuid | FK → accounts.id |
| target_amount | numeric | |
| target_date | date | |
| current_balance | numeric | default 0 |
| status | text | default 'active' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `goal_contributions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| goal_id | uuid | FK → goals.id |
| transaction_id | uuid | FK → transactions.id |
| amount | numeric | |
| date | date | default CURRENT_DATE |
| created_at | timestamptz | |

### `merchants`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | nullable (null = global merchant) |
| name | text | |
| default_category_id | uuid | FK → categories.id, nullable |
| is_global | boolean | default false |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `institutions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| country | text | default 'SV' |
| logo | text | nullable |

### `credit_card_providers`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| icon | text | |

### `user_subscriptions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| tier | text | |
| start_date | date | |
| end_date | date | nullable |
| created_at | timestamptz | |

---

## Migration Tasks

### Task 1 — Audit direct Supabase client usage in the frontend

Find every place in the codebase where `supabase` is imported from the client and used to query data directly (e.g. `supabase.from('transactions').select(...)`, `supabase.auth.getUser()`, etc.).

Create a map of:
- Which file is making the call
- Which table it touches
- What operation it performs (select / insert / update / delete)

This audit is the foundation for all subsequent tasks.

### Task 2 — Create the API route structure

Create the following folder structure under `/app/api/`:

```
/app/api/
  finance/
    accounts/
      route.ts         — GET (list), POST (create)
      [id]/route.ts    — GET (single), PATCH (update), DELETE
    transactions/
      route.ts         — GET (list with filters), POST (create)
      [id]/route.ts    — GET, PATCH, DELETE
    categories/
      route.ts         — GET, POST
      [id]/route.ts    — PATCH, DELETE
    budgets/
      route.ts         — GET, POST
      [id]/route.ts    — PATCH, DELETE
    goals/
      route.ts         — GET, POST
      [id]/route.ts    — PATCH, DELETE
    merchants/
      route.ts         — GET, POST
    summary/
      route.ts         — GET (net worth, monthly totals, budget vs actual)
```

All Supabase access lives exclusively in these route files. The frontend never imports the Supabase client.

### Task 3 — Implement a shared server-side Supabase client

Create `/lib/supabase/server.ts` that exports a function returning a server-side Supabase client (using `createServerClient` from `@supabase/ssr` or equivalent). This is the only place the Supabase client is instantiated for data operations.

### Task 4 — Implement a shared API client for the frontend

Create `/lib/api/client.ts` that exports typed fetch wrappers the frontend uses to call the internal API routes. Example:

```typescript
export async function getTransactions(filters?: TransactionFilters) {
  const res = await fetch('/api/finance/transactions?' + new URLSearchParams(filters))
  if (!res.ok) throw new Error('Failed to fetch transactions')
  return res.json() as Promise<Transaction[]>
}
```

This replaces all direct `supabase.from(...)` calls in frontend components.

### Task 5 — Migrate frontend components

For each direct Supabase call found in Task 1, replace it with the corresponding function from `/lib/api/client.ts`.

Preserve all existing functionality — no UI changes in this migration.

### Task 6 — Prepare the schema for multi-domain expansion

Add a `domain` column (or equivalent schema namespace) concept so future tables from other Life OS modules (health, meditation, people, etc.) can coexist cleanly in the same Supabase project without table name collisions.

Recommended approach: use **PostgreSQL schemas** to namespace by domain.

Migration to apply:
```sql
-- Create domain schemas for future Life OS modules
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS health;
CREATE SCHEMA IF NOT EXISTS meditation;
CREATE SCHEMA IF NOT EXISTS people;
CREATE SCHEMA IF NOT EXISTS projects;

-- Move existing finance tables into the finance schema
-- (do this table by table and update all references)
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

-- Keep users in public (shared across all domains)
-- public.users remains the central identity table
```

⚠️ After moving tables to the `finance` schema, update:
- All foreign key references
- All RLS policies
- All Supabase client queries in the new API routes
- Supabase `search_path` setting if needed

### Task 7 — Add a `source_app` field to transactions

Future AI agents will need to know which app or integration created a transaction. Add this to the `finance.transactions` table:

```sql
ALTER TABLE finance.transactions
ADD COLUMN source_app text NOT NULL DEFAULT 'financial-ledger';
```

---

## Constraints & Rules

- **Never expose the Supabase client to the frontend.** All DB access goes through `/app/api/*` routes.
- **Auth is still handled by Supabase Auth.** The server-side client reads the session from cookies. Do not bypass RLS.
- **No UI changes in this migration.** This is a pure infrastructure refactor — the user experience must be identical before and after.
- **Preserve all existing RLS policies.** Do not drop or alter them; only add new ones if new tables are created.
- **TypeScript types must stay in sync.** After schema changes, regenerate types with `supabase gen types typescript`.

---

## Future Modules (for awareness, not action now)

Once this migration is complete, the following modules will be added to the same Supabase project under their respective schemas:

| Domain | Schema | Example tables |
|---|---|---|
| Meditation | `meditation` | sessions, streaks, programs |
| Health & Fitness | `health` | workouts, sleep, nutrition |
| Calendar & Tasks | `calendar` | events, tasks, reminders |
| People | `people` | contacts, relationships, occasions |
| Personal Projects | `projects` | projects, milestones, items |

All will share `public.users` as the central identity table and route through `/app/api/` following the same pattern established in this migration.
