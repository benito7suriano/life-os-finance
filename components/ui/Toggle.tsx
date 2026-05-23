'use client'

import type { CSSProperties } from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  sublabel?: string
  style?: CSSProperties
}

export function Toggle({ checked, onChange, label, sublabel, style }: ToggleProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', ...style }}>
      {(label || sublabel) && (
        <div style={{ flex: 1 }}>
          {label && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{label}</div>}
          {sublabel && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg3)', marginTop: 3 }}>{sublabel}</div>}
        </div>
      )}
      <span
        style={{
          width: 38,
          height: 22,
          borderRadius: 11,
          padding: 2,
          background: checked ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.08)',
          transition: 'background .15s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'block',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transform: `translateX(${checked ? 16 : 0}px)`,
            transition: 'transform .15s',
          }}
        />
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ display: 'none' }} />
    </label>
  )
}
