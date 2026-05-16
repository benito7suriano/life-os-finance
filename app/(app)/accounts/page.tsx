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
import sampleData from '@/components/accounts/sample-data.json'
import type {
  Account,
  Institution,
  CreditCardProvider,
} from '@/components/accounts/types'

const sampleInstitutions = sampleData.institutions as Institution[]
const sampleProviders = sampleData.creditCardProviders as CreditCardProvider[]
const sampleAccounts = sampleData.accounts as Account[]

export default function AccountsPage() {
  // Reference data
  const [institutions, setInstitutions] = useState<Institution[]>(sampleInstitutions)
  const [creditCardProviders, setCreditCardProviders] = useState<CreditCardProvider[]>(sampleProviders)
  const [useApi, setUseApi] = useState(false)

  // Account data
  const [accounts, setAccounts] = useState<Account[]>(sampleAccounts)

  // UI state
  const [showArchived, setShowArchived] = useState(false)

  // Undo toast state
  const [deletedAccount, setDeletedAccount] = useState<{ id: string; name: string } | null>(null)
  // Keep a backup of the deleted account for sample-data undo
  const [deletedBackup, setDeletedBackup] = useState<Account | null>(null)

  // Load reference data from Supabase on mount
  useEffect(() => {
    async function loadReferenceData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUseApi(true)

      try {
        const [{ institutions: dbInstitutions }, { providers: dbProviders }] = await Promise.all([
          listInstitutions(),
          listCreditCardProviders(),
        ])
        if (dbInstitutions && dbInstitutions.length > 0) {
          setInstitutions(dbInstitutions as Institution[])
        }
        if (dbProviders && dbProviders.length > 0) {
          setCreditCardProviders(dbProviders as CreditCardProvider[])
        }
      } catch {
        // API not available — keep sample data
      }
    }
    loadReferenceData()
  }, [])

  // Fetch accounts from API
  const fetchAccounts = useCallback(async () => {
    if (!useApi) return

    try {
      const data = await listAccounts({ archived: showArchived })
      if (data.accounts && data.accounts.length > 0) {
        setAccounts(data.accounts as Account[])
      } else if (!showArchived) {
        // If no active accounts from API, fall back to sample data
        setUseApi(false)
        setInstitutions(sampleInstitutions)
        setCreditCardProviders(sampleProviders)
        setAccounts(sampleAccounts)
      } else {
        setAccounts([])
      }
    } catch {
      // API not available, keep using sample data
    }
  }, [useApi, showArchived])

  useEffect(() => {
    if (useApi) {
      fetchAccounts()
    }
  }, [useApi, fetchAccounts])

  // CRUD handlers
  const handleSave = useCallback(
    async (data: Partial<Account>) => {
      if (useApi) {
        try {
          if (data.id) {
            await updateAccount(data.id, data as Record<string, unknown>)
          } else {
            await createAccount(data as Record<string, unknown>)
          }
          await fetchAccounts()
        } catch {
          // Ignore
        }
      } else {
        // Sample data mode: local state update
        if (data.id) {
          setAccounts((prev) =>
            prev.map((a) => (a.id === data.id ? ({ ...a, ...data } as Account) : a))
          )
        } else {
          const newAccount = {
            ...data,
            id: `acc-${Date.now()}`,
            balanceChange: 0,
          } as Account
          setAccounts((prev) => [newAccount, ...prev])
        }
      }
    },
    [useApi, fetchAccounts]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      const account = accounts.find((a) => a.id === id)
      if (!account) return

      if (useApi) {
        try {
          await deleteAccount(id)
          setDeletedAccount({ id, name: account.name })
          setDeletedBackup(null)
          await fetchAccounts()
        } catch {
          // Ignore
        }
      } else {
        // Sample data mode: remove from state but keep backup for undo
        setDeletedBackup(account)
        setAccounts((prev) => prev.filter((a) => a.id !== id))
        setDeletedAccount({ id, name: account.name })
      }
    },
    [useApi, accounts, fetchAccounts]
  )

  const handleRestore = useCallback(
    async (id: string) => {
      if (useApi) {
        try {
          await restoreAccount(id)
          setDeletedAccount(null)
          setDeletedBackup(null)
          await fetchAccounts()
        } catch {
          // Ignore
        }
      } else {
        // Sample data mode: re-add from backup
        if (deletedBackup && deletedBackup.id === id) {
          setAccounts((prev) => [...prev, deletedBackup])
        }
        setDeletedAccount(null)
        setDeletedBackup(null)
      }
    },
    [useApi, deletedBackup, fetchAccounts]
  )

  const handleUndoDismiss = useCallback(() => {
    setDeletedAccount(null)
    setDeletedBackup(null)
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
