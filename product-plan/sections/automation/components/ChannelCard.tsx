import { useState } from 'react'
import type { AutomationChannel, AutomationConfig } from '../types'

interface ChannelCardProps {
  channel: AutomationChannel
  config: AutomationConfig
  onPause?: () => void
  onResume?: () => void
  onDisconnect?: () => void
  onCopyAddress?: (address: string) => void
}

export function ChannelCard({
  channel,
  config,
  onPause,
  onResume,
  onDisconnect,
  onCopyAddress
}: ChannelCardProps) {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [copied, setCopied] = useState(false)

  const isWhatsApp = channel.type === 'whatsapp'
  const isConnected = channel.status === 'connected'
  const isPaused = channel.status === 'paused'

  const handleCopy = () => {
    if (channel.emailDetails?.forwardingAddress) {
      navigator.clipboard.writeText(channel.emailDetails.forwardingAddress)
      setCopied(true)
      onCopyAddress?.(channel.emailDetails.forwardingAddress)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDisconnect = () => {
    onDisconnect?.()
    setShowDisconnectConfirm(false)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateString)
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center
              ${isWhatsApp
                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                : 'bg-slate-100 dark:bg-slate-700'
              }
            `}>
              {isWhatsApp ? (
                <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isWhatsApp ? 'WhatsApp' : 'Email Forwarding'}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`
                  inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
                  ${isConnected
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : isPaused
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }
                `}>
                  <span className={`
                    w-1.5 h-1.5 rounded-full
                    ${isConnected
                      ? 'bg-emerald-500'
                      : isPaused
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }
                  `} />
                  {isConnected ? 'Connected' : isPaused ? 'Paused' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* Pause/Resume Toggle */}
          {(isConnected || isPaused) && (
            <button
              onClick={() => isPaused ? onResume?.() : onPause?.()}
              className={`
                relative w-12 h-7 rounded-full transition-colors
                ${isConnected
                  ? 'bg-emerald-500'
                  : 'bg-slate-300 dark:bg-slate-600'
                }
              `}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              <span className={`
                absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform
                ${isConnected ? 'left-6' : 'left-1'}
              `} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isWhatsApp ? (
          // WhatsApp content
          <div className="space-y-4">
            {channel.whatsappDetails && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Linked Phone
                  </p>
                  <p className="font-mono text-slate-900 dark:text-slate-100">
                    {channel.whatsappDetails.linkedPhoneNumberMasked}
                  </p>
                </div>
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Transactions Logged
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {channel.transactionsLogged}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Last Activity
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {formatRelativeTime(channel.lastActivityAt)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Email content
          <div className="space-y-4">
            {channel.emailDetails && (
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Your Forwarding Address
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 font-mono text-sm text-slate-900 dark:text-slate-100 truncate">
                    {channel.emailDetails.forwardingAddress}
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`
                      px-4 py-3 rounded-xl font-medium text-sm transition-all
                      ${copied
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }
                    `}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Transactions Logged
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {channel.transactionsLogged}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Last Activity
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {formatRelativeTime(channel.lastActivityAt)}
                </p>
              </div>
            </div>

            {isPaused && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Paused since {formatDate(channel.pausedAt ?? null)}. Forwarded emails won't be processed.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
        {showDisconnectConfirm ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Disconnect this channel?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Connected {formatDate(channel.connectedAt)}
            </p>
            <button
              onClick={() => setShowDisconnectConfirm(true)}
              className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
