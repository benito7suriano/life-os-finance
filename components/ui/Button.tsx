'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  children?: ReactNode
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  onClick?: () => void
  disabled?: boolean
  fullWidth?: boolean
  type?: 'button' | 'submit'
  className?: string
  style?: CSSProperties
}

const SIZES: Record<Size, { px: number; py: number; font: number; gap: number; icon: number }> = {
  sm: { px: 10, py: 6, font: 12, gap: 6, icon: 14 },
  md: { px: 14, py: 9, font: 13, gap: 8, icon: 16 },
  lg: { px: 18, py: 12, font: 14, gap: 10, icon: 18 },
}

function variantStyle(variant: Variant): CSSProperties {
  switch (variant) {
    case 'primary':
      return { background: 'var(--accent-gradient)', color: '#0b0d18', border: 'none', fontWeight: 600 }
    case 'ghost':
      return { background: 'transparent', color: 'var(--fg2)', border: 'none', fontWeight: 500 }
    case 'danger':
      return { background: 'rgba(251,113,133,0.1)', color: 'var(--bad)', border: '1px solid rgba(251,113,133,0.25)', fontWeight: 500 }
    case 'accent':
      return { background: 'var(--accent-soft)', color: 'var(--accent-a)', border: '1px solid var(--accent-soft)', fontWeight: 500 }
    case 'secondary':
    default:
      return { background: 'rgba(255,255,255,0.04)', color: 'var(--fg)', border: '1px solid var(--card-border)', fontWeight: 500 }
  }
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  onClick,
  disabled = false,
  fullWidth = false,
  type = 'button',
  className,
  style,
}: ButtonProps) {
  const s = SIZES[size]
  const v = variantStyle(variant)
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{
        ...v,
        padding: `${s.py}px ${s.px}px`,
        fontFamily: 'var(--font-sans)',
        fontSize: s.font,
        lineHeight: 1,
        borderRadius: 10,
        display: fullWidth ? 'flex' : 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'transform .1s, opacity .15s',
        width: fullWidth ? '100%' : 'auto',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {Icon && <Icon size={s.icon} strokeWidth={1.8} />}
      {children}
      {IconRight && <IconRight size={s.icon} strokeWidth={1.8} />}
    </button>
  )
}
