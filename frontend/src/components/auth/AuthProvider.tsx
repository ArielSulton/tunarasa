'use client'

import { PropsWithChildren } from 'react'
import { authEnv, isClerkConfigured } from '@/config/auth'
import ClerkAuthProvider from './ClerkAuthProvider'
import NoAuthProvider from './NoAuthProvider'

/**
 * Conditional Auth Provider
 * Uses Clerk when configured, falls back to NoAuth for Docker builds
 */
const AuthProvider = ({ children }: PropsWithChildren) => {
  // Use Clerk only when it's enabled and properly configured
  if (authEnv.NEXT_PUBLIC_ENABLE_CLERK_AUTH && isClerkConfigured()) {
    return <ClerkAuthProvider>{children}</ClerkAuthProvider>
  }

  // Fallback to NoAuth for Docker builds or when Clerk is not configured
  return <NoAuthProvider>{children}</NoAuthProvider>
}

export default AuthProvider
