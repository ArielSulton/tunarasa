'use client'

import { useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { adminApiClient } from '@/lib/api/admin-client'

/**
 * Custom hook that provides authenticated admin API client methods
 * This hook handles Clerk authentication automatically for client components
 */
export function useAdminClient() {
  const { getToken } = useAuth()

  // Memoized dashboard methods
  const getDashboardStats = useCallback(async () => {
    const token = await getToken()
    return adminApiClient.getDashboardStats(token ?? undefined)
  }, [getToken])

  const getSessions = useCallback(async () => {
    const token = await getToken()
    return adminApiClient.getSessions(token ?? undefined)
  }, [getToken])

  const getSystemMetrics = useCallback(async () => {
    const token = await getToken()
    return adminApiClient.getSystemMetrics(token ?? undefined)
  }, [getToken])

  const getHealthStatus = useCallback(async () => {
    const token = await getToken()
    return adminApiClient.getHealthStatus(token ?? undefined)
  }, [getToken])

  const getGestureAnalytics = useCallback(
    async (params?: { timeframe?: string; format?: string }) => {
      const token = await getToken()
      return adminApiClient.getGestureAnalytics(params, token ?? undefined)
    },
    [getToken],
  )

  const updateSettings = useCallback(
    async (settings: Record<string, unknown>) => {
      const token = await getToken()
      return adminApiClient.updateSettings(settings, token ?? undefined)
    },
    [getToken],
  )

  return {
    getDashboardStats,
    getSessions,
    getSystemMetrics,
    getHealthStatus,
    getGestureAnalytics,
    updateSettings,
    // For direct access if needed
    client: adminApiClient,
    getToken,
  }
}
