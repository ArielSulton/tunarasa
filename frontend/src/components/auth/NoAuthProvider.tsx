'use client'

import { PropsWithChildren } from 'react'

/**
 * No Auth Provider Component
 * Fallback provider when Clerk is not configured (e.g., during Docker builds)
 * Simply renders children without any authentication
 */
const NoAuthProvider = ({ children }: PropsWithChildren) => {
  return <>{children}</>
}

export default NoAuthProvider
