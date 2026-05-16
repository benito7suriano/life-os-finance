'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Undo2 } from 'lucide-react'
import type { UndoToastProps } from './types'

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
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3
                    bg-slate-900 dark:bg-slate-700 text-white
                    px-4 py-3 rounded-lg shadow-lg">
      <span className="text-sm">{message}</span>
      <button
        onClick={handleUndo}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md
                   bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium
                   transition-colors"
      >
        <Undo2 className="w-4 h-4" />
        Undo
      </button>
      <button
        onClick={handleClose}
        className="p-1 rounded hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
