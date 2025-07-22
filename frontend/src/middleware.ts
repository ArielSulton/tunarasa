import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Type for Clerk session claims with metadata
interface ClerkSessionClaims {
  metadata?: {
    role?: string
  }
}

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/admin(.*)', '/api/admin(.*)'])

// Define admin-only routes that require admin role
const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Skip middleware during build time to avoid Clerk evaluation
  // Only run middleware when Clerk is properly configured
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return
  }

  // Protect admin and dashboard routes
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  // Additional check for admin-only routes
  if (isAdminRoute(req)) {
    const { sessionClaims } = await auth()

    // Check if user has admin role in public metadata
    const userRole = (sessionClaims as ClerkSessionClaims)?.metadata?.role

    if (userRole !== 'admin') {
      // Redirect non-admin users to unauthorized page
      return new Response('Unauthorized - Admin access required', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    }
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
