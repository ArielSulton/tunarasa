/**
 * Auth configuration for conditional Clerk enablement
 * Allows disabling Clerk during Docker build or when credentials are not available
 */

export const authEnv = {
  // Enable Clerk auth conditionally - can be disabled for Docker builds
  NEXT_PUBLIC_ENABLE_CLERK_AUTH: process.env.NEXT_PUBLIC_ENABLE_CLERK_AUTH === 'true',

  // Clerk configuration
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,

  // Clerk URLs
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in',
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? '/sign-up',
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL ?? '/dashboard',
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL ?? '/dashboard',
}

/**
 * Check if Clerk is properly configured
 */
export const isClerkConfigured = () => {
  return (
    authEnv.NEXT_PUBLIC_ENABLE_CLERK_AUTH &&
    authEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    authEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.length > 0
  )
}
