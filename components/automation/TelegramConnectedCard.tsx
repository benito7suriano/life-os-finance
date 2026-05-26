'use client'

import { useState } from 'react'
import type { AutomationChannel } from './types'
import { Badge } from '@/components/ui'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

interface TelegramConnectedCardProps {
  channel: AutomationChannel
  onPause?: () => void
  onResume?: () => void
  onDisconnect?: () => void
}

const TG = 'linear-gradient(135deg, #29b6f6, #0288d1)'

function BotAvatar({ size = 48 }: { size?: number }) {
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: 14, background: TG, color: '#fff', boxShadow: '0 8px 20px -10px #0288d1' }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
      </svg>
    </span>
  )
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelativeTime(dateString: string | null) {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateString)
}

const statLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--fg3)',
  marginBottom: 4,
}

export function TelegramConnectedCard({ channel, onPause, onResume, onDisconnect }: TelegramConnectedCardProps) {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  const isConnected = channel.status === 'connected'
  const isPaused = channel.status === 'paused'
  const username = channel.telegramDetails?.username

  return (
    <div className="overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--card-radius)', boxShadow: 'var(--card-shadow)' }}>
      {/* Header */}
      <div className="p-6" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <BotAvatar />
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--fg)' }}>Telegram</h3>
              <div className="mt-1">
                <Badge tone={isConnected ? 'good' : isPaused ? 'warn' : 'neutral'} dot>
                  {isConnected ? 'Connected' : isPaused ? 'Paused' : 'Disconnected'}
                </Badge>
              </div>
            </div>
          </div>

          {(isConnected || isPaused) && (
            <button
              onClick={() => (isPaused ? onResume?.() : onPause?.())}
              title={isPaused ? 'Resume' : 'Pause'}
              aria-label={isPaused ? 'Resume channel' : 'Pause channel'}
              className="relative h-7 w-12 rounded-full transition-colors"
              style={{ background: isConnected ? 'var(--accent-solid)' : 'rgba(255,255,255,0.12)' }}
            >
              <span className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all" style={{ left: isConnected ? 24 : 4 }} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4 p-6">
        {username && (
          <div className="flex items-center justify-between rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div>
              <p style={statLabel}>Linked Account</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--fg)' }}>@{username}</p>
            </div>
            <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--good)' }} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p style={statLabel}>Transactions Logged</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--fg)' }}>{channel.transactionsLogged}</p>
          </div>
          <div>
            <p style={statLabel}>Last Activity</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>{formatRelativeTime(channel.lastActivityAt)}</p>
          </div>
        </div>

        {isPaused && (
          <div className="flex items-center gap-2 rounded-lg p-3" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--warn)' }} />
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--warn)' }}>
              Paused since {formatDate(channel.pausedAt ?? null)}. Messages won&apos;t be processed.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4" style={{ borderTop: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.02)' }}>
        {showDisconnectConfirm ? (
          <div className="flex items-center justify-between">
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}>Disconnect this channel?</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDisconnectConfirm(false)} className="px-3 py-1.5" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--fg2)' }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  onDisconnect?.()
                  setShowDisconnectConfirm(false)
                }}
                className="px-3 py-1.5"
                style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--bad)' }}
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg3)' }}>Connected {formatDate(channel.connectedAt)}</p>
            <button
              onClick={() => setShowDisconnectConfirm(true)}
              className="transition-colors"
              style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--fg3)' }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
