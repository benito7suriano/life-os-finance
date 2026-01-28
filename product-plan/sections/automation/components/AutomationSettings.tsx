import type { AutomationProps } from '../types'
import { ChannelCard } from './ChannelCard'
import { SetupCard } from './SetupCard'

export function AutomationSettings({
  config,
  channels,
  pendingVerification,
  onStartWhatsAppSetup,
  onSubmitVerificationCode,
  onCancelWhatsAppSetup,
  onCopyEmailAddress,
  onPauseChannel,
  onResumeChannel,
  onDisconnectChannel
}: AutomationProps) {
  const whatsappChannel = channels.find(c => c.type === 'whatsapp')
  const emailChannel = channels.find(c => c.type === 'email')

  const whatsappConnected = whatsappChannel && whatsappChannel.status !== 'disconnected'
  const emailConnected = emailChannel && emailChannel.status !== 'disconnected'

  // Generate a sample email address for setup flow (in real app, this would come from backend)
  const generatedEmailAddress = `user-${Math.random().toString(36).slice(2, 8)}@${config.emailDomain}`

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Automation
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Connect channels to automatically log transactions from receipts and messages
          </p>
        </div>

        {/* Info banner */}
        <div className="mb-8 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                How it works
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                Forward receipts via WhatsApp or email. Our AI reads the receipt and logs the transaction automatically.
                If something can't be parsed, it'll appear in your Transactions for manual review.
              </p>
            </div>
          </div>
        </div>

        {/* Channel cards */}
        <div className="space-y-6">
          {/* WhatsApp */}
          {whatsappConnected && whatsappChannel ? (
            <ChannelCard
              channel={whatsappChannel}
              config={config}
              onPause={() => onPauseChannel?.(whatsappChannel.id)}
              onResume={() => onResumeChannel?.(whatsappChannel.id)}
              onDisconnect={() => onDisconnectChannel?.(whatsappChannel.id)}
            />
          ) : (
            <SetupCard
              type="whatsapp"
              config={config}
              pendingVerification={pendingVerification}
              onStartSetup={onStartWhatsAppSetup}
              onSubmitCode={onSubmitVerificationCode}
              onCancelSetup={onCancelWhatsAppSetup}
            />
          )}

          {/* Email */}
          {emailConnected && emailChannel ? (
            <ChannelCard
              channel={emailChannel}
              config={config}
              onPause={() => onPauseChannel?.(emailChannel.id)}
              onResume={() => onResumeChannel?.(emailChannel.id)}
              onDisconnect={() => onDisconnectChannel?.(emailChannel.id)}
              onCopyAddress={onCopyEmailAddress}
            />
          ) : (
            <SetupCard
              type="email"
              config={config}
              generatedEmailAddress={generatedEmailAddress}
              onCopyAddress={onCopyEmailAddress}
            />
          )}
        </div>

        {/* Tips section */}
        <div className="mt-12">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4">
            Tips for best results
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                Clear photos
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Make sure the receipt is well-lit and the text is readable. Avoid blurry or cropped images.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                Digital receipts
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Forward email receipts directly. PDF attachments and inline images both work great.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                Auto-categorization
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                We detect merchants and assign categories automatically based on your past transactions.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                Real-time logging
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Transactions appear in your log within seconds of sending the receipt.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
