import type { AutomationProps } from './types'
import { TelegramSetupCard } from './TelegramSetupCard'
import { TelegramConnectedCard } from './TelegramConnectedCard'
import { Card } from '@/components/ui'
import { Info, AlertTriangle, X } from 'lucide-react'

const TIPS = [
  { title: 'Be specific', body: 'Include the amount, merchant, and (optionally) the date. “$12 coffee at Blue Bottle yesterday” works great.' },
  { title: 'Clear receipts', body: "For photos, make sure the total and merchant name are legible and the receipt isn't cropped." },
  { title: 'Voice on the go', body: 'Hold the mic button and just say the transaction. The bot transcribes and parses it the same as text.' },
  { title: 'Confirm before saving', body: 'The bot always shows what it parsed and waits for your Confirm tap before writing to the ledger.' },
]

export function AutomationSettings({
  channels,
  pendingLink,
  error,
  onDismissError,
  onStartTelegramSetup,
  onCancelTelegramSetup,
  onPauseChannel,
  onResumeChannel,
  onDisconnectChannel,
  onRefresh,
}: AutomationProps) {
  const telegramChannel = channels.find((c) => c.type === 'telegram')
  const telegramConnected = telegramChannel && telegramChannel.status !== 'disconnected'

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6 lg:px-8 lg:py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--fg)' }}>Automation</h1>
        <p style={{ marginTop: 4, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg3)' }}>
          Connect Telegram to log transactions hands-free from anywhere.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <Card pad={14} style={{ marginBottom: 16, borderColor: 'rgba(251,113,133,0.35)' }}>
          <div className="flex items-center gap-3" role="alert">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--bad)' }} />
            <p className="flex-1" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg)' }}>
              {error}
            </p>
            <button
              onClick={onDismissError}
              aria-label="Dismiss error"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ color: 'var(--fg3)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      {/* How it works */}
      <Card accent pad={18} style={{ marginBottom: 24 }}>
        <div className="flex items-start gap-3">
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-a)' }}
          >
            <Info className="h-4 w-4" />
          </span>
          <div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>How it works</p>
            <p style={{ marginTop: 4, fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.55, color: 'var(--fg2)' }}>
              Once linked, text or voice-note the bot a transaction (e.g. “$12 coffee at Blue Bottle”) or send a receipt photo.
              Gemini extracts the merchant, amount, and category; you confirm with a single tap before it&apos;s saved.
            </p>
          </div>
        </div>
      </Card>

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
          <TelegramSetupCard pendingLink={pendingLink} onStartSetup={onStartTelegramSetup} onCancelSetup={onCancelTelegramSetup} onRefresh={onRefresh} />
        )}
      </div>

      {/* Tips */}
      <div className="mt-12">
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--fg3)', marginBottom: 16 }}>
          Tips for best results
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {TIPS.map((tip) => (
            <Card key={tip.title} pad={16}>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>{tip.title}</h3>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--fg3)' }}>{tip.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
