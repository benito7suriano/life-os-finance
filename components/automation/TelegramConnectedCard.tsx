'use client'

import { useState } from 'react'
import type { AutomationChannel } from './types'

interface TelegramConnectedCardProps {
  channel: AutomationChannel
  onPause?: () => void
  onResume?: () => void
  onDisconnect?: () => void
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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

export function TelegramConnectedCard({
  channel,
  onPause,
  onResume,
  onDisconnect,
}: TelegramConnectedCardProps) {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  const isConnected = channel.status === 'connected'
  const isPaused = channel.status === 'paused'
  const username = channel.telegramDetails?.username

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-sky-100 dark:bg-sky-900/30">
              <svg
                className="w-6 h-6 text-sky-600 dark:text-sky-400"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Telegram
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`
                    inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
                    ${isConnected
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : isPaused
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }
                  `}
                >
                  <span
                    className={`
                      w-1.5 h-1.5 rounded-full
                      ${isConnected ? 'bg-emerald-500' : isPaused ? 'bg-amber-500' : 'bg-slate-400'}
                    `}
                  />
                  {isConnected ? 'Connected' : isPaused ? 'Paused' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {(isConnected || isPaused) && (
            <button
              onClick={() => (isPaused ? onResume?.() : onPause?.())}
              className={`
                relative w-12 h-7 rounded-full transition-colors
                ${isConnected ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}
              `}
              title={isPaused ? 'Resume' : 'Pause'}
              aria-label={isPaused ? 'Resume channel' : 'Pause channel'}
            >
              <span
                className={`
                  absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform
                  ${isConnected ? 'left-6' : 'left-1'}
                `}
              />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {username && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Linked Account
              </p>
              <p className="font-mono text-slate-900 dark:text-slate-100">@{username}</p>
            </div>
            <svg
              className="w-5 h-5 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
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

        {isPaused && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <svg
              className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Paused since {formatDate(channel.pausedAt ?? null)}. Messages won&apos;t be processed.
            </p>
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
                onClick={() => {
                  onDisconnect?.()
                  setShowDisconnectConfirm(false)
                }}
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
