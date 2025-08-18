/**
 * Session tracking API client
 * Handles session management for Prometheus metrics
 */

const API_BASE_URL = '/api/backend/api/v1'

export interface SessionResponse {
  success: boolean
  session_id?: string
  active_sessions: number
  message?: string
  timestamp: string
  error?: string
}

export interface SessionTrackingRequest {
  session_ids: string[]
}

/**
 * Start a new session and notify metrics system
 */
export async function startSession(sessionId: string): Promise<SessionResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/public-session/start-session/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.warn('Failed to start session:', data)
      return {
        success: false,
        active_sessions: 0,
        timestamp: new Date().toISOString(),
        error: data.error ?? 'Failed to start session',
      }
    }

    console.log('✅ Session started:', sessionId, 'Total active:', data.active_sessions)
    return data
  } catch (error) {
    console.error('Error starting session:', error)
    return {
      success: false,
      active_sessions: 0,
      timestamp: new Date().toISOString(),
      error: String(error),
    }
  }
}

/**
 * End a session and notify metrics system
 */
export async function endSession(sessionId: string): Promise<SessionResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/public-session/end-session/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.warn('Failed to end session:', data)
      return {
        success: false,
        active_sessions: 0,
        timestamp: new Date().toISOString(),
        error: data.error ?? 'Failed to end session',
      }
    }

    console.log('✅ Session ended:', sessionId, 'Remaining active:', data.active_sessions)
    return data
  } catch (error) {
    console.error('Error ending session:', error)
    return {
      success: false,
      active_sessions: 0,
      timestamp: new Date().toISOString(),
      error: String(error),
    }
  }
}

/**
 * Track multiple active sessions at once
 */
export async function trackActiveSessions(sessionIds: string[]): Promise<SessionResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/public-session/track-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_ids: sessionIds }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.warn('Failed to track sessions:', data)
      return {
        success: false,
        active_sessions: 0,
        timestamp: new Date().toISOString(),
        error: data.error ?? 'Failed to track sessions',
      }
    }

    console.log('✅ Tracked sessions:', data.active_sessions, 'IDs:', sessionIds)
    return data
  } catch (error) {
    console.error('Error tracking sessions:', error)
    return {
      success: false,
      active_sessions: 0,
      timestamp: new Date().toISOString(),
      error: String(error),
    }
  }
}

/**
 * Get current session count
 */
export async function getSessionCount(): Promise<SessionResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/public-session/session-count`)
    const data = await response.json()

    if (!response.ok) {
      console.warn('Failed to get session count:', data)
      return {
        success: false,
        active_sessions: 0,
        timestamp: new Date().toISOString(),
        error: data.error ?? 'Failed to get session count',
      }
    }

    return data
  } catch (error) {
    console.error('Error getting session count:', error)
    return {
      success: false,
      active_sessions: 0,
      timestamp: new Date().toISOString(),
      error: String(error),
    }
  }
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `session_${timestamp}_${random}`
}

/**
 * Check if session tracking is enabled
 */
export function isSessionTrackingEnabled(): boolean {
  return typeof window !== 'undefined' && Boolean(API_BASE_URL)
}
