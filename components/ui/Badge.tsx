import type { CSSProperties, ReactNode } from 'react'

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'accent'

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  dot?: boolean
  style?: CSSProperties
}

const TONES: Record<Tone, { c: string; bg: string }> = {
  neutral: { c: 'var(--fg2)', bg: 'rgba(255,255,255,0.06)' },
  good: { c: 'var(--good)', bg: 'rgba(74,222,128,0.1)' },
  warn: { c: 'var(--warn)', bg: 'rgba(251,191,36,0.1)' },
  bad: { c: 'var(--bad)', bg: 'rgba(251,113,133,0.1)' },
  info: { c: 'var(--info)', bg: 'rgba(103,232,249,0.1)' },
  accent: { c: 'var(--accent-a)', bg: 'var(--accent-soft)' },
}

export function Badge({ children, tone = 'neutral', dot = false, style }: BadgeProps) {
  const t = TONES[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 999,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        lineHeight: 1,
        fontWeight: 500,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: t.c,
        background: t.bg,
        ...style,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.c }} />}
      {children}
    </span>
  )
}
