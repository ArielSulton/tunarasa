/**
 * Supabase Auth configuration
 * Replaces Clerk authentication with Supabase Auth
 */

export const supabaseAuthEnv = {
  // Enable Supabase auth conditionally - can be disabled for Docker builds
  NEXT_PUBLIC_ENABLE_SUPABASE_AUTH: process.env.NEXT_PUBLIC_ENABLE_SUPABASE_AUTH === 'true',

  // Supabase configuration
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Auth URLs
  NEXT_PUBLIC_SIGN_IN_URL: process.env.NEXT_PUBLIC_SIGN_IN_URL ?? '/sign-in',
  NEXT_PUBLIC_SIGN_UP_URL: process.env.NEXT_PUBLIC_SIGN_UP_URL ?? '/sign-up',
  NEXT_PUBLIC_SIGN_IN_FALLBACK_REDIRECT_URL: process.env.NEXT_PUBLIC_SIGN_IN_FALLBACK_REDIRECT_URL ?? '/dashboard',
  NEXT_PUBLIC_SIGN_UP_FALLBACK_REDIRECT_URL: process.env.NEXT_PUBLIC_SIGN_UP_FALLBACK_REDIRECT_URL ?? '/dashboard',
}

/**
 * Check if Supabase is properly configured
 */
export const isSupabaseConfigured = () => {
  return (
    supabaseAuthEnv.NEXT_PUBLIC_ENABLE_SUPABASE_AUTH &&
    supabaseAuthEnv.NEXT_PUBLIC_SUPABASE_URL &&
    supabaseAuthEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    supabaseAuthEnv.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    supabaseAuthEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0
  )
}
