'use client'

import { useState, useRef, useEffect } from 'react'
import type { Category, Account, TransactionFilters } from '../types'
import { Search, Filter, ChevronDown, X, Calendar, Check } from 'lucide-react'

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

export function TransactionFiltersBar({
  categories,
  accounts,
  filters = {},
  onFilterChange,
  onSearch,
}: TransactionFiltersBarProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '')
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
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
    const updated = current.includes(categoryId)
      ? current.filter(id => id !== categoryId)
      : [...current, categoryId]
    onFilterChange?.({ ...filters, categoryIds: updated.length > 0 ? updated : undefined })
  }

  const handleAccountToggle = (accountId: string) => {
    const current = filters.accountIds || []
    const updated = current.includes(accountId)
      ? current.filter(id => id !== accountId)
      : [...current, accountId]
    onFilterChange?.({ ...filters, accountIds: updated.length > 0 ? updated : undefined })
  }

  const handleSourceToggle = (source: 'manual' | 'whatsapp' | 'email') => {
    const current = filters.sources || []
    const updated = current.includes(source)
      ? current.filter(s => s !== source)
      : [...current, source]
    onFilterChange?.({ ...filters, sources: updated.length > 0 ? updated : undefined })
  }

  const handleDatePresetSelect = (preset: string) => {
    setDatePreset(preset)
    setActiveDropdown(null)
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
    (filters.categoryIds?.length || 0) +
    (filters.accountIds?.length || 0) +
    (filters.sources?.length || 0) +
    (datePreset ? 1 : 0)

  return (
    <div className="space-y-3">
      {/* Search and Filter Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-emerald-400"
          />
          {searchValue && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div ref={dropdownRef} className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'category' ? null : 'category')}
              className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                filters.categoryIds && filters.categoryIds.length > 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>Category</span>
              {filters.categoryIds && filters.categoryIds.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">
                  {filters.categoryIds.length}
                </span>
              )}
              <ChevronDown className={`h-4 w-4 transition-transform ${activeDropdown === 'category' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'category' && (
              <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                <div className="max-h-64 overflow-y-auto">
                  {categories.map((category) => {
                    const isSelected = filters.categoryIds?.includes(category.id)
                    return (
                      <button
                        key={category.id}
                        onClick={() => handleCategoryToggle(category.id)}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <div className={`h-3 w-3 rounded-full bg-${category.color}-500`} />
                        <span className="flex-1 text-slate-700 dark:text-slate-300">{category.name}</span>
                        {isSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Account Filter */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'account' ? null : 'account')}
              className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                filters.accountIds && filters.accountIds.length > 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <span>Account</span>
              {filters.accountIds && filters.accountIds.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">
                  {filters.accountIds.length}
                </span>
              )}
              <ChevronDown className={`h-4 w-4 transition-transform ${activeDropdown === 'account' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'account' && (
              <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                {accounts.map((account) => {
                  const isSelected = filters.accountIds?.includes(account.id)
                  return (
                    <button
                      key={account.id}
                      onClick={() => handleAccountToggle(account.id)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <span className="flex-1 text-slate-700 dark:text-slate-300">{account.name}</span>
                      {isSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Source Filter */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'source' ? null : 'source')}
              className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                filters.sources && filters.sources.length > 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <span>Source</span>
              {filters.sources && filters.sources.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">
                  {filters.sources.length}
                </span>
              )}
              <ChevronDown className={`h-4 w-4 transition-transform ${activeDropdown === 'source' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'source' && (
              <div className="absolute left-0 top-full z-20 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                {SOURCE_OPTIONS.map((source) => {
                  const isSelected = filters.sources?.includes(source.value)
                  return (
                    <button
                      key={source.value}
                      onClick={() => handleSourceToggle(source.value)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <span className="flex-1 text-slate-700 dark:text-slate-300">{source.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Date Range Filter */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'date' ? null : 'date')}
              className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                datePreset
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>{datePreset ? DATE_PRESETS.find(p => p.value === datePreset)?.label : 'Date'}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${activeDropdown === 'date' ? 'rotate-180' : ''}`} />
            </button>

            {activeDropdown === 'date' && (
              <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                {DATE_PRESETS.map((preset) => {
                  const isSelected = datePreset === preset.value
                  return (
                    <button
                      key={preset.value}
                      onClick={() => handleDatePresetSelect(preset.value)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <span className="flex-1 text-slate-700 dark:text-slate-300">{preset.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                    </button>
                  )
                })}
                {datePreset && (
                  <>
                    <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                    <button
                      onClick={() => { setDatePreset(null); setActiveDropdown(null) }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <X className="h-4 w-4" />
                      Clear date filter
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Clear All */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            >
              <X className="h-4 w-4" />
              Clear all ({activeFilterCount})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
