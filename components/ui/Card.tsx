'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from './cn'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  pad?: number
  hoverable?: boolean
  accent?: boolean
  onClick?: () => void
}

export function Card({ children, className, style, pad = 22, hoverable = false, accent = false, onClick }: CardProps) {
  const [hover, setHover] = useState(false)
  const background = accent
    ? `linear-gradient(135deg, var(--accent-soft), transparent 60%), var(--card-bg)`
    : `var(--card-bg)`
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hoverable && setHover(true)}
      onMouseLeave={() => hoverable && setHover(false)}
      className={cn('relative', onClick ? 'cursor-pointer' : '', className)}
      style={{
        background,
        border: `1px solid ${hover && hoverable ? 'var(--card-border-hi)' : 'var(--card-border)'}`,
        borderRadius: 'var(--card-radius)',
        padding: pad,
        boxShadow: 'var(--card-shadow)',
        transition: 'border-color .15s, transform .15s',
        transform: hover && hoverable ? 'translateY(-1px)' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
