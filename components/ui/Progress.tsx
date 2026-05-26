import type { CSSProperties } from 'react'

interface ProgressProps {
  value: number
  max?: number
  height?: number
  color?: string
  style?: CSSProperties
}

export function Progress({ value, max = 100, height = 6, color, style }: ProgressProps) {
  const pct = Math.max(0, Math.min(1, value / max))
  return (
    <div
      style={{
        width: '100%',
        height,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: height / 2,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          background: color || 'var(--accent-gradient)',
          borderRadius: height / 2,
        }}
      />
    </div>
  )
}
