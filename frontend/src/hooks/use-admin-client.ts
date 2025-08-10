'use client'

import { useState, useEffect, useCallback } from 'react'
import { adminApiClient, type AdminSession, type GestureAnalytics } from '@/lib/api/admin-client'

interface UseAdminClientReturn {
  sessions: AdminSession[]
  analytics: GestureAnalytics | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  getDashboardStats: () => Promise<{
    success: boolean
    data: { totalUsers: number; activeToday: number; avgSessionDuration: number }
    error?: string
  }>
  getSessions: () => { success: boolean; data: AdminSession[]; error?: string }
  getGestureAnalytics: () => GestureAnalytics | null
  getSystemMetrics: () => Promise<{
    success: boolean
    data: { uptime: number; memoryUsage: number; responseTime: number }
    error?: string
  }>
  updateSettings: (settings: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>
}

export function useAdminClient(timeRange: '7d' | '30d' | '90d' = '30d'): UseAdminClientReturn {
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [analytics, setAnalytics] = useState<GestureAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [sessionsData, analyticsResponse] = await Promise.all([
        adminApiClient.getRecentSessions(10),
        adminApiClient.getGestureAnalytics(timeRange),
      ])

      setSessions(sessionsData)
      if (analyticsResponse.success && analyticsResponse.data) {
        setAnalytics(analyticsResponse.data)
      } else {
        setError(analyticsResponse.error ?? 'Failed to fetch analytics')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch admin data'
      setError(errorMessage)
      console.error('Admin client error:', err)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const getDashboardStats = () => {
    // Mock implementation - replace with actual API call
    return Promise.resolve({
      success: true,
      data: {
        totalUsers: 150,
        activeToday: 23,
        avgSessionDuration: 8.5,
      },
    })
  }

  const getSystemMetrics = () => {
    // Mock implementation - replace with actual API call
    return Promise.resolve({
      success: true,
      data: {
        uptime: 99.9,
        memoryUsage: 65.2,
        responseTime: 120,
      },
    })
  }

  const updateSettings = (settings: Record<string, unknown>) => {
    // Mock implementation - replace with actual API call
    console.log('Updating settings:', settings)
    return Promise.resolve({ success: true })
  }

  return {
    sessions,
    analytics,
    loading,
    error,
    refetch: fetchData,
    getDashboardStats,
    getSessions: () => ({ success: true, data: sessions }),
    getGestureAnalytics: () => analytics,
    getSystemMetrics,
    updateSettings,
  }
}
