/**
 * Session tracking hook for Prometheus metrics
 * Automatically tracks user sessions for dashboard analytics
 */

import { useEffect, useRef, useCallback } from 'react'
import { startSession, endSession, generateSessionId, isSessionTrackingEnabled } from '@/lib/api/session-client'

export interface UseSessionTrackingOptions {
  /**
   * Custom session ID (optional)
   * If not provided, a unique ID will be generated
   */
  sessionId?: string

  /**
   * Whether to automatically start tracking on mount
   * @default true
   */
  autoStart?: boolean

  /**
   * Whether to automatically end tracking on unmount
   * @default true
   */
  autoEnd?: boolean

  /**
   * Whether to enable session tracking
   * @default true
   */
  enabled?: boolean
}

/**
 * Hook for tracking user sessions in Prometheus metrics
 * Automatically starts/ends sessions and reports to backend
 */
export function useSessionTracking(options: UseSessionTrackingOptions = {}) {
  const { sessionId: providedSessionId, autoStart = true, autoEnd = true, enabled = true } = options

  const sessionIdRef = useRef<string | null>(null)
  const isTrackingRef = useRef(false)

  // Generate session ID if not provided
  if (!sessionIdRef.current && enabled) {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    sessionIdRef.current = providedSessionId || generateSessionId()
  }

  const startTracking = useCallback(async () => {
    if (!enabled || !isSessionTrackingEnabled() || isTrackingRef.current || !sessionIdRef.current) {
      return
    }

    try {
      const result = await startSession(sessionIdRef.current)
      if (result.success) {
        isTrackingRef.current = true
        console.log('📊 Session tracking started:', sessionIdRef.current)
      } else {
        console.warn('⚠️ Failed to start session tracking:', result.error)
      }
    } catch (error) {
      console.error('❌ Error starting session tracking:', error)
    }
  }, [enabled])

  const endTracking = useCallback(async () => {
    if (!enabled || !isSessionTrackingEnabled() || !isTrackingRef.current || !sessionIdRef.current) {
      return
    }

    try {
      const result = await endSession(sessionIdRef.current)
      if (result.success) {
        isTrackingRef.current = false
        console.log('📊 Session tracking ended:', sessionIdRef.current)
      } else {
        console.warn('⚠️ Failed to end session tracking:', result.error)
      }
    } catch (error) {
      console.error('❌ Error ending session tracking:', error)
    }
  }, [enabled])

  // Auto-start session on mount
  useEffect(() => {
    if (autoStart && enabled) {
      void startTracking()
    }

    // Auto-end session on unmount
    return () => {
      if (autoEnd && enabled && isTrackingRef.current) {
        void endTracking()
      }
    }
  }, [enabled, autoStart, autoEnd, startTracking, endTracking])

  // Handle page unload/refresh
  useEffect(() => {
    if (!enabled || !autoEnd) return

    const handleBeforeUnload = () => {
      if (isTrackingRef.current && sessionIdRef.current) {
        // Use synchronous approach for page unload
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'}/public-session/end-session/${sessionIdRef.current}`,
          JSON.stringify({}),
        )
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [enabled, autoEnd])

  return {
    sessionId: sessionIdRef.current,
    isTracking: isTrackingRef.current,
    startTracking,
    endTracking,
    enabled: enabled && isSessionTrackingEnabled(),
  }
}

/**
 * Hook for admin users to track their authenticated sessions
 * Includes additional context for admin dashboard analytics
 */
export function useAdminSessionTracking() {
  return useSessionTracking({
    sessionId: `admin_${generateSessionId()}`,
    autoStart: true,
    autoEnd: true,
    enabled: true,
  })
}

/**
 * Hook for guest users to track anonymous sessions
 * Used for public gesture recognition and Q&A features
 */
export function useGuestSessionTracking() {
  return useSessionTracking({
    sessionId: `guest_${generateSessionId()}`,
    autoStart: true,
    autoEnd: true,
    enabled: true,
  })
}
