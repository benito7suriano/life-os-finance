import type { CSSProperties } from 'react'

interface AvatarProps {
  initials?: string
  size?: number
  style?: CSSProperties
}

export function Avatar({ initials = '?', size = 40, style }: AvatarProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--accent-gradient)',
        color: '#0b0d18',
        fontWeight: 700,
        fontSize: size * 0.36,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
        flexShrink: 0,
        ...style,
      }}
    >
      {initials}
    </span>
  )
}
