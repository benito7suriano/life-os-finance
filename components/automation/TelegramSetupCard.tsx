'use client'

import { useState } from 'react'
import type { PendingTelegramLink } from './types'
import { Button } from '@/components/ui'
import { Link2 } from 'lucide-react'

interface TelegramSetupCardProps {
  pendingLink: PendingTelegramLink | null
  onStartSetup?: () => void
  onCancelSetup?: () => void
  onRefresh?: () => void
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

export function TelegramSetupCard({ pendingLink, onStartSetup, onCancelSetup, onRefresh }: TelegramSetupCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="overflow-hidden"
      style={{ background: 'var(--card-bg)', border: '1px dashed var(--card-border-hi)', borderRadius: 'var(--card-radius)', boxShadow: 'var(--card-shadow)' }}
    >
      {/* Header */}
      <div className="p-6" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="flex items-center gap-4">
          <BotAvatar />
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--fg)' }}>Telegram</h3>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg3)' }}>
              Log transactions by texting, voice-noting, or photographing receipts
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {!pendingLink ? (
          <div className="py-4 text-center">
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.55, color: 'var(--fg2)', marginBottom: 18, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
              Connect your Telegram to send transactions to your ledger. Works with text (“$12 coffee at Blue Bottle”), voice notes, and receipt photos.
            </p>
            <div className="flex justify-center">
              <Button variant="primary" icon={Link2} onClick={onStartSetup}>
                Connect Telegram
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <ol className="space-y-3">
              {[
                <>
                  Open Telegram and message{' '}
                  <a href={pendingLink.deepLink} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--accent-a)' }} className="hover:underline">
                    @{pendingLink.botUsername}
                  </a>
                </>,
                <>
                  Send the bot this exact message:{' '}
                  <code style={{ padding: '2px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.06)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg)' }}>
                    /start {pendingLink.code}
                  </code>
                </>,
                <>The card here will flip to “Connected” within a few seconds.</>,
              ].map((instruction, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent-a)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}
                  >
                    {index + 1}
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)', paddingTop: 2 }}>{instruction}</span>
                </li>
              ))}
            </ol>

            {/* Link code */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg3)', marginBottom: 8 }}>
                Linking Code
              </p>
              <div className="flex items-center justify-between gap-2">
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--fg)' }}>{pendingLink.code}</p>
                <button
                  onClick={() => handleCopy(`/start ${pendingLink.code}`)}
                  className="rounded-lg px-3 py-1.5"
                  style={
                    copied
                      ? { background: 'rgba(74,222,128,0.1)', color: 'var(--good)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, border: 'none' }
                      : { background: 'rgba(255,255,255,0.04)', color: 'var(--fg2)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, border: '1px solid var(--card-border)' }
                  }
                >
                  {copied ? 'Copied!' : 'Copy /start command'}
                </button>
              </div>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg3)', marginTop: 8 }}>
                Expires at {new Date(pendingLink.expiresAt).toLocaleTimeString()}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={onCancelSetup}>
                Cancel
              </Button>
              <Button variant="primary" fullWidth onClick={onRefresh}>
                I&rsquo;ve sent it — refresh
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
