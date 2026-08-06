'use client'

import { useState, useEffect, useCallback } from 'react'
import { AutomationSettings } from '@/components/automation'
import { createClient } from '@/lib/supabase/client'
import type {
  AutomationChannel,
  PendingTelegramLink,
} from '@/components/automation/types'

/** Pull a human-readable message out of a failed fetch Response. */
async function responseError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}))
  return typeof body?.error === 'string' && body.error ? body.error : fallback
}

export default function AutomationPage() {
  const [channels, setChannels] = useState<AutomationChannel[]>([])
  const [pendingLink, setPendingLink] = useState<PendingTelegramLink | null>(null)
  const [useApi, setUseApi] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/channels')
      if (!res.ok) {
        setError(await responseError(res, 'Could not load channels.'))
        return
      }
      const data = await res.json()
      setChannels(data.channels ?? [])
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    }
  }, [])

  // Check auth on mount.
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUseApi(true)
    }
    init()
  }, [])

  useEffect(() => {
    if (useApi) fetchChannels()
  }, [useApi, fetchChannels])

  // Poll for connection while a link is pending (user might send /start any second).
  useEffect(() => {
    if (!useApi || !pendingLink) return
    const interval = setInterval(() => {
      fetchChannels().then(() => {
        // If we now have a connected channel, clear the pending link.
        setChannels(prev => {
          const connected = prev.find(
            c => c.type === 'telegram' && c.status === 'connected'
          )
          if (connected) {
            setPendingLink(null)
          }
          return prev
        })
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [useApi, pendingLink, fetchChannels])

  // --- Callbacks ---

  const handleStartTelegramSetup = useCallback(async () => {
    setError(null)
    if (!useApi) {
      setError('Sign in to connect Telegram.')
      return
    }

    try {
      const res = await fetch('/api/automation/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      })
      if (!res.ok) {
        setError(await responseError(res, 'Could not start Telegram setup.'))
        return
      }
      const data = await res.json()
      setPendingLink(data.pendingLink)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    }
  }, [useApi])

  const handleCancelTelegramSetup = useCallback(async () => {
    setPendingLink(null)
    if (!useApi) return
    try {
      const res = await fetch('/api/automation/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (!res.ok) setError(await responseError(res, 'Could not cancel setup.'))
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    }
  }, [useApi])

  const handleRefresh = useCallback(async () => {
    if (useApi) await fetchChannels()
  }, [useApi, fetchChannels])

  const channelAction = useCallback(
    async (channelId: string, init: RequestInit, fallbackError: string) => {
      setError(null)
      try {
        const res = await fetch(`/api/automation/channels/${channelId}`, init)
        if (!res.ok) {
          setError(await responseError(res, fallbackError))
          return
        }
        await fetchChannels()
      } catch {
        setError('Could not reach the server. Check your connection and try again.')
      }
    },
    [fetchChannels]
  )

  const handlePauseChannel = useCallback(
    (channelId: string) => {
      if (!useApi) return
      return channelAction(
        channelId,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pause' }),
        },
        'Could not pause the channel.'
      )
    },
    [useApi, channelAction]
  )

  const handleResumeChannel = useCallback(
    (channelId: string) => {
      if (!useApi) return
      return channelAction(
        channelId,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resume' }),
        },
        'Could not resume the channel.'
      )
    },
    [useApi, channelAction]
  )

  const handleDisconnectChannel = useCallback(
    (channelId: string) => {
      if (!useApi) return
      return channelAction(channelId, { method: 'DELETE' }, 'Could not disconnect the channel.')
    },
    [useApi, channelAction]
  )

  return (
    <AutomationSettings
      channels={channels}
      pendingLink={pendingLink}
      error={error}
      onDismissError={() => setError(null)}
      onStartTelegramSetup={handleStartTelegramSetup}
      onCancelTelegramSetup={handleCancelTelegramSetup}
      onPauseChannel={handlePauseChannel}
      onResumeChannel={handleResumeChannel}
      onDisconnectChannel={handleDisconnectChannel}
      onRefresh={handleRefresh}
    />
  )
}
