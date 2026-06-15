'use client'

import { useState, useRef, useEffect, type CSSProperties } from 'react'
import type { Category, Account, TransactionFilters } from './types'
import { Search, Filter, ChevronDown, X, Calendar, Check } from 'lucide-react'
import { categoryHex } from './categoryColor'

interface TransactionFiltersBarProps {
  categories: Category[]
  accounts: Account[]
  filters?: TransactionFilters
  onFilterChange?: (filters: TransactionFilters) => void
  onSearch?: (query: string) => void
}

const DATE_PRESETS = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 60 days', value: '60d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'This month', value: 'this-month' },
  { label: 'Last month', value: 'last-month' },
  { label: 'Custom range', value: 'custom' },
]

const SOURCE_OPTIONS = [
  { label: 'Manual', value: 'manual' as const },
  { label: 'WhatsApp', value: 'whatsapp' as const },
  { label: 'Email', value: 'email' as const },
]

/** The date preset selected by default when the Transactions page first loads. */
export const DEFAULT_DATE_PRESET = 'this-month'

export function computeDateRange(preset: string): { start: string; end: string } | undefined {
  const now = new Date()
  const end = now.toISOString().split('T')[0]

  switch (preset) {
    case '7d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return { start: start.toISOString().split('T')[0], end }
    }
    case '30d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return { start: start.toISOString().split('T')[0], end }
    }
    case '60d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 60)
      return { start: start.toISOString().split('T')[0], end }
    }
    case '90d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 90)
      return { start: start.toISOString().split('T')[0], end }
    }
    case 'this-month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: start.toISOString().split('T')[0], end }
    }
    case 'last-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: start.toISOString().split('T')[0], end: endOfLastMonth.toISOString().split('T')[0] }
    }
    default:
      return undefined
  }
}

// ─── shared styles ─────────────────────────────────────────────────────
const POPOVER: CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--card-border)',
  borderRadius: 12,
  boxShadow: '0 30px 80px -30px rgba(0,0,0,0.7)',
}
const OPTION: CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }

function triggerStyle(active: boolean): CSSProperties {
  return active
    ? { background: 'var(--accent-soft)', border: '1px solid transparent', color: 'var(--accent-a)' }
    : { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--card-border)', color: 'var(--fg2)' }
}

export function TransactionFiltersBar({ categories, accounts, filters = {}, onFilterChange, onSearch }: TransactionFiltersBarProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '')
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState<string | null>(DEFAULT_DATE_PRESET)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    onSearch?.(value)
  }

  const handleCategoryToggle = (categoryId: string) => {
    const current = filters.categoryIds || []
    const updated = current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId]
    onFilterChange?.({ ...filters, categoryIds: updated.length > 0 ? updated : undefined })
  }

  const handleAccountToggle = (accountId: string) => {
    const current = filters.accountIds || []
    const updated = current.includes(accountId) ? current.filter((id) => id !== accountId) : [...current, accountId]
    onFilterChange?.({ ...filters, accountIds: updated.length > 0 ? updated : undefined })
  }

  const handleSourceToggle = (source: 'manual' | 'whatsapp' | 'email') => {
    const current = filters.sources || []
    const updated = current.includes(source) ? current.filter((s) => s !== source) : [...current, source]
    onFilterChange?.({ ...filters, sources: updated.length > 0 ? updated : undefined })
  }

  const handleDatePresetSelect = (preset: string) => {
    setDatePreset(preset)
    setActiveDropdown(null)
    const dateRange = computeDateRange(preset)
    if (dateRange) {
      onFilterChange?.({ ...filters, dateRange })
    }
  }

  const clearAllFilters = () => {
    setSearchValue('')
    setDatePreset(null)
    onSearch?.('')
    onFilterChange?.({})
  }

  const hasActiveFilters =
    (filters.categoryIds && filters.categoryIds.length > 0) ||
    (filters.accountIds && filters.accountIds.length > 0) ||
    (filters.sources && filters.sources.length > 0) ||
    datePreset !== null

  const activeFilterCount =
    (filters.categoryIds?.length || 0) + (filters.accountIds?.length || 0) + (filters.sources?.length || 0) + (datePreset ? 1 : 0)

  const countBadge = (n: number) => (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-full"
      style={{ background: 'var(--accent-solid)', color: '#0b0d18', fontSize: 11, fontWeight: 600 }}
    >
      {n}
    </span>
  )

  const OptionRow = ({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
      style={OPTION}
    >
      {children}
      {selected && <Check className="ml-auto h-4 w-4" style={{ color: 'var(--accent-a)' }} />}
    </button>
  )

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--fg3)' }} />
        <input
          type="text"
          placeholder="Search transactions..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-10 w-full rounded-xl pl-10 pr-4 outline-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--card-border)', color: 'var(--fg)', fontFamily: 'var(--font-sans)', fontSize: 13 }}
        />
        {searchValue && (
          <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg3)' }} aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdowns */}
      <div ref={dropdownRef} className="flex flex-wrap items-center gap-2">
        {/* Category */}
        <div className="relative">
          <button
            onClick={() => setActiveDropdown(activeDropdown === 'category' ? null : 'category')}
            className="flex h-10 items-center gap-2 rounded-xl px-3"
            style={{ ...triggerStyle(!!filters.categoryIds?.length), fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500 }}
          >
            <Filter className="h-4 w-4" />
            <span>Category</span>
            {!!filters.categoryIds?.length && countBadge(filters.categoryIds.length)}
            <ChevronDown className={`h-4 w-4 transition-transform ${activeDropdown === 'category' ? 'rotate-180' : ''}`} />
          </button>
          {activeDropdown === 'category' && (
            <div className="absolute left-0 top-full z-20 mt-2 w-56 p-2" style={POPOVER}>
              <div className="max-h-64 overflow-y-auto">
                {categories.map((category) => (
                  <OptionRow key={category.id} selected={filters.categoryIds?.includes(category.id)} onClick={() => handleCategoryToggle(category.id)}>
                    <span className="h-3 w-3 rounded-full" style={{ background: categoryHex(category.color) }} />
                    <span style={{ color: 'var(--fg)' }}>{category.name}</span>
                  </OptionRow>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Account */}
        <div className="relative">
          <button
            onClick={() => setActiveDropdown(activeDropdown === 'account' ? null : 'account')}
            className="flex h-10 items-center gap-2 rounded-xl px-3"
            style={{ ...triggerStyle(!!filters.accountIds?.length), fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500 }}
          >
            <span>Account</span>
            {!!filters.accountIds?.length && countBadge(filters.accountIds.length)}
            <ChevronDown className={`h-4 w-4 transition-transform ${activeDropdown === 'account' ? 'rotate-180' : ''}`} />
          </button>
          {activeDropdown === 'account' && (
            <div className="absolute left-0 top-full z-20 mt-2 w-56 p-2" style={POPOVER}>
              {accounts.map((account) => (
                <OptionRow key={account.id} selected={filters.accountIds?.includes(account.id)} onClick={() => handleAccountToggle(account.id)}>
                  <span style={{ color: 'var(--fg)' }}>{account.name}</span>
                </OptionRow>
              ))}
            </div>
          )}
        </div>

        {/* Source */}
        <div className="relative">
          <button
            onClick={() => setActiveDropdown(activeDropdown === 'source' ? null : 'source')}
            className="flex h-10 items-center gap-2 rounded-xl px-3"
            style={{ ...triggerStyle(!!filters.sources?.length), fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500 }}
          >
            <span>Source</span>
            {!!filters.sources?.length && countBadge(filters.sources.length)}
            <ChevronDown className={`h-4 w-4 transition-transform ${activeDropdown === 'source' ? 'rotate-180' : ''}`} />
          </button>
          {activeDropdown === 'source' && (
            <div className="absolute left-0 top-full z-20 mt-2 w-44 p-2" style={POPOVER}>
              {SOURCE_OPTIONS.map((source) => (
                <OptionRow key={source.value} selected={filters.sources?.includes(source.value)} onClick={() => handleSourceToggle(source.value)}>
                  <span style={{ color: 'var(--fg)' }}>{source.label}</span>
                </OptionRow>
              ))}
            </div>
          )}
        </div>

        {/* Date */}
        <div className="relative">
          <button
            onClick={() => setActiveDropdown(activeDropdown === 'date' ? null : 'date')}
            className="flex h-10 items-center gap-2 rounded-xl px-3"
            style={{ ...triggerStyle(!!datePreset), fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500 }}
          >
            <Calendar className="h-4 w-4" />
            <span>{datePreset ? DATE_PRESETS.find((p) => p.value === datePreset)?.label : 'Date'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${activeDropdown === 'date' ? 'rotate-180' : ''}`} />
          </button>
          {activeDropdown === 'date' && (
            <div className="absolute right-0 top-full z-20 mt-2 w-48 p-2" style={POPOVER}>
              {DATE_PRESETS.map((preset) => (
                <OptionRow key={preset.value} selected={datePreset === preset.value} onClick={() => handleDatePresetSelect(preset.value)}>
                  <span style={{ color: 'var(--fg)' }}>{preset.label}</span>
                </OptionRow>
              ))}
              {datePreset && (
                <>
                  <div className="my-2" style={{ borderTop: '1px solid var(--card-border)' }} />
                  <button
                    onClick={() => {
                      setDatePreset(null)
                      setActiveDropdown(null)
                      onFilterChange?.({ ...filters, dateRange: undefined })
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left"
                    style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--bad)' }}
                  >
                    <X className="h-4 w-4" />
                    Clear date filter
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex h-10 items-center gap-1.5 rounded-xl px-3"
            style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--fg3)' }}
          >
            <X className="h-4 w-4" />
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>
    </div>
  )
}
