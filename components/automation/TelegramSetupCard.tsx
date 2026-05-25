'use client'

import { useState } from 'react'
import type { PendingTelegramLink } from './types'

interface TelegramSetupCardProps {
  pendingLink: PendingTelegramLink | null
  onStartSetup?: () => void
  onCancelSetup?: () => void
  onRefresh?: () => void
}

export function TelegramSetupCard({
  pendingLink,
  onStartSetup,
  onCancelSetup,
  onRefresh,
}: TelegramSetupCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 border-dashed overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
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
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Log transactions by texting, voice-noting, or photographing receipts
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {!pendingLink ? (
          // Initial state
          <div className="text-center py-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Connect your Telegram to send transactions to your ledger.
              Works with text (&ldquo;$12 coffee at Blue Bottle&rdquo;),
              voice notes, and receipt photos.
            </p>
            <button
              onClick={onStartSetup}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors bg-sky-600 hover:bg-sky-700 text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Connect Telegram
            </button>
          </div>
        ) : (
          // Setup flow
          <div className="space-y-6">
            <ol className="space-y-3">
              {[
                <>
                  Open Telegram and message{' '}
                  <a
                    href={pendingLink.deepLink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono font-medium text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    @{pendingLink.botUsername}
                  </a>
                </>,
                <>
                  Send the bot this exact message:{' '}
                  <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-sm text-slate-900 dark:text-slate-100">
                    /start {pendingLink.code}
                  </code>
                </>,
                <>The card here will flip to &ldquo;Connected&rdquo; within a few seconds.</>,
              ].map((instruction, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 text-sm font-medium flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-300 pt-0.5">
                    {instruction}
                  </span>
                </li>
              ))}
            </ol>

            {/* Link code card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Linking Code
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-2xl font-mono font-bold tracking-widest text-slate-900 dark:text-slate-100">
                  {pendingLink.code}
                </p>
                <button
                  onClick={() => handleCopy(`/start ${pendingLink.code}`)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${copied
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-600'
                    }
                  `}
                >
                  {copied ? 'Copied!' : 'Copy /start command'}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Expires at {new Date(pendingLink.expiresAt).toLocaleTimeString()}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancelSetup}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={onRefresh}
                className="flex-1 py-2.5 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-xl"
              >
                I&rsquo;ve sent it — refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
