'use client'

import { useState, useEffect, useCallback } from 'react'
import { AutomationSettings } from '@/components/automation'
import { createClient } from '@/lib/supabase/client'
import type {
  AutomationChannel,
  PendingTelegramLink,
} from '@/components/automation/types'

export default function AutomationPage() {
  const [channels, setChannels] = useState<AutomationChannel[]>([])
  const [pendingLink, setPendingLink] = useState<PendingTelegramLink | null>(null)
  const [useApi, setUseApi] = useState(false)

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/channels')
      if (!res.ok) return
      const data = await res.json()
      setChannels(data.channels ?? [])
    } catch {
      // Offline / demo mode — leave channels empty.
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
    if (!useApi) {
      // Demo mode: fabricate a pending link.
      setPendingLink({
        code: '123456',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        botUsername: 'demo_bot',
        deepLink: 'https://t.me/demo_bot?start=123456',
      })
      return
    }

    try {
      const res = await fetch('/api/automation/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      })
      if (!res.ok) return
      const data = await res.json()
      setPendingLink(data.pendingLink)
    } catch {
      // Ignore
    }
  }, [useApi])

  const handleCancelTelegramSetup = useCallback(async () => {
    setPendingLink(null)
    if (!useApi) return
    try {
      await fetch('/api/automation/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
    } catch {
      // Ignore
    }
  }, [useApi])

  const handleRefresh = useCallback(async () => {
    if (useApi) await fetchChannels()
  }, [useApi, fetchChannels])

  const handlePauseChannel = useCallback(
    async (channelId: string) => {
      if (useApi) {
        try {
          await fetch(`/api/automation/channels/${channelId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'pause' }),
          })
          await fetchChannels()
        } catch {
          // Ignore
        }
      } else {
        setChannels(prev =>
          prev.map(c =>
            c.id === channelId
              ? { ...c, status: 'paused' as const, pausedAt: new Date().toISOString() }
              : c
          )
        )
      }
    },
    [useApi, fetchChannels]
  )

  const handleResumeChannel = useCallback(
    async (channelId: string) => {
      if (useApi) {
        try {
          await fetch(`/api/automation/channels/${channelId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'resume' }),
          })
          await fetchChannels()
        } catch {
          // Ignore
        }
      } else {
        setChannels(prev =>
          prev.map(c =>
            c.id === channelId
              ? { ...c, status: 'connected' as const, pausedAt: null }
              : c
          )
        )
      }
    },
    [useApi, fetchChannels]
  )

  const handleDisconnectChannel = useCallback(
    async (channelId: string) => {
      if (useApi) {
        try {
          await fetch(`/api/automation/channels/${channelId}`, {
            method: 'DELETE',
          })
          await fetchChannels()
        } catch {
          // Ignore
        }
      } else {
        setChannels(prev => prev.filter(c => c.id !== channelId))
      }
    },
    [useApi, fetchChannels]
  )

  return (
    <AutomationSettings
      channels={channels}
      pendingLink={pendingLink}
      onStartTelegramSetup={handleStartTelegramSetup}
      onCancelTelegramSetup={handleCancelTelegramSetup}
      onPauseChannel={handlePauseChannel}
      onResumeChannel={handleResumeChannel}
      onDisconnectChannel={handleDisconnectChannel}
      onRefresh={handleRefresh}
    />
  )
}
