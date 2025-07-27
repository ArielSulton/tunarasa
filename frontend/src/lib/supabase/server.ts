import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase Client with Clerk Authentication
 *
 * This client automatically includes the Clerk session token in all requests,
 * enabling Row Level Security (RLS) policies to access user context.
 */
export async function createServerSupabaseClient() {
  // Get Clerk token for authorization header
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      const token = await (await auth()).getToken()
      return token ? { Authorization: `Bearer ${token}` } : {}
    } catch (error) {
      console.error('Error getting Clerk token:', error)
      return {}
    }
  }

  const authHeaders = await getAuthHeaders()

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: {
      headers: authHeaders,
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
 * Get Supabase client for server-side operations with user context
 *
 * This ensures all database operations respect RLS policies
 * based on the current user's Clerk session.
 */
export async function getSupabaseServerClient() {
  return await createServerSupabaseClient()
}

/**
 * Helper to get current user's Clerk ID for RLS operations
 */
export async function getCurrentClerkUserId(): Promise<string | null> {
  try {
    const { userId } = await auth()
    return userId
  } catch (error) {
    console.error('Error getting current Clerk user ID:', error)
    return null
  }
}
