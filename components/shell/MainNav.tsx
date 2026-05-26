'use client'

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  Icon: LucideIcon
  isActive?: boolean
}

export interface MainNavProps {
  items: NavItem[]
  isCollapsed: boolean
  onNavigate?: (href: string) => void
}

function NavLink({ item, isCollapsed, onNavigate }: { item: NavItem; isCollapsed: boolean; onNavigate?: (href: string) => void }) {
  const [hover, setHover] = useState(false)
  const active = !!item.isActive
  return (
    <a
      href={item.href}
      onClick={(e) => {
        e.preventDefault()
        onNavigate?.(item.href)
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={isCollapsed ? item.label : undefined}
      className="group relative flex items-center"
      style={{
        gap: 12,
        height: isCollapsed ? 48 : 44,
        width: isCollapsed ? 48 : 'auto',
        margin: isCollapsed ? '0 auto' : 0,
        padding: isCollapsed ? 0 : '0 12px',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        borderRadius: 14,
        background: active ? 'var(--accent-soft)' : hover ? 'rgba(255,255,255,0.04)' : 'transparent',
        color: active ? 'var(--accent-a)' : 'var(--fg3)',
        transition: 'background .15s, color .15s',
      }}
    >
      {active && (
        <span
          style={{
            position: 'absolute',
            left: -10,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: 22,
            background: 'var(--accent-solid)',
            borderRadius: 2,
            boxShadow: '0 0 8px var(--accent-solid)',
          }}
        />
      )}
      <item.Icon size={22} strokeWidth={1.8} style={{ flexShrink: 0 }} />
      {!isCollapsed && (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: active ? 'var(--accent-a)' : 'var(--fg2)' }}>
          {item.label}
        </span>
      )}
    </a>
  )
}

export function MainNav({ items, isCollapsed, onNavigate }: MainNavProps) {
  return (
    <nav style={{ padding: isCollapsed ? '0 8px' : '0 10px' }}>
      <ul className="flex flex-col" style={{ gap: 6 }}>
        {items.map((item) => (
          <li key={item.href}>
            <NavLink item={item} isCollapsed={isCollapsed} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </nav>
  )
}
