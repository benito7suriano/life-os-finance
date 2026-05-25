import type { AutomationProps } from './types'
import { TelegramSetupCard } from './TelegramSetupCard'
import { TelegramConnectedCard } from './TelegramConnectedCard'

export function AutomationSettings({
  channels,
  pendingLink,
  onStartTelegramSetup,
  onCancelTelegramSetup,
  onPauseChannel,
  onResumeChannel,
  onDisconnectChannel,
  onRefresh,
}: AutomationProps) {
  const telegramChannel = channels.find(c => c.type === 'telegram')
  const telegramConnected =
    telegramChannel && telegramChannel.status !== 'disconnected'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Automation
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Connect Telegram to log transactions hands-free from anywhere.
          </p>
        </div>

        {/* How it works */}
        <div className="mb-8 p-4 rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-sky-800 dark:text-sky-300">
                How it works
              </p>
              <p className="text-sm text-sky-700 dark:text-sky-400 mt-1">
                Once linked, text or voice-note the bot a transaction
                (e.g. &ldquo;$12 coffee at Blue Bottle&rdquo;) or send a
                receipt photo. Gemini extracts the merchant, amount, and
                category; you confirm with a single tap before it&apos;s saved.
              </p>
            </div>
          </div>
        </div>

        {/* Channel card */}
        <div className="space-y-6">
          {telegramConnected && telegramChannel ? (
            <TelegramConnectedCard
              channel={telegramChannel}
              onPause={() => onPauseChannel?.(telegramChannel.id)}
              onResume={() => onResumeChannel?.(telegramChannel.id)}
              onDisconnect={() => onDisconnectChannel?.(telegramChannel.id)}
            />
          ) : (
            <TelegramSetupCard
              pendingLink={pendingLink}
              onStartSetup={onStartTelegramSetup}
              onCancelSetup={onCancelTelegramSetup}
              onRefresh={onRefresh}
            />
          )}
        </div>

        {/* Tips */}
        <div className="mt-12">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4">
            Tips for best results
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                Be specific
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Include the amount, merchant, and (optionally) the date.
                &ldquo;$12 coffee at Blue Bottle yesterday&rdquo; works great.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                Clear receipts
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                For photos, make sure the total and merchant name are legible
                and the receipt isn&apos;t cropped.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                Voice on the go
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Hold the mic button and just say the transaction. The bot
                transcribes and parses it the same as text.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                Confirm before saving
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                The bot always shows what it parsed and waits for your
                Confirm tap before writing to the ledger.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
