'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { MainNav } from './MainNav'
import { UserMenu } from './UserMenu'
import { TopBar } from './TopBar'
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  PiggyBank,
  Zap,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Circle,
  Gem,
} from 'lucide-react'

export interface NavigationItem {
  label: string
  href: string
  icon?: 'dashboard' | 'transactions' | 'accounts' | 'assets' | 'budgets' | 'automation'
  isActive?: boolean
}

export interface User {
  name: string
  email: string
  avatarUrl?: string
}

export interface AppShellProps {
  children: React.ReactNode
  navigationItems: NavigationItem[]
  user?: User
  onNavigate?: (href: string) => void
  onLogout?: () => void
}

const iconMap = {
  dashboard: LayoutDashboard,
  transactions: Receipt,
  accounts: Wallet,
  assets: Gem,
  budgets: PiggyBank,
  automation: Zap,
}

export function AppShell({ children, navigationItems, user, onNavigate, onLogout }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const navItemsWithIcons = navigationItems.map((item) => ({
    ...item,
    Icon: (item.icon && iconMap[item.icon]) || Circle,
  }))

  const userInitials = user
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar rail */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          transition-all duration-200 ease-in-out
          ${isCollapsed ? 'w-[72px]' : 'w-64'}
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static
        `}
        style={{ background: 'rgba(255,255,255,0.02)', borderRight: '1px solid var(--card-border)' }}
      >
        {/* Header: gradient logo + collapse / close */}
        <div
          className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}
          style={{ height: 76, padding: isCollapsed ? 0 : '0 16px' }}
        >
          <button
            onClick={(e) => {
              e.preventDefault()
              onNavigate?.('/dashboard')
            }}
            className="flex items-center gap-3"
            aria-label="Ledger home"
          >
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'var(--accent-gradient)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0b0d18',
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-display)',
                boxShadow: '0 8px 24px -8px var(--accent-b)',
              }}
            >
              L
            </span>
            {!isCollapsed && (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>Ledger</span>
            )}
          </button>

          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md"
              style={{ color: 'var(--fg3)' }}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          )}

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex lg:hidden h-8 w-8 items-center justify-center rounded-md"
            style={{ color: 'var(--fg3)' }}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto">
          <MainNav
            items={navItemsWithIcons}
            isCollapsed={isCollapsed}
            onNavigate={(href) => {
              onNavigate?.(href)
              setIsMobileMenuOpen(false)
            }}
          />
        </div>

        {/* Expand toggle (desktop, only when collapsed) */}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="hidden lg:flex items-center justify-center"
            style={{ height: 44, width: 48, margin: '0 auto', borderRadius: 14, color: 'var(--fg3)' }}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen size={20} />
          </button>
        )}

        {/* User menu */}
        {user && (
          <div style={{ borderTop: '1px solid var(--card-border)', padding: 12 }}>
            <UserMenu user={user} isCollapsed={isCollapsed} onLogout={onLogout} onNavigate={onNavigate} />
          </div>
        )}
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div
          className="flex lg:hidden items-center"
          style={{ height: 56, padding: '0 16px', borderBottom: '1px solid var(--card-border)' }}
        >
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md"
            style={{ color: 'var(--fg2)' }}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                background: 'var(--accent-gradient)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0b0d18',
                fontWeight: 800,
                fontSize: 13,
                fontFamily: 'var(--font-display)',
              }}
            >
              L
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>Ledger</span>
          </div>
        </div>

        {/* Desktop top bar */}
        <TopBar pathname={pathname} userInitials={userInitials} onNewTransaction={() => onNavigate?.('/transactions')} />

        {/* Page content */}
        <main className="flex-1 overflow-auto" style={{ background: 'var(--bg)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
