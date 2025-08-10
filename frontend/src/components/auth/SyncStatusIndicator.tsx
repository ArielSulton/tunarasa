'use client'

import { useEffect, useState } from 'react'
import { useSyncStatus } from '@/hooks/use-sync-status'
import { useAuth } from '@/components/auth/SupabaseAuthProvider'

interface SyncStatusIndicatorProps {
  className?: string
  showDetails?: boolean
}

export function SyncStatusIndicator({ className = '', showDetails = false }: SyncStatusIndicatorProps) {
  const { user, loading: authLoading } = useAuth()
  const { isLoading, isCompleted, hasError, error, retryCount, triggerSync, userData } = useSyncStatus()

  const [showRetryButton, setShowRetryButton] = useState(false)

  // Show retry button after a few seconds of error state
  useEffect(() => {
    if (hasError) {
      const timer = setTimeout(() => setShowRetryButton(true), 3000)
      return () => clearTimeout(timer)
    } else {
      setShowRetryButton(false)
    }
  }, [hasError])

  // Don't show indicator if auth is still loading
  if (authLoading || !user) {
    return null
  }

  // Don't show if sync is completed and no error
  if (isCompleted && !hasError) {
    return null
  }

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <div className="max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start space-x-3">
          {/* Status Icon */}
          <div className="flex-shrink-0">
            {isLoading && <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-blue-600"></div>}
            {hasError && !isLoading && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100">
                <svg className="h-3 w-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
            {isCompleted && !hasError && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                <svg className="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Status Content */}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {isLoading && 'Synchronizing account...'}
              {hasError && !isLoading && 'Account sync failed'}
              {isCompleted && 'Account synchronized'}
            </div>

            {showDetails && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {isLoading && <span>Setting up your account access...</span>}
                {hasError && (
                  <div>
                    <div>Please wait while we retry the connection.</div>
                    {retryCount > 0 && <div className="mt-1">Retry attempt: {retryCount}/3</div>}
                    {error && <div className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</div>}
                  </div>
                )}
                {isCompleted && userData && (
                  <div>
                    Welcome! Role: {userData.roleId === 1 ? 'Super Admin' : userData.roleId === 2 ? 'Admin' : 'User'}
                  </div>
                )}
              </div>
            )}

            {/* Retry Button */}
            {showRetryButton && hasError && (
              <button
                onClick={() => {
                  setShowRetryButton(false)
                  void triggerSync()
                }}
                className="mt-2 inline-flex items-center rounded border border-transparent bg-blue-100 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
              >
                Retry Now
              </button>
            )}
          </div>

          {/* Dismiss Button for completed state */}
          {isCompleted && (
            <button
              onClick={() => {
                // This would need to be handled by parent component
                // For now, just hide the indicator
                setShowRetryButton(false)
              }}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SyncStatusIndicator
