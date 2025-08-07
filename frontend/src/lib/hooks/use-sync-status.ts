import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/SupabaseAuthProvider'

interface SyncStatus {
  isLoading: boolean
  isCompleted: boolean
  hasError: boolean
  error?: string
  retryCount: number
  userData?: {
    userId: number
    email: string
    roleId: number
  }
}

interface UseSyncStatusOptions {
  autoRetry?: boolean
  maxRetries?: number
  retryDelay?: number
}

export function useSyncStatus(options: UseSyncStatusOptions = {}) {
  const { autoRetry = true, maxRetries = 3, retryDelay = 2000 } = options
  const { user, loading: authLoading } = useAuth()

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isLoading: false,
    isCompleted: false,
    hasError: false,
    retryCount: 0,
  })

  const checkSyncStatus = useCallback(async () => {
    if (!user?.id || authLoading) return

    setSyncStatus((prev) => ({ ...prev, isLoading: true, hasError: false }))

    try {
      const response = await fetch(`/api/auth/sync?userId=${user.id}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? 'Failed to check sync status')
      }

      setSyncStatus((prev) => ({
        ...prev,
        isLoading: false,
        isCompleted: result.exists,
        userData: result.userData ?? undefined,
        hasError: false,
      }))

      return result.exists
    } catch (error) {
      console.error('Error checking sync status:', error)
      setSyncStatus((prev) => ({
        ...prev,
        isLoading: false,
        hasError: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
      return false
    }
  }, [user?.id, authLoading])

  const triggerSync = useCallback(async () => {
    if (!user?.id || !user?.email) return false

    setSyncStatus((prev) => ({
      ...prev,
      isLoading: true,
      hasError: false,
      retryCount: prev.retryCount + 1,
    }))

    try {
      const response = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          userData: {
            first_name: user.user_metadata?.first_name ?? null,
            last_name: user.user_metadata?.last_name ?? null,
            full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
            image_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
            user_metadata: user.user_metadata ?? {},
            email_confirmed_at: user.email_confirmed_at,
          },
          isNewUser: !user.email_confirmed_at,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? 'Sync failed')
      }

      setSyncStatus((prev) => ({
        ...prev,
        isLoading: false,
        isCompleted: true,
        hasError: false,
        userData: result.data,
      }))

      // Clear any pending sync data from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pending_user_sync')
      }

      return true
    } catch (error) {
      console.error('Error triggering sync:', error)
      setSyncStatus((prev) => ({
        ...prev,
        isLoading: false,
        hasError: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
      return false
    }
  }, [user])

  const retrySync = useCallback(async () => {
    if (syncStatus.retryCount >= maxRetries) {
      console.warn('Maximum retry attempts reached')
      return false
    }

    // Add delay before retry
    await new Promise((resolve) => setTimeout(resolve, retryDelay))
    return triggerSync()
  }, [syncStatus.retryCount, maxRetries, retryDelay, triggerSync])

  // Auto-check sync status when user is loaded
  useEffect(() => {
    if (user && !authLoading && !syncStatus.isCompleted && !syncStatus.isLoading) {
      void checkSyncStatus()
    }
  }, [user, authLoading, syncStatus.isCompleted, syncStatus.isLoading, checkSyncStatus])

  // Auto-retry sync if enabled and there's an error
  useEffect(() => {
    if (
      autoRetry &&
      syncStatus.hasError &&
      !syncStatus.isCompleted &&
      !syncStatus.isLoading &&
      syncStatus.retryCount < maxRetries
    ) {
      console.log(`Auto-retrying sync (attempt ${syncStatus.retryCount + 1}/${maxRetries})`)
      void retrySync()
    }
  }, [
    autoRetry,
    syncStatus.hasError,
    syncStatus.isCompleted,
    syncStatus.isLoading,
    syncStatus.retryCount,
    maxRetries,
    retrySync,
  ])

  // Check for pending sync data on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && user && !syncStatus.isCompleted) {
      const pendingSync = localStorage.getItem('pending_user_sync')
      if (pendingSync) {
        try {
          const syncData = JSON.parse(pendingSync) as {
            userId: string
            timestamp: number
          }

          // If pending sync is for current user and recent (< 1 hour)
          if (syncData.userId === user.id && Date.now() - syncData.timestamp < 3600000) {
            console.log('Found pending sync, triggering retry...')
            void triggerSync()
          } else {
            localStorage.removeItem('pending_user_sync')
          }
        } catch (error) {
          console.error('Error processing pending sync:', error)
          localStorage.removeItem('pending_user_sync')
        }
      }
    }
  }, [user, syncStatus.isCompleted, triggerSync])

  return {
    ...syncStatus,
    checkSyncStatus,
    triggerSync,
    retrySync,
  }
}
