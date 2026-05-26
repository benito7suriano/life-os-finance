'use client'

import type { DeleteConfirmDialogProps } from './types'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui'

export function DeleteConfirmDialog({ isOpen, onClose, onConfirm, transactionDescription }: DeleteConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} onClick={onClose} />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md p-6"
        style={{ background: 'var(--bg2)', border: '1px solid var(--card-border)', borderRadius: 18, boxShadow: '0 40px 100px -30px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--bad)' }}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--fg)' }}>Delete Transaction</h3>
            <p style={{ marginTop: 8, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg2)' }}>
              Are you sure you want to delete &ldquo;{transactionDescription}&rdquo;?
            </p>
            <p style={{ marginTop: 4, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--bad)' }}>
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
