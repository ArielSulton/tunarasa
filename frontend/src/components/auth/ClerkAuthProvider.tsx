'use client'

import { PropsWithChildren } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import { authEnv } from '@/config/auth'

/**
 * Clerk Auth Provider Component
 * Wraps children with ClerkProvider when Clerk is enabled
 */
const ClerkAuthProvider = ({ children }: PropsWithChildren) => {
  return (
    <ClerkProvider
      publishableKey={authEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl={authEnv.NEXT_PUBLIC_CLERK_SIGN_IN_URL}
      signUpUrl={authEnv.NEXT_PUBLIC_CLERK_SIGN_UP_URL}
      signInFallbackRedirectUrl={authEnv.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL}
      signUpFallbackRedirectUrl={authEnv.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL}
    >
      {children}
    </ClerkProvider>
  )
}

export default ClerkAuthProvider
