'use client'

import { useState, useRef, useEffect } from 'react'
import type { Transaction, Category, Account } from './types'
import { MoreHorizontal, Pencil, Trash2, MessageCircle, Mail, Edit3 } from 'lucide-react'

interface TransactionRowProps {
  transaction: Transaction
  category: Category
  account: Account
  onEdit?: () => void
  onDelete?: () => void
}

function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(absAmount)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Map category colors to Tailwind classes
const categoryColorMap: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400' },
  teal: { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-700 dark:text-teal-400' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-400' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-400' },
  sky: { bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-400' },
  violet: { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-400' },
  pink: { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-400' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-400' },
  red: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-400' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-400' },
}

const sourceIcons = {
  manual: Edit3,
  whatsapp: MessageCircle,
  email: Mail,
}

const sourceLabels = {
  manual: 'Manual',
  whatsapp: 'WhatsApp',
  email: 'Email',
}

export function TransactionRow({
  transaction,
  category,
  account,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
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
  const colorClasses = categoryColorMap[category.color] || categoryColorMap.emerald
  const SourceIcon = sourceIcons[transaction.source]

  return (
    <tr className="group border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-800/50">
      {/* Date */}
      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-600 dark:text-slate-400">
        {formatDate(transaction.date)}
      </td>

      {/* Description */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
            {transaction.description}
          </p>
          <div
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-slate-400 opacity-0 transition-opacity group-hover:opacity-100"
            title={`Source: ${sourceLabels[transaction.source]}`}
          >
            <SourceIcon className="h-3.5 w-3.5" />
          </div>
        </div>
      </td>

      {/* Category (Colored Pill) */}
      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${colorClasses.bg} ${colorClasses.text}`}>
          {category.name}
        </span>
      </td>

      {/* Account */}
      <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-400">
        {account.name}
      </td>

      {/* Amount (Color-coded) */}
      <td className="whitespace-nowrap px-4 py-3.5 text-right">
        <span className={`font-[JetBrains_Mono,monospace] text-sm font-semibold ${
          isIncome
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400'
        }`}>
          {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
        </span>
      </td>

      {/* Actions Menu */}
      <td className="relative px-4 py-3.5">
        <div ref={menuRef} className="flex justify-end">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-4 top-full z-10 mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <button
                onClick={() => { onEdit?.(); setMenuOpen(false) }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => { onDelete?.(); setMenuOpen(false) }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
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
