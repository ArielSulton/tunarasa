'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ServiceMode } from '@/lib/db/schema'

interface ServiceConfig {
  serviceMode: ServiceMode
  description: string
  loading: boolean
  error: string | null
}

interface ServiceConfigActions {
  updateServiceMode: (mode: ServiceMode) => Promise<boolean>
  refreshConfig: () => Promise<void>
}

export function useServiceConfig(): ServiceConfig & ServiceConfigActions {
  const [config, setConfig] = useState<ServiceConfig>({
    serviceMode: 'full_llm_bot',
    description: '',
    loading: true,
    error: null,
  })

  const fetchConfig = useCallback(async () => {
    try {
      setConfig((prev) => ({ ...prev, loading: true, error: null }))

      const response = await fetch('/api/service-config')
      const data = await response.json()

      if (data.success) {
        setConfig((prev) => ({
          ...prev,
          serviceMode: data.serviceMode,
          description: data.description,
          loading: false,
        }))
      } else {
        throw new Error(data.error ?? 'Failed to fetch service configuration')
      }
    } catch (error) {
      console.error('Error fetching service config:', error)
      setConfig((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      }))
    }
  }, [])

  const updateServiceMode = useCallback(async (mode: ServiceMode): Promise<boolean> => {
    try {
      setConfig((prev) => ({ ...prev, loading: true, error: null }))

      const response = await fetch('/api/service-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serviceMode: mode }),
      })

      const data = await response.json()

      if (data.success) {
        setConfig((prev) => ({
          ...prev,
          serviceMode: data.serviceMode,
          description: data.description,
          loading: false,
        }))
        return true
      } else {
        throw new Error(data.error ?? 'Failed to update service configuration')
      }
    } catch (error) {
      console.error('Error updating service config:', error)
      setConfig((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      }))
      return false
    }
  }, [])

  const refreshConfig = useCallback(async () => {
    await fetchConfig()
  }, [fetchConfig])

  // Load initial config
  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  return {
    ...config,
    updateServiceMode,
    refreshConfig,
  }
}

// Lightweight hook for just reading the service mode
export function useServiceMode(): { serviceMode: ServiceMode; loading: boolean } {
  const [serviceMode, setServiceMode] = useState<ServiceMode>('full_llm_bot')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMode = async () => {
      try {
        const response = await fetch('/api/service-config')
        const data = await response.json()

        if (data.success) {
          setServiceMode(data.serviceMode)
        }
      } catch (error) {
        console.error('Error fetching service mode:', error)
      } finally {
        setLoading(false)
      }
    }

    void fetchMode()
  }, [])

  return { serviceMode, loading }
}
