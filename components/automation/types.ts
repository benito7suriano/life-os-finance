// =============================================================================
// Data Types — Telegram automation channel
// =============================================================================

export type ChannelType = 'telegram'
export type ChannelStatus = 'connected' | 'paused' | 'disconnected'

export interface TelegramDetails {
  /** The display @handle of the linked Telegram user (no leading @). */
  username: string | null
  /** Bot username (for deep-link generation). */
  botUsername: string
}

export interface AutomationChannel {
  id: string
  type: ChannelType
  status: ChannelStatus
  connectedAt: string | null
  lastActivityAt: string | null
  pausedAt?: string | null
  transactionsLogged: number
  telegramDetails?: TelegramDetails
}

/** Returned by POST /api/automation/telegram { action: 'setup' } */
export interface PendingTelegramLink {
  /** 6-digit code the user sends to the bot via /start <code>. */
  code: string
  /** ISO-8601 expiry. */
  expiresAt: string
  /** Bot username for the deep link `https://t.me/<botUsername>?start=<code>` */
  botUsername: string
  /** Full deep link, pre-built for convenience. */
  deepLink: string
}

// =============================================================================
// Component Props
// =============================================================================

export interface AutomationProps {
  /** List of automation channels (one Telegram channel max for now). */
  channels: AutomationChannel[]

  /** Pending Telegram link request (null if not in setup flow). */
  pendingLink: PendingTelegramLink | null

  /** Called when user requests to start Telegram connection. */
  onStartTelegramSetup?: () => void

  /** Called when user cancels Telegram setup. */
  onCancelTelegramSetup?: () => void

  /** Called when user pauses a channel. */
  onPauseChannel?: (channelId: string) => void

  /** Called when user resumes a paused channel. */
  onResumeChannel?: (channelId: string) => void

  /** Called when user disconnects a channel. */
  onDisconnectChannel?: (channelId: string) => void

  /** Called when user refreshes channel state (e.g. polling after sending /start). */
  onRefresh?: () => void
}
