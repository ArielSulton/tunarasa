'use client'

import { useAuth } from '@clerk/nextjs'
import { createClient } from '@supabase/supabase-js'
import { useMemo } from 'react'

/**
 * Client-side Supabase Client with Clerk Authentication
 *
 * This client automatically includes the Clerk session token in all requests,
 * enabling Row Level Security (RLS) policies to access user context.
 */
export function createClientSupabaseClient(token?: string) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      // Supabase auth is disabled in favor of Clerk
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

/**
 * React hook to get Supabase client with current user's Clerk token
 *
 * Usage in components:
 * ```tsx
 * const supabase = useSupabaseClient()
 * ```
 */
export function useSupabaseClient() {
  const { getToken } = useAuth()

  return useMemo(() => {
    return {
      // Get client with current token
      async getClient() {
        const token = await getToken()
        return createClientSupabaseClient(token ?? undefined)
      },

      // Get client with specific token
      getClientWithToken(token: string) {
        return createClientSupabaseClient(token)
      },
    }
  }, [getToken])
}
