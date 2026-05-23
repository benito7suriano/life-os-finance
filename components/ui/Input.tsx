'use client'

import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'

interface InputProps {
  icon?: LucideIcon
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  kbd?: string
  fullWidth?: boolean
  type?: string
  style?: CSSProperties
}

export function Input({ icon: Icon, placeholder, value, onChange, kbd, fullWidth = false, type = 'text', style }: InputProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--card-border)',
        borderRadius: 12,
        padding: '10px 14px',
        color: 'var(--fg2)',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        width: fullWidth ? '100%' : 'auto',
        ...style,
      }}
    >
      {Icon && <Icon size={16} strokeWidth={1.8} />}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--fg)',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          flex: 1,
          width: '100%',
        }}
      />
      {kbd && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            padding: '2px 6px',
            border: '1px solid var(--card-border-hi)',
            borderRadius: 5,
            color: 'var(--fg3)',
          }}
        >
          {kbd}
        </span>
      )}
    </div>
  )
}
