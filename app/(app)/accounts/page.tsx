'use client'

import { useState, useEffect, useCallback } from 'react'
import { AccountsView, UndoToast } from '@/components/accounts'
import { createClient } from '@/lib/supabase/client'
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  restoreAccount,
  listInstitutions,
  listCreditCardProviders,
} from '@/lib/api/client'
import type {
  Account,
  Institution,
  CreditCardProvider,
} from '@/components/accounts/types'

export default function AccountsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [creditCardProviders, setCreditCardProviders] = useState<CreditCardProvider[]>([])
  const [isAuthed, setIsAuthed] = useState(false)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [showArchived, setShowArchived] = useState(false)

  const [deletedAccount, setDeletedAccount] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    async function loadReferenceData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setIsAuthed(true)

      const [instSettled, provSettled] = await Promise.allSettled([
        listInstitutions(),
        listCreditCardProviders(),
      ])
      if (instSettled.status === 'fulfilled') {
        setInstitutions((instSettled.value.institutions || []) as Institution[])
      } else {
        console.error('[accounts] listInstitutions failed', instSettled.reason)
      }
      if (provSettled.status === 'fulfilled') {
        setCreditCardProviders((provSettled.value.providers || []) as CreditCardProvider[])
      } else {
        console.error('[accounts] listCreditCardProviders failed', provSettled.reason)
      }
    }
    loadReferenceData()
  }, [])

  const fetchAccounts = useCallback(async () => {
    if (!isAuthed) return
    try {
      const data = await listAccounts({ archived: showArchived })
      setAccounts((data.accounts || []) as Account[])
    } catch (e) {
      console.error('[accounts] fetch failed', e)
    }
  }, [isAuthed, showArchived])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data loading is the effect's external synchronization
    if (isAuthed) fetchAccounts()
  }, [isAuthed, fetchAccounts])

  const handleSave = useCallback(
    async (data: Partial<Account>) => {
      try {
        if (data.id) {
          await updateAccount(data.id, data as Record<string, unknown>)
        } else {
          await createAccount(data as Record<string, unknown>)
        }
        await fetchAccounts()
      } catch (e) {
        console.error('[accounts] save failed', e)
      }
    },
    [fetchAccounts]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      const account = accounts.find((a) => a.id === id)
      if (!account) return
      try {
        await deleteAccount(id)
        setDeletedAccount({ id, name: account.name })
        await fetchAccounts()
      } catch (e) {
        console.error('[accounts] delete failed', e)
      }
    },
    [accounts, fetchAccounts]
  )

  const handleRestore = useCallback(
    async (id: string) => {
      try {
        await restoreAccount(id)
        setDeletedAccount(null)
        await fetchAccounts()
      } catch (e) {
        console.error('[accounts] restore failed', e)
      }
    },
    [fetchAccounts]
  )

  const handleUndoDismiss = useCallback(() => {
    setDeletedAccount(null)
  }, [])

  const handleToggleArchived = useCallback(() => {
    setShowArchived((prev) => !prev)
  }, [])

  return (
    <>
      <AccountsView
        accounts={accounts}
        institutions={institutions}
        creditCardProviders={creditCardProviders}
        showArchived={showArchived}
        onToggleArchived={handleToggleArchived}
        onDeleteAccount={handleDelete}
        onRestoreAccount={handleRestore}
        onSave={handleSave}
      />

      {deletedAccount && (
        <UndoToast
          message={`"${deletedAccount.name}" was deleted`}
          onUndo={() => handleRestore(deletedAccount.id)}
          onDismiss={handleUndoDismiss}
          durationMs={10000}
        />
      )}
    </>
  )
}
