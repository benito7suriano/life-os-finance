import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AutomationSettings } from '../AutomationSettings'
import type {
  AutomationChannel,
  AutomationProps,
  PendingTelegramLink,
} from '../types'

const writeTextMock = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  writeTextMock.mockClear()
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  })
})

const baseProps: AutomationProps = {
  channels: [],
  pendingLink: null,
}

const connectedChannel: AutomationChannel = {
  id: 'ch-1',
  type: 'telegram',
  status: 'connected',
  connectedAt: '2026-05-01T12:00:00Z',
  lastActivityAt: '2026-05-16T18:00:00Z',
  transactionsLogged: 12,
  telegramDetails: { username: 'beno', botUsername: 'bjs_ledger_bot' },
}

const pendingLink: PendingTelegramLink = {
  code: '482917',
  expiresAt: new Date(Date.now() + 9 * 60 * 1000).toISOString(),
  botUsername: 'bjs_ledger_bot',
  deepLink: 'https://t.me/bjs_ledger_bot?start=482917',
}

describe('AutomationSettings — error banner', () => {
  it('renders the error and dismisses it', async () => {
    const user = userEvent.setup()
    const onDismissError = vi.fn()
    render(
      <AutomationSettings
        {...baseProps}
        error="Could not start Telegram setup."
        onDismissError={onDismissError}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Could not start Telegram setup.')
    await user.click(screen.getByLabelText('Dismiss error'))
    expect(onDismissError).toHaveBeenCalledOnce()
  })

  it('renders no banner when there is no error', () => {
    render(<AutomationSettings {...baseProps} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('AutomationSettings — Telegram', () => {
  it('shows the Connect Telegram button when no channel is connected', () => {
    render(<AutomationSettings {...baseProps} />)
    expect(screen.getByRole('button', { name: /connect telegram/i })).toBeInTheDocument()
  })

  it('calls onStartTelegramSetup when Connect is clicked', async () => {
    const onStartTelegramSetup = vi.fn()
    render(<AutomationSettings {...baseProps} onStartTelegramSetup={onStartTelegramSetup} />)
    await userEvent.click(screen.getByRole('button', { name: /connect telegram/i }))
    expect(onStartTelegramSetup).toHaveBeenCalledTimes(1)
  })

  it('renders the link code and deep link once setup is pending', () => {
    render(<AutomationSettings {...baseProps} pendingLink={pendingLink} />)
    expect(screen.getByText(pendingLink.code)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /@bjs_ledger_bot/i })).toHaveAttribute(
      'href',
      pendingLink.deepLink
    )
    // The /start instruction appears inline in the instructions.
    expect(
      screen.getByText((_, el) => el?.textContent === `/start ${pendingLink.code}`)
    ).toBeInTheDocument()
  })

  it('copies the /start command to clipboard', async () => {
    render(<AutomationSettings {...baseProps} pendingLink={pendingLink} />)
    await userEvent.click(screen.getByRole('button', { name: /copy \/start/i }))
    expect(writeTextMock).toHaveBeenCalledWith(`/start ${pendingLink.code}`)
  })

  it('calls onCancelTelegramSetup from the pending state', async () => {
    const onCancelTelegramSetup = vi.fn()
    render(
      <AutomationSettings
        {...baseProps}
        pendingLink={pendingLink}
        onCancelTelegramSetup={onCancelTelegramSetup}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onCancelTelegramSetup).toHaveBeenCalledTimes(1)
  })

  it('calls onRefresh when the user taps "I\'ve sent it — refresh"', async () => {
    const onRefresh = vi.fn()
    render(
      <AutomationSettings {...baseProps} pendingLink={pendingLink} onRefresh={onRefresh} />
    )
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('renders connected card when a Telegram channel is connected', () => {
    render(<AutomationSettings {...baseProps} channels={[connectedChannel]} />)
    expect(screen.getByText('@beno')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    // "Connected" appears as both a status badge and in the "Connected <date>" footer.
    expect(screen.getAllByText(/connected/i).length).toBeGreaterThan(0)
    // The setup button should NOT appear.
    expect(
      screen.queryByRole('button', { name: /connect telegram/i })
    ).not.toBeInTheDocument()
  })

  it('triggers pause/resume/disconnect handlers', async () => {
    const onPauseChannel = vi.fn()
    const onResumeChannel = vi.fn()
    const onDisconnectChannel = vi.fn()
    const { rerender } = render(
      <AutomationSettings
        {...baseProps}
        channels={[connectedChannel]}
        onPauseChannel={onPauseChannel}
        onResumeChannel={onResumeChannel}
        onDisconnectChannel={onDisconnectChannel}
      />
    )

    // Pause toggle
    await userEvent.click(screen.getByRole('button', { name: /pause channel/i }))
    expect(onPauseChannel).toHaveBeenCalledWith(connectedChannel.id)

    // Re-render as paused → toggle should resume
    rerender(
      <AutomationSettings
        {...baseProps}
        channels={[{ ...connectedChannel, status: 'paused', pausedAt: '2026-05-16T18:30:00Z' }]}
        onPauseChannel={onPauseChannel}
        onResumeChannel={onResumeChannel}
        onDisconnectChannel={onDisconnectChannel}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /resume channel/i }))
    expect(onResumeChannel).toHaveBeenCalledWith(connectedChannel.id)

    // Disconnect (two-step confirm)
    await userEvent.click(screen.getByRole('button', { name: /^disconnect$/i }))
    await userEvent.click(screen.getAllByRole('button', { name: /^disconnect$/i }).pop()!)
    expect(onDisconnectChannel).toHaveBeenCalledWith(connectedChannel.id)
  })
})
