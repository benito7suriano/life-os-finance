'use client'

import { ArrowUpRight, ArrowDownLeft, Receipt } from 'lucide-react'
import type { Transaction } from './types'
import { Card, Empty } from '@/components/ui'

interface RecentTransactionsProps {
  transactions: Transaction[]
  onViewTransaction?: (id: string) => void
  onViewAll?: () => void
}

export function RecentTransactions({ transactions, onViewTransaction, onViewAll }: RecentTransactionsProps) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>Recent</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg3)', marginLeft: 8 }}>· latest activity</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onViewAll}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-a)', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500 }}
        >
          View all →
        </button>
      </div>

      {transactions.length === 0 ? (
        <Empty icon={Receipt} title="No transactions yet" body="Your most recent activity will show up here once you log or import transactions." />
      ) : (
        <div>
          {transactions.slice(0, 6).map((tr, i) => {
            const isInc = tr.type === 'income'
            return (
              <button
                key={tr.id}
                onClick={() => onViewTransaction?.(tr.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  display: 'grid',
                  gridTemplateColumns: '34px 1fr auto auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '12px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--card-border)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: isInc ? 'rgba(74,222,128,0.12)' : 'var(--accent-soft)',
                    color: isInc ? 'var(--good)' : 'var(--accent-a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isInc ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tr.merchant?.name || tr.description}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg3)', marginTop: 2 }}>{tr.category.name}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg3)' }}>{tr.date.slice(5).replace('-', '/')}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: isInc ? 'var(--good)' : 'var(--fg)', minWidth: 70, textAlign: 'right' }}>
                  {isInc ? '+' : '−'}${Math.abs(tr.amount).toFixed(2)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}
