/**
 * Utility functions for optimized auth sync operations
 */

export const SYNC_CONSTANTS = {
  ROLE_CACHE_PREFIX: 'user_role_cache_',
  SYNC_COOLDOWN_PREFIX: 'last_sync_',
  SYNC_COOLDOWN_MS: 300000, // 5 minutes
  CACHE_DURATION_MS: 300000, // 5 minutes
  SYNC_TIMEOUT_MS: 5000, // 5 seconds
  MAX_RETRIES: 2,
} as const

/**
 * Get cached user role data from sessionStorage
 */
export function getCachedUserRole(userId: string): {
  roleId: number
  isActive: boolean
  timestamp: number
} | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = sessionStorage.getItem(`${SYNC_CONSTANTS.ROLE_CACHE_PREFIX}${userId}`)
    if (!cached) return null

    const data = JSON.parse(cached)

    // Check if cache is still valid
    if (Date.now() - data.timestamp > SYNC_CONSTANTS.CACHE_DURATION_MS) {
      sessionStorage.removeItem(`${SYNC_CONSTANTS.ROLE_CACHE_PREFIX}${userId}`)
      return null
    }

    return data
  } catch {
    return null
  }
}

/**
 * Cache user role data in sessionStorage
 */
export function cacheUserRole(userId: string, roleId: number, isActive: boolean = true): void {
  if (typeof window === 'undefined') return

  const cacheData = {
    userId,
    roleId,
    isActive,
    timestamp: Date.now(),
  }

  sessionStorage.setItem(`${SYNC_CONSTANTS.ROLE_CACHE_PREFIX}${userId}`, JSON.stringify(cacheData))
}

/**
 * Clear cached user role data
 */
export function clearUserRoleCache(userId: string): void {
  if (typeof window === 'undefined') return

  sessionStorage.removeItem(`${SYNC_CONSTANTS.ROLE_CACHE_PREFIX}${userId}`)
  sessionStorage.removeItem(`${SYNC_CONSTANTS.SYNC_COOLDOWN_PREFIX}${userId}`)
}

/**
 * Check if user sync is in cooldown period
 */
export function isSyncInCooldown(userId: string): boolean {
  if (typeof window === 'undefined') return false

  const lastSyncKey = `${SYNC_CONSTANTS.SYNC_COOLDOWN_PREFIX}${userId}`
  const lastSync = sessionStorage.getItem(lastSyncKey)

  if (!lastSync) return false

  return Date.now() - parseInt(lastSync) < SYNC_CONSTANTS.SYNC_COOLDOWN_MS
}

/**
 * Set sync cooldown timestamp
 */
export function setSyncCooldown(userId: string): void {
  if (typeof window === 'undefined') return

  sessionStorage.setItem(`${SYNC_CONSTANTS.SYNC_COOLDOWN_PREFIX}${userId}`, String(Date.now()))
}

/**
 * Check if a user is recently created (within 5 minutes)
 */
export function isRecentUser(userCreatedAt: string): boolean {
  const createdTime = new Date(userCreatedAt).getTime()
  const now = Date.now()
  return now - createdTime < 300000 // 5 minutes
}

/**
 * Clean up all sync-related data for a user
 */
export function cleanupSyncData(userId: string): void {
  if (typeof window === 'undefined') return

  clearUserRoleCache(userId)
  localStorage.removeItem('pending_user_sync')
}

/**
 * Get or create a pending sync record
 */
export function getPendingSync(): {
  userId: string
  email: string
  timestamp: number
  isNewUser: boolean
} | null {
  if (typeof window === 'undefined') return null

  try {
    const pending = localStorage.getItem('pending_user_sync')
    if (!pending) return null

    const data = JSON.parse(pending)

    // Remove if older than 1 hour
    if (Date.now() - data.timestamp > 3600000) {
      localStorage.removeItem('pending_user_sync')
      return null
    }

    return data
  } catch {
    localStorage.removeItem('pending_user_sync')
    return null
  }
}

/**
 * Set pending sync record
 */
export function setPendingSync(userId: string, email: string, isNewUser: boolean): void {
  if (typeof window === 'undefined') return

  const pendingSync = {
    userId,
    email,
    timestamp: Date.now(),
    isNewUser,
  }

  localStorage.setItem('pending_user_sync', JSON.stringify(pendingSync))
}

/**
 * Clear pending sync record
 */
export function clearPendingSync(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem('pending_user_sync')
}
