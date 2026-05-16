'use client'

import { useState, useRef, useEffect } from 'react'
import { Settings, LogOut, ChevronUp } from 'lucide-react'

export interface User {
  name: string
  email: string
  avatarUrl?: string
}

export interface UserMenuProps {
  user: User
  isCollapsed: boolean
  onLogout?: () => void
  onNavigate?: (href: string) => void
}

export function UserMenu({ user, isCollapsed, onLogout, onNavigate }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Get initials from name
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex w-full items-center gap-3 rounded-md p-2
          text-left transition-colors
          hover:bg-slate-100 dark:hover:bg-slate-800
          ${isCollapsed ? 'justify-center' : ''}
        `}
      >
        {/* Avatar */}
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="h-8 w-8 shrink-0 aspect-square rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 aspect-square items-center justify-center rounded-full bg-emerald-600 text-xs font-medium text-white">
            {initials}
          </div>
        )}

        {/* User Info */}
        {!isCollapsed && (
          <>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                {user.name}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </p>
            </div>
            <ChevronUp
              className={`h-4 w-4 text-slate-500 transition-transform ${
                isOpen ? '' : 'rotate-180'
              }`}
            />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`
            absolute z-50 w-56 rounded-lg border border-slate-200
            bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800
            ${isCollapsed ? 'bottom-0 left-full ml-2' : 'bottom-full left-0 mb-2'}
          `}
        >
          {/* User Info Header (collapsed mode) */}
          {isCollapsed && (
            <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {user.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </p>
            </div>
          )}

          <button
            onClick={() => {
              onNavigate?.('/settings')
              setIsOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>

          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />

          <button
            onClick={() => {
              onLogout?.()
              setIsOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}

      {/* Tooltip for collapsed state (when menu is closed) */}
      {isCollapsed && !isOpen && (
        <span
          className="
            pointer-events-none absolute bottom-0 left-full ml-2 rounded-md
            bg-slate-900 px-2 py-1 text-xs font-medium text-white
            opacity-0 transition-opacity group-hover:opacity-100
            dark:bg-slate-700
            whitespace-nowrap
          "
        >
          {user.name}
        </span>
      )}
    </div>
  )
}
