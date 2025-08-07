import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Define protected routes that require authentication
const protectedRoutes = ['/dashboard', '/admin']
const adminRoutes = ['/admin']
const dashboardRoutes = ['/dashboard']
const authRoutes = ['/sign-in', '/sign-up', '/email-verify']

export async function middleware(request: NextRequest) {
  // Skip middleware during build time
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 [Middleware] Auth check for:', url.pathname)
    console.log('- User exists:', !!user)
    if (user) {
      console.log('- User ID:', user.id)
      console.log('- User email:', user.email)
      console.log('- Email confirmed:', !!user.email_confirmed_at)
    }
  }
  const isProtectedRoute = protectedRoutes.some((route) => url.pathname.startsWith(route))
  const isAdminRoute = adminRoutes.some((route) => url.pathname.startsWith(route))
  const isDashboardRoute = dashboardRoutes.some((route) => url.pathname.startsWith(route))
  const isAuthRoute = authRoutes.some((route) => url.pathname.startsWith(route))

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && user) {
    console.log('🚪 [Middleware] Found authenticated user on auth page')
    console.log('- Current path:', url.pathname)
    console.log('- User ID:', user.id)
    console.log('- User email:', user.email)
    console.log('- Email confirmed:', !!user.email_confirmed_at)

    // Special handling for sign-up and email-verify pages
    if (url.pathname === '/sign-up' || url.pathname === '/email-verify') {
      // If user just signed up and email is not confirmed, allow access to both pages
      if (!user.email_confirmed_at) {
        console.log('- User just signed up, email not confirmed - allowing access to see email verification flow')
        return supabaseResponse
      } else {
        console.log('- User email confirmed, redirecting to dashboard')
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // For sign-in page, always redirect confirmed users
    if (url.pathname === '/sign-in' && user.email_confirmed_at) {
      console.log('- Confirmed user on sign-in page, redirecting to dashboard')
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Allow unconfirmed users to access sign-in page to check their email
    if (url.pathname === '/sign-in' && !user.email_confirmed_at) {
      console.log('- Unconfirmed user on sign-in page, allowing access')
      return supabaseResponse
    }
  }

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !user) {
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  // Check admin permissions for admin routes with caching
  if (isAdminRoute && user) {
    let userData = null

    // Try to get cached role data first for better performance
    const cachedRoleData = request.cookies.get(`user_role_cache_${user.id}`)?.value
    if (cachedRoleData) {
      try {
        const cached = JSON.parse(cachedRoleData)
        // Use cached data if less than 5 minutes old
        if (Date.now() - cached.timestamp < 300000) {
          userData = { role_id: cached.roleId, is_active: cached.isActive }
        }
      } catch {
        // Invalid cache data, will fetch fresh
      }
    }

    // Fetch from database if no valid cache
    if (!userData) {
      try {
        const dbResults = await db
          .select({
            role_id: users.roleId,
            is_active: users.isActive,
          })
          .from(users)
          .where(eq(users.supabaseUserId, user.id))
          .limit(1)

        const data = dbResults[0] || null

        if (!data) {
          // Check if user is recent (within 5 minutes) for grace period
          const userCreatedAt = new Date(user.created_at).getTime()
          const isRecentUser = Date.now() - userCreatedAt < 300000

          if (!isRecentUser) {
            url.pathname = '/unauthorized'
            return NextResponse.redirect(url)
          }
          // Allow recent users to pass through
        } else {
          userData = data

          // Cache the role data for future requests
          const cacheData = {
            userId: user.id,
            roleId: data?.role_id,
            isActive: data?.is_active,
            timestamp: Date.now(),
          }

          // Set cache cookie (non-blocking)
          supabaseResponse.cookies.set(`user_role_cache_${user.id}`, JSON.stringify(cacheData), {
            maxAge: 300, // 5 minutes
            httpOnly: true,
            sameSite: 'lax',
          })
        }
      } catch (error) {
        console.error('🔍 [Middleware] Database query error:', error)

        // For admin routes, trigger sync and allow access
        const syncUserData = {
          userId: user.id,
          email: user.email!,
          userData: {
            email_confirmed_at: user.email_confirmed_at,
            user_metadata: user.user_metadata,
          },
          isNewUser: false,
        }

        // Non-blocking sync attempt
        fetch(`${request.nextUrl.origin}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(syncUserData),
        }).catch(() => {})

        // Allow admin route access, user will be synced
      }
    }

    // Check permissions
    if (userData && (!userData.is_active || ![1, 2].includes(userData.role_id))) {
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }
  }

  // Check dashboard permissions with optimized caching and better error handling
  if (isDashboardRoute && user) {
    let userData = null
    let fromCache = false

    console.log('🔍 [Middleware] Dashboard route check for user:', user.id)
    console.log('- Email confirmed:', !!user.email_confirmed_at)
    console.log('- User created:', user.created_at)
    console.log('- Database connection:', {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    })

    // Try cached role data first
    const cachedRoleData = request.cookies.get(`user_role_cache_${user.id}`)?.value
    if (cachedRoleData) {
      try {
        const cached = JSON.parse(cachedRoleData)
        // Use cached data if less than 2 minutes old (reduced from 5)
        if (Date.now() - cached.timestamp < 120000) {
          userData = { role_id: cached.roleId, is_active: cached.isActive }
          fromCache = true
          console.log('- Using cached role data:', userData)
        }
      } catch {
        console.log('- Cache data invalid, fetching fresh')
      }
    }

    // Fetch from database if no valid cache
    if (!userData) {
      console.log('- Fetching role data from database')
      const startTime = Date.now()

      try {
        // Add timeout for database query (3 seconds)
        const queryPromise = db
          .select({
            role_id: users.roleId,
            is_active: users.isActive,
            created_at: users.createdAt,
          })
          .from(users)
          .where(eq(users.supabaseUserId, user.id))
          .limit(1)

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database query timeout')), 3000)
        })

        const dbResults = (await Promise.race([queryPromise, timeoutPromise])) as Array<{
          role_id: number
          is_active: boolean
          created_at: Date
        }>
        const queryTime = Date.now() - startTime

        const data = dbResults[0] ?? null
        console.log(`- Database query completed in ${queryTime}ms:`, { data, error: null })

        if (!data) {
          console.log('- No user found in database - triggering auto-sync')

          // Trigger user sync in background (non-blocking)
          const syncUserData = {
            userId: user.id,
            email: user.email!,
            userData: {
              email_confirmed_at: user.email_confirmed_at,
              first_name: user.user_metadata?.first_name,
              last_name: user.user_metadata?.last_name,
              full_name: user.user_metadata?.full_name,
              image_url: user.user_metadata?.avatar_url,
              user_metadata: user.user_metadata,
            },
            isNewUser: false,
          }

          // Non-blocking sync attempt
          fetch(`${request.nextUrl.origin}/api/auth/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncUserData),
          }).catch(() => {
            console.log('- Background sync failed, will retry later')
          })

          // Always allow access with extended grace period for database reset scenarios
          console.log('- Allowing access - user will be synced in background')
          const response = NextResponse.next()
          response.headers.set('X-User-Sync-Status', 'syncing')
          response.headers.set('X-Sync-Trigger', 'database-reset')
          return response
        } else {
          userData = data
          console.log('- Fresh database data:', userData)

          // Cache the result with shorter TTL for faster updates
          const cacheData = {
            userId: user.id,
            roleId: data?.role_id,
            isActive: data?.is_active,
            timestamp: Date.now(),
          }

          supabaseResponse.cookies.set(`user_role_cache_${user.id}`, JSON.stringify(cacheData), {
            maxAge: 120, // Reduced to 2 minutes
            httpOnly: true,
            sameSite: 'lax',
          })
        }
      } catch (error) {
        const queryTime = Date.now() - startTime
        console.error(`🔍 [Middleware] Database query failed after ${queryTime}ms:`, error)

        if (error instanceof Error && error.message === 'Database query timeout') {
          console.log('- Database query timed out after 3s - this may indicate network issues')
        } else {
          console.log('- Database connection failed - triggering auto-sync')
        }

        // Trigger user sync in background (non-blocking)
        const syncUserData = {
          userId: user.id,
          email: user.email!,
          userData: {
            email_confirmed_at: user.email_confirmed_at,
            first_name: user.user_metadata?.first_name,
            last_name: user.user_metadata?.last_name,
            full_name: user.user_metadata?.full_name,
            image_url: user.user_metadata?.avatar_url,
            user_metadata: user.user_metadata,
          },
          isNewUser: false,
        }

        // Non-blocking sync attempt
        fetch(`${request.nextUrl.origin}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(syncUserData),
        }).catch(() => {
          console.log('- Background sync failed, will retry later')
        })

        // Always allow access - database may be initializing
        console.log('- Allowing access despite database error - user will be synced in background')
        const response = NextResponse.next()
        response.headers.set('X-User-Sync-Status', 'syncing')
        response.headers.set('X-Sync-Trigger', 'database-error')
        return response
      }
    }

    // Check admin access permissions
    const hasValidRole = userData?.is_active && [1, 2].includes(userData.role_id ?? 0)
    console.log('- Role check result:', {
      role_id: userData?.role_id,
      is_active: userData?.is_active,
      has_valid_role: hasValidRole,
      from_cache: fromCache,
    })

    if (!hasValidRole) {
      console.log('- Redirecting to unauthorized - invalid role')
      // Clear invalid cache
      supabaseResponse.cookies.delete(`user_role_cache_${user.id}`)
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }

    console.log('- Dashboard access granted')
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
