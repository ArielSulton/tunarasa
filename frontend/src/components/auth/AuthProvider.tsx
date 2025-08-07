'use client'

import { PropsWithChildren } from 'react'
import { supabaseAuthEnv, isSupabaseConfigured } from '@/config/supabase-auth'
import SupabaseAuthProvider from './SupabaseAuthProvider'
import NoAuthProvider from './NoAuthProvider'

/**
 * Conditional Auth Provider
 * Uses Supabase when configured, falls back to NoAuth for Docker builds
 */
const AuthProvider = ({ children }: PropsWithChildren) => {
  // Use Supabase only when it's enabled and properly configured
  if (supabaseAuthEnv.NEXT_PUBLIC_ENABLE_SUPABASE_AUTH && isSupabaseConfigured()) {
    return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  }

  // Fallback to NoAuth for Docker builds or when Supabase is not configured
  return <NoAuthProvider>{children}</NoAuthProvider>
}

export default AuthProvider
