/**
 * Sign In Page
 * Clerk authentication page for user sign-in
 */

'use client'

import { AuthSignIn } from '@/components/auth/auth-components'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function SignInPage() {
  return <AuthSignIn />
}
