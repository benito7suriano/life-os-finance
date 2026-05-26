'use client'

import { useState, useRef, useEffect } from 'react'
import type { Transaction, Category, Account } from './types'
import { MoreHorizontal, Pencil, Trash2, MessageCircle, Mail, Edit3, Upload, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { categoryHex } from './categoryColor'
import { formatCurrency } from '@/lib/fx'

interface TransactionRowProps {
  transaction: Transaction
  category: Category
  account: Account
  onEdit?: () => void
  onDelete?: () => void
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const sourceIcons: Record<string, typeof Edit3> = {
  manual: Edit3,
  whatsapp: MessageCircle,
  email: Mail,
  import: Upload,
}

const sourceLabels: Record<string, string> = {
  manual: 'Manual',
  whatsapp: 'WhatsApp',
  email: 'Email',
  import: 'Imported',
}

export function TransactionRow({ transaction, category, account, onEdit, onDelete }: TransactionRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isIncome = transaction.amount > 0
  const hex = categoryHex(category.color)
  const SourceIcon = sourceIcons[transaction.source] ?? Edit3

  return (
    <tr
      className="group"
      style={{ borderTop: '1px solid var(--card-border)', transition: 'background .12s' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Date */}
      <td className="whitespace-nowrap px-4 py-3.5" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg3)' }}>
        {formatDate(transaction.date)}
      </td>

      {/* Description (with leading direction icon + source hint) */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              flexShrink: 0,
              background: isIncome ? 'rgba(74,222,128,0.12)' : 'var(--accent-soft)',
              color: isIncome ? 'var(--good)' : 'var(--accent-a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isIncome ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
          </span>
          <p className="truncate" style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>
            {transaction.description}
          </p>
          <div
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: 'var(--fg3)' }}
            title={`Source: ${sourceLabels[transaction.source] ?? transaction.source}`}
          >
            <SourceIcon className="h-3.5 w-3.5" />
          </div>
        </div>
      </td>

      {/* Category (soft pill) */}
      <td className="px-4 py-3.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-full"
          style={{ padding: '4px 10px', background: `${hex}22`, color: hex, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500 }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: hex }} />
          {category.name}
        </span>
      </td>

      {/* Account */}
      <td className="px-4 py-3.5" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}>
        {account.name}
      </td>

      {/* Amount */}
      <td className="whitespace-nowrap px-4 py-3.5 text-right">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: isIncome ? 'var(--good)' : 'var(--fg)' }}>
          {isIncome ? '+' : '-'}
          {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
        </span>
      </td>

      {/* Actions */}
      <td className="relative px-4 py-3.5">
        <div ref={menuRef} className="flex justify-end">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Transaction actions"
            className="flex h-8 w-8 items-center justify-center rounded-lg opacity-0 transition-all group-hover:opacity-100"
            style={{ color: 'var(--fg3)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-4 top-full z-10 mt-1 w-36 py-1"
              style={{ background: 'var(--bg2)', border: '1px solid var(--card-border)', borderRadius: 12, boxShadow: '0 30px 80px -30px rgba(0,0,0,0.7)' }}
            >
              <button
                onClick={() => {
                  onEdit?.()
                  setMenuOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
                style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => {
                  onDelete?.()
                  setMenuOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
                style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--bad)' }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
