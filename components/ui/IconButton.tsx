'use client'

import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'

interface IconButtonProps {
  icon: LucideIcon
  onClick?: () => void
  badge?: boolean
  label?: string
  active?: boolean
  style?: CSSProperties
}

export function IconButton({ icon: Icon, onClick, badge = false, label, active = false, style }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: active ? 'var(--accent-soft)' : 'rgba(255,255,255,0.04)',
        border: '1px solid var(--card-border)',
        color: active ? 'var(--accent-a)' : 'var(--fg2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: 'pointer',
        ...style,
      }}
    >
      <Icon size={18} strokeWidth={1.8} />
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 7,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--accent-solid)',
            boxShadow: '0 0 0 2px var(--bg)',
          }}
        />
      )}
    </button>
  )
}
