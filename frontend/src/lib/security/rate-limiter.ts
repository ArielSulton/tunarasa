/**
 * Rate Limiter for Admin Invitation System
 * Prevents abuse of invitation endpoints
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

class RateLimiter {
  private store: RateLimitStore = {}
  private maxAttempts: number
  private windowMs: number

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    // 15 minutes
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
  }

  /**
   * Check if a key (IP address, user ID, etc.) is rate limited
   * @param key - The identifier to rate limit
   * @returns true if rate limited, false if allowed
   */
  isRateLimited(key: string): boolean {
    const now = Date.now()
    const record = this.store[key]

    if (!record) {
      // First request
      this.store[key] = {
        count: 1,
        resetTime: now + this.windowMs,
      }
      return false
    }

    if (now > record.resetTime) {
      // Window has expired, reset
      this.store[key] = {
        count: 1,
        resetTime: now + this.windowMs,
      }
      return false
    }

    if (record.count >= this.maxAttempts) {
      return true
    }

    // Increment count
    record.count++
    return false
  }

  /**
   * Get remaining attempts for a key
   */
  getRemainingAttempts(key: string): number {
    const record = this.store[key]
    if (!record || Date.now() > record.resetTime) {
      return this.maxAttempts
    }
    return Math.max(0, this.maxAttempts - record.count)
  }

  /**
   * Get reset time for a key
   */
  getResetTime(key: string): number | null {
    const record = this.store[key]
    if (!record || Date.now() > record.resetTime) {
      return null
    }
    return record.resetTime
  }

  /**
   * Clear rate limit for a key (useful after successful operations)
   */
  clearRateLimit(key: string): void {
    delete this.store[key]
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now()
    for (const key in this.store) {
      if (now > this.store[key].resetTime) {
        delete this.store[key]
      }
    }
  }
}

// Singleton instances for different operations
export const invitationRateLimiter = new RateLimiter(3, 60 * 60 * 1000) // 3 invitations per hour per user
export const acceptanceRateLimiter = new RateLimiter(5, 15 * 60 * 1000) // 5 attempts per 15 minutes per IP
export const validationRateLimiter = new RateLimiter(10, 5 * 60 * 1000) // 10 validations per 5 minutes per IP

/**
 * Get client IP address from request
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const xClientIp = request.headers.get('x-client-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIp) {
    return realIp.trim()
  }

  if (xClientIp) {
    return xClientIp.trim()
  }

  // Fallback for development
  return 'unknown'
}

/**
 * Helper to apply rate limiting to API routes
 */
export function applyRateLimit(
  rateLimiter: RateLimiter,
  key: string,
  errorMessage: string = 'Rate limit exceeded',
): { isLimited: boolean; response?: Response } {
  if (rateLimiter.isRateLimited(key)) {
    const remaining = rateLimiter.getRemainingAttempts(key)
    const resetTime = rateLimiter.getResetTime(key)

    return {
      isLimited: true,
      response: new Response(
        JSON.stringify({
          error: errorMessage,
          rateLimitExceeded: true,
          remaining,
          resetTime,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': resetTime ? Math.ceil((resetTime - Date.now()) / 1000).toString() : '900',
            'X-RateLimit-Limit': rateLimiter['maxAttempts'].toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': resetTime?.toString() ?? '',
          },
        },
      ),
    }
  }

  return { isLimited: false }
}

// Cleanup function to run periodically (e.g., via cron job or scheduled task)
export function cleanupRateLimiters(): void {
  invitationRateLimiter.cleanup()
  acceptanceRateLimiter.cleanup()
  validationRateLimiter.cleanup()
}

// Auto-cleanup every 30 minutes
if (typeof window === 'undefined') {
  // Server-side only
  setInterval(cleanupRateLimiters, 30 * 60 * 1000)
}
