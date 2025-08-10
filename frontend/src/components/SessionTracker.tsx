/**
 * Session Tracker Component
 * Automatically tracks user sessions for Prometheus metrics
 * Can be integrated into the main layout or specific pages
 */

'use client'

import { useEffect } from 'react'
import { useSessionTracking } from '@/hooks/use-session-tracking'

interface SessionTrackerProps {
  /**
   * Type of user session to track
   */
  sessionType?: 'admin' | 'guest' | 'user'

  /**
   * Whether to show debug information in development
   */
  debug?: boolean

  /**
   * Custom session ID (optional)
   */
  sessionId?: string
}

/**
 * Component that automatically tracks user sessions for dashboard metrics
 * Add this to your layout or main pages to enable session tracking
 */
export function SessionTracker({
  sessionType = 'guest',
  debug = process.env.NODE_ENV === 'development',
  sessionId,
}: SessionTrackerProps) {
  const {
    sessionId: trackedSessionId,
    isTracking,
    enabled,
  } = useSessionTracking({
    sessionId: sessionId ?? `${sessionType}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    autoStart: true,
    autoEnd: true,
    enabled: true,
  })

  useEffect(() => {
    if (debug && enabled) {
      console.log('📊 Session Tracker initialized:', {
        sessionType,
        sessionId: trackedSessionId,
        isTracking,
        enabled,
      })
    }
  }, [debug, enabled, sessionType, trackedSessionId, isTracking])

  // This component doesn't render anything visible
  // It just handles session tracking in the background
  if (debug && enabled) {
    return (
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 rounded bg-gray-800 p-2 text-xs text-white opacity-75">
        📊 Session: {trackedSessionId?.substring(0, 12)}...
        <br />
        Status: {isTracking ? '✅ Tracking' : '⏸️ Not tracking'}
        <br />
        Type: {sessionType}
      </div>
    )
  }

  return null
}

/**
 * Admin Session Tracker
 * Use this for admin dashboard pages
 */
export function AdminSessionTracker(props: Omit<SessionTrackerProps, 'sessionType'>) {
  return <SessionTracker {...props} sessionType="admin" />
}

/**
 * Guest Session Tracker
 * Use this for public pages like gesture recognition
 */
export function GuestSessionTracker(props: Omit<SessionTrackerProps, 'sessionType'>) {
  return <SessionTracker {...props} sessionType="guest" />
}

/**
 * User Session Tracker
 * Use this for authenticated user pages
 */
export function UserSessionTracker(props: Omit<SessionTrackerProps, 'sessionType'>) {
  return <SessionTracker {...props} sessionType="user" />
}
