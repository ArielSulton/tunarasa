/**
 * Sign Up Page
 * Clerk authentication page for user registration
 */

'use client'

import { AuthSignUp } from '@/components/auth/auth-components'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function SignUpPage() {
  return <AuthSignUp />
}
