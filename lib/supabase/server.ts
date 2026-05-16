import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function buildClient(schema?: 'finance') {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
      ...(schema ? { db: { schema } } : {}),
    }
  )
}

// Default client — queries resolve against the `public` schema.
// Use for auth-only flows or to access shared tables like `public.users`.
export async function createClient() {
  return buildClient()
}

// Finance-scoped client — `.from('transactions')` resolves to
// `finance.transactions`. Auth methods continue to work normally.
// Use inside `/app/api/finance/*` route handlers.
export async function createFinanceClient() {
  return buildClient('finance')
}
