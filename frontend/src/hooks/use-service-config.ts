'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ServiceMode } from '@/lib/db/schema'
import { serviceConfigCache } from '@/lib/cache/service-config-cache'

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
      // Check cache first (before setting loading state)
      const cached = serviceConfigCache.get('service-config') as ServiceConfig | null
      if (cached) {
        console.log('Using cached service config - no API call needed')
        setConfig((prev) => ({
          ...prev,
          serviceMode: cached.serviceMode,
          description: cached.description,
          loading: false,
          error: null,
        }))
        return
      }

      setConfig((prev) => ({ ...prev, loading: true, error: null }))

      // Add timeout and better error handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn('Service config request timed out after 10 seconds')
        controller.abort()
      }, 10000) // 10 second timeout (increased from 5)

      const response = await fetch('/api/service-config', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success) {
        // Cache the result
        serviceConfigCache.set('service-config', {
          serviceMode: data.serviceMode,
          description: data.description,
        })

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
      // Don't log AbortError as it's expected timeout behavior
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Service config request timed out - using cached or default mode')
      } else {
        console.error('Error fetching service config:', error)
      }

      const errorMessage =
        error instanceof Error
          ? error.name === 'AbortError'
            ? 'Service config timed out - using default mode'
            : error.message
          : 'Unknown error'

      setConfig((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
        // Set default mode if API fails
        serviceMode: 'full_llm_bot',
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
        // Clear cache before setting new data to force refresh across all hooks
        serviceConfigCache.clear()

        // Update cache with new data
        serviceConfigCache.set('service-config', {
          serviceMode: data.serviceMode,
          description: data.description,
        })

        setConfig((prev) => ({
          ...prev,
          serviceMode: data.serviceMode,
          description: data.description,
          loading: false,
        }))

        // Broadcast the change to other components using custom event
        window.dispatchEvent(
          new CustomEvent('service-config-updated', {
            detail: { serviceMode: data.serviceMode, description: data.description },
          }),
        )

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

    // Listen for service config updates from other components
    const handleConfigUpdate = (event: CustomEvent) => {
      console.log('useServiceConfig: Received service-config-updated event', event.detail)
      setConfig((prev) => ({
        ...prev,
        serviceMode: event.detail.serviceMode,
        description: event.detail.description,
        loading: false,
        error: null,
      }))
    }

    window.addEventListener('service-config-updated', handleConfigUpdate as EventListener)

    // Set up polling to sync config changes across browser tabs/sessions
    const pollInterval = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch('/api/service-config', {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' },
          })

          if (response.ok) {
            const data = await response.json()
            if (data.success && data.serviceMode !== config.serviceMode) {
              console.log('🔄 [useServiceConfig] Mode change detected via polling:', {
                from: config.serviceMode,
                to: data.serviceMode,
              })

              setConfig((prev) => ({
                ...prev,
                serviceMode: data.serviceMode,
                description: data.description,
                loading: false,
                error: null,
              }))

              // Update cache to ensure consistency
              serviceConfigCache.set('service-config', {
                serviceMode: data.serviceMode,
                description: data.description,
              })

              // Dispatch event for other components to update
              window.dispatchEvent(
                new CustomEvent('service-config-updated', {
                  detail: { serviceMode: data.serviceMode, description: data.description },
                }),
              )
            }
          }
        } catch (error) {
          // Silently fail polling - don't spam console
          console.debug('Service config polling failed:', error)
        }
      })()
    }, 8000) // Poll every 8 seconds

    console.log('🔄 [useServiceConfig] Polling started for cross-tab sync')

    return () => {
      window.removeEventListener('service-config-updated', handleConfigUpdate as EventListener)
      clearInterval(pollInterval)
      console.log('🔄 [useServiceConfig] Polling stopped')
    }
  }, [fetchConfig, config.serviceMode])

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

  const fetchMode = useCallback(async () => {
    try {
      // Check cache first
      const cached = serviceConfigCache.get('service-config') as ServiceConfig | null
      if (cached) {
        console.log('useServiceMode: Using cached service config')
        setServiceMode(cached.serviceMode)
        setLoading(false)
        return
      }

      setLoading(true)

      // Add timeout for lightweight hook
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn('Service mode request timed out after 5 seconds')
        controller.abort()
      }, 5000) // 5 second timeout

      const response = await fetch('/api/service-config', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Update cache
          serviceConfigCache.set('service-config', {
            serviceMode: data.serviceMode,
            description: data.description,
          })
          setServiceMode(data.serviceMode)
        }
      } else {
        console.warn('Service config API returned:', response.status, response.statusText)
      }
    } catch (error) {
      // Don't log AbortError as it's expected timeout behavior
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Service mode request timed out - using default mode')
      } else {
        console.error('Error fetching service mode:', error)
      }
      // Keep default mode on error
      setServiceMode('full_llm_bot')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMode()

    // Listen for service config updates from other components
    const handleConfigUpdate = (event: CustomEvent) => {
      console.log('useServiceMode: Received service-config-updated event', event.detail)
      setServiceMode(event.detail.serviceMode)
    }

    window.addEventListener('service-config-updated', handleConfigUpdate as EventListener)

    // Set up polling to sync mode changes across browser tabs/sessions
    const pollInterval = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch('/api/service-config', {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' },
          })

          if (response.ok) {
            const data = await response.json()
            if (data.success && data.serviceMode !== serviceMode) {
              console.log('🔄 [useServiceMode] Mode change detected via polling:', {
                from: serviceMode,
                to: data.serviceMode,
              })
              setServiceMode(data.serviceMode)

              // Clear cache to ensure consistency
              serviceConfigCache.clear()

              // Dispatch event for other components to update
              window.dispatchEvent(
                new CustomEvent('service-config-updated', {
                  detail: { serviceMode: data.serviceMode },
                }),
              )
            }
          }
        } catch (error) {
          // Silently fail polling - don't spam console
          console.debug('Service mode polling failed:', error)
        }
      })()
    }, 8000) // Poll every 8 seconds

    console.log('🔄 [useServiceMode] Polling started for cross-tab sync')

    return () => {
      window.removeEventListener('service-config-updated', handleConfigUpdate as EventListener)
      clearInterval(pollInterval)
      console.log('🔄 [useServiceMode] Polling stopped')
    }
  }, [fetchMode, serviceMode])

  return { serviceMode, loading }
}
