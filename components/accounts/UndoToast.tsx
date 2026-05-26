'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Undo2 } from 'lucide-react'
import type { UndoToastProps } from './types'
import { Button } from '@/components/ui'

export function UndoToast({ message, onUndo, onDismiss, durationMs = 10000 }: UndoToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, durationMs)
    return () => clearTimeout(timer)
  }, [durationMs, onDismiss])

  const handleUndo = useCallback(() => {
    setVisible(false)
    onUndo()
  }, [onUndo])

  const handleClose = useCallback(() => {
    setVisible(false)
    onDismiss()
  }, [onDismiss])

  if (!visible) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3"
      style={{ background: 'var(--bg2)', border: '1px solid var(--card-border)', borderRadius: 14, boxShadow: '0 30px 80px -30px rgba(0,0,0,0.7)', color: 'var(--fg)' }}
    >
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13 }}>{message}</span>
      <Button variant="primary" size="sm" icon={Undo2} onClick={handleUndo}>
        Undo
      </Button>
      <button onClick={handleClose} aria-label="Dismiss" className="flex h-7 w-7 items-center justify-center rounded-md" style={{ color: 'var(--fg3)' }}>
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
