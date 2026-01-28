'use client'

import { useState } from 'react'
import { MainNav } from './MainNav'
import { UserMenu } from './UserMenu'
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
  Waves,
  Circle,
} from 'lucide-react'

export interface NavigationItem {
  label: string
  href: string
  icon?: 'dashboard' | 'transactions' | 'accounts' | 'budgets' | 'automation'
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
  budgets: PiggyBank,
  automation: Zap,
}

export function AppShell({
  children,
  navigationItems,
  user,
  onNavigate,
  onLogout,
}: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navItemsWithIcons = navigationItems.map((item) => ({
    ...item,
    Icon: (item.icon && iconMap[item.icon]) || Circle,
  }))

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 font-[Inter,sans-serif]">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          bg-slate-100 dark:bg-slate-900
          border-r border-slate-200 dark:border-slate-800
          transition-all duration-200 ease-in-out
          ${isCollapsed ? 'w-16' : 'w-64'}
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static
        `}
      >
        {/* Sidebar Header */}
        <div className={`flex h-14 items-center border-b border-slate-200 dark:border-slate-800 px-3 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                onNavigate?.('/')
              }}
              className="flex items-center gap-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Waves className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Ledger
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Smart Finance
                </span>
              </div>
            </a>
          )}

          {/* Collapse Toggle - Desktop Only */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>

          {/* Close Button - Mobile Only */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex lg:hidden h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <MainNav
            items={navItemsWithIcons}
            isCollapsed={isCollapsed}
            onNavigate={(href) => {
              onNavigate?.(href)
              setIsMobileMenuOpen(false)
            }}
          />
        </div>

        {/* User Menu */}
        {user && (
          <div className="border-t border-slate-200 dark:border-slate-800 p-3">
            <UserMenu
              user={user}
              isCollapsed={isCollapsed}
              onLogout={onLogout}
              onNavigate={onNavigate}
            />
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Menu Toggle - Fixed at top of content on mobile */}
        <div className="flex lg:hidden items-center h-14 px-4 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-white">
              <Waves className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              Ledger
            </span>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
