'use client'

import { Search, Plus, Bell } from 'lucide-react'
import { Input, Button, IconButton, Avatar } from '@/components/ui'

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transactions',
  '/accounts': 'Accounts',
  '/assets': 'Assets',
  '/budgets': 'Budgets',
  '/automation': 'Automation',
  '/settings': 'Settings',
}

function titleFor(pathname: string): string {
  const match = Object.keys(ROUTE_TITLES).find((href) => pathname.startsWith(href))
  return match ? ROUTE_TITLES[match] : 'Ledger'
}

export interface TopBarProps {
  pathname: string
  userInitials: string
  onNewTransaction?: () => void
}

export function TopBar({ pathname, userInitials, onNewTransaction }: TopBarProps) {
  const today = new Date().toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <header
      className="hidden lg:flex items-center gap-3.5"
      style={{ padding: '20px 32px 20px 24px', borderBottom: '1px solid var(--card-border)' }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            lineHeight: 1,
            color: 'var(--fg3)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {today}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 600,
            lineHeight: 1.1,
            color: 'var(--fg)',
            marginTop: 4,
            letterSpacing: '-0.01em',
          }}
        >
          {titleFor(pathname)}
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <Input icon={Search} placeholder="Search transactions, accounts, categories…" kbd="⌘K" style={{ minWidth: 360 }} />
      <Button variant="primary" icon={Plus} onClick={onNewTransaction}>
        New transaction
      </Button>
      <IconButton icon={Bell} badge label="Notifications" />
      <Avatar initials={userInitials} size={40} />
    </header>
  )
}
