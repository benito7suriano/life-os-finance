// =============================================================================
// Data Types
// =============================================================================

export type ChannelType = 'whatsapp' | 'email'
export type ChannelStatus = 'connected' | 'paused' | 'disconnected'

export interface WhatsAppDetails {
  linkedPhoneNumber: string
  linkedPhoneNumberMasked: string
}

export interface EmailDetails {
  forwardingAddress: string
}

export interface AutomationChannel {
  id: string
  type: ChannelType
  status: ChannelStatus
  connectedAt: string | null
  lastActivityAt: string | null
  pausedAt?: string | null
  transactionsLogged: number
  whatsappDetails?: WhatsAppDetails
  emailDetails?: EmailDetails
}

export interface SetupInstructions {
  whatsapp: string[]
  email: string[]
}

export interface AutomationConfig {
  whatsappBotNumber: string
  whatsappBotNumberRaw: string
  emailDomain: string
  verificationCodeLength: number
  setupInstructions: SetupInstructions
}

export interface PendingVerification {
  code: string
  expiresAt: string
  attempts: number
  maxAttempts: number
}

// =============================================================================
// Component Props
// =============================================================================

export interface AutomationProps {
  /** System configuration for automation setup */
  config: AutomationConfig

  /** List of automation channels (WhatsApp and/or email) */
  channels: AutomationChannel[]

  /** Pending verification for WhatsApp setup (null if not in setup flow) */
  pendingVerification: PendingVerification | null

  /** Called when user requests to start WhatsApp connection */
  onStartWhatsAppSetup?: () => void

  /** Called when user submits verification code */
  onSubmitVerificationCode?: (code: string) => void

  /** Called when user cancels WhatsApp setup */
  onCancelWhatsAppSetup?: () => void

  /** Called when user copies the email forwarding address */
  onCopyEmailAddress?: (address: string) => void

  /** Called when user pauses a channel */
  onPauseChannel?: (channelId: string) => void

  /** Called when user resumes a paused channel */
  onResumeChannel?: (channelId: string) => void

  /** Called when user disconnects a channel */
  onDisconnectChannel?: (channelId: string) => void

  /** Called when user confirms disconnection */
  onConfirmDisconnect?: (channelId: string) => void
}

// =============================================================================
// Channel Card Props
// =============================================================================

export interface ChannelCardProps {
  /** The automation channel to display */
  channel: AutomationChannel

  /** Configuration for setup instructions and bot details */
  config: AutomationConfig

  /** Called when user pauses the channel */
  onPause?: () => void

  /** Called when user resumes the channel */
  onResume?: () => void

  /** Called when user disconnects the channel */
  onDisconnect?: () => void
}

// =============================================================================
// Setup Flow Props
// =============================================================================

export interface WhatsAppSetupProps {
  /** Bot phone number to display */
  botPhoneNumber: string

  /** Setup instructions */
  instructions: string[]

  /** Pending verification details */
  verification: PendingVerification | null

  /** Called when user submits verification code */
  onSubmitCode?: (code: string) => void

  /** Called when user cancels setup */
  onCancel?: () => void
}

export interface EmailSetupProps {
  /** Unique forwarding address for this user */
  forwardingAddress: string

  /** Setup instructions */
  instructions: string[]

  /** Called when user copies the address */
  onCopy?: (address: string) => void
}
