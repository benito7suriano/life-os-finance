'use client'

import { usePathname, useRouter } from 'next/navigation'
import { AppShell } from '@/components/shell'
import { AuthProvider, useAuth } from '@/lib/auth/context'
import type { NavigationItem } from '@/components/shell'

const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { label: 'Transactions', href: '/transactions', icon: 'transactions' },
  { label: 'Accounts', href: '/accounts', icon: 'accounts' },
  { label: 'Assets', href: '/assets', icon: 'assets' },
  { label: 'Budgets', href: '/budgets', icon: 'budgets' },
  { label: 'Automation', href: '/automation', icon: 'automation' },
]

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, signOut } = useAuth()

  const itemsWithActive = navigationItems.map((item) => ({
    ...item,
    isActive: pathname.startsWith(item.href),
  }))

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div style={{ color: 'var(--fg3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading…</div>
      </div>
    )
  }

  const shellUser = user
    ? {
        name: user.user_metadata?.first_name
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
          : user.email || 'User',
        email: user.email || '',
      }
    : undefined

  return (
    <AppShell
      navigationItems={itemsWithActive}
      user={shellUser}
      onNavigate={(href) => router.push(href)}
      onLogout={signOut}
    >
      {children}
    </AppShell>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AuthProvider>
  )
}
