import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyProps {
  icon?: LucideIcon
  title?: string
  body?: string
  action?: ReactNode
}

export function Empty({ icon: Icon, title, body, action }: EmptyProps) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--fg3)' }}>
      {Icon && (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--fg2)',
            marginBottom: 14,
          }}
        >
          <Icon size={20} strokeWidth={1.8} />
        </div>
      )}
      {title && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--fg)', marginBottom: 6 }}>{title}</div>}
      {body && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--fg3)', maxWidth: 360, margin: '0 auto' }}>{body}</div>}
      {action}
    </div>
  )
}
