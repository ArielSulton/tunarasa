/**
 * Authentication utilities for Clerk integration - Client-safe utilities only
 */

// Type for Clerk session claims with metadata
export interface ClerkSessionClaims {
  metadata?: {
    role?: string
  }
  email?: string
  name?: string
}

// Client-safe utilities only - server functions moved to separate server-only files
// For server-side auth operations, use @clerk/nextjs/server directly in server components

export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]
