'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface ChipProps {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  icon?: LucideIcon
  style?: CSSProperties
}

export function Chip({ children, active = false, onClick, icon: Icon, style }: ChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        background: active ? 'var(--accent-soft)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? 'transparent' : 'var(--card-border)'}`,
        color: active ? 'var(--accent-a)' : 'var(--fg2)',
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        ...style,
      }}
    >
      {Icon && <Icon size={13} strokeWidth={1.8} />}
      {children}
    </button>
  )
}
