'use client'

import type { Account } from './types'
import { Card, Empty, formatCurrency } from '@/components/ui'
import { formatCurrency as formatNative } from '@/lib/fx'
import { Wallet } from 'lucide-react'

interface AccountsMiniProps {
  accounts: Account[]
  onGo?: () => void
}

const TYPE_TAG: Record<Account['type'], string> = {
  checking: 'CH',
  savings: 'SV',
  credit_card: 'CC',
  loan: 'LN',
  wallet: '$',
  investment: 'IN',
}

export function AccountsMini({ accounts, onGo }: AccountsMiniProps) {
  // Combined balance is USD-normalized so mixed-currency accounts sum correctly.
  const total = accounts.reduce((sum, a) => sum + a.balanceUsd, 0)

  return (
    <Card hoverable onClick={onGo}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>Accounts</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg3)' }}>{accounts.length} active</span>
      </div>

      {accounts.length === 0 ? (
        <Empty icon={Wallet} title="No accounts yet" body="Add an account to track balances here." />
      ) : (
        <>
          <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>combined balance</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--fg)', marginTop: 6 }}>{formatCurrency(total)}</div>
          </div>
          {accounts.map((a) => {
            const debt = a.balance < 0
            return (
              <div
                key={a.id}
                style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--card-border)' }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: debt ? 'rgba(251,113,133,0.14)' : 'var(--accent-soft)',
                    color: debt ? 'var(--bad)' : 'var(--accent-a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {TYPE_TAG[a.type]}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg3)', marginTop: 3 }}>{a.institution || 'Cash'}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: debt ? 'var(--bad)' : 'var(--fg)' }}>
                  {formatNative(a.balance, a.currency)}
                </span>
              </div>
            )
          })}
        </>
      )}
    </Card>
  )
}
