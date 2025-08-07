import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Initialize Supabase client for auth verification
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    })

    // Fast database check for user existence and role
    const userResult = await db
      .select({
        userId: users.userId,
        email: users.email,
        roleId: users.roleId,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
        lastSignInAt: users.lastSignInAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.supabaseUserId, userId))
      .limit(1)

    const userExists = userResult.length > 0
    const userData = userExists ? userResult[0] : null

    let syncStatus: 'completed' | 'pending' | 'failed' = 'pending'
    let authStatus: 'verified' | 'unverified' | 'error' = 'error'

    // Determine sync status
    if (userExists) {
      syncStatus = 'completed'

      // Check if user has been recently updated (sign of successful sync)
      if (userData?.lastSignInAt) {
        const lastUpdate = new Date(userData.updatedAt).getTime()
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

        if (lastUpdate > fiveMinutesAgo) {
          syncStatus = 'completed'
        }
      }
    }

    // Verify auth status with Supabase
    try {
      const { data: authUser, error } = await supabase.auth.admin.getUserById(userId)

      if (!error && authUser.user) {
        authStatus = authUser.user.email_confirmed_at ? 'verified' : 'unverified'
      }
    } catch {
      // Auth check failed, but we still have database info
      authStatus = 'error'
    }

    const response = {
      userId,
      exists: userExists,
      syncStatus,
      authStatus,
      userData: userExists
        ? {
            databaseUserId: userData?.userId,
            email: userData?.email,
            roleId: userData?.roleId,
            isActive: userData?.isActive,
            emailVerified: userData?.emailVerified,
            lastSignInAt: userData?.lastSignInAt,
            updatedAt: userData?.updatedAt,
          }
        : null,
      recommendations: [] as string[],
    }

    // Add recommendations based on status
    if (!userExists) {
      response.recommendations.push('User needs to be synced to database')
    }

    if (userExists && authStatus === 'unverified') {
      response.recommendations.push('User should verify their email address')
    }

    if (userExists && !userData?.isActive) {
      response.recommendations.push('User account is deactivated')
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=60', // Cache for 1 minute
      },
    })
  } catch (error) {
    console.error('❌ [Sync Status API] Error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to check sync status',
      },
      { status: 500 },
    )
  }
}

// POST endpoint for triggering urgent sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, _force = false } = body

    if (!userId || !email) {
      return NextResponse.json({ error: 'User ID and email are required' }, { status: 400 })
    }

    // Trigger sync via the main sync API
    const syncResponse = await fetch(`${request.nextUrl.origin}/api/auth/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Urgent-Sync': 'true',
      },
      body: JSON.stringify({
        userId,
        email,
        isNewUser: false,
        userData: {}, // Minimal data for urgent sync
      }),
    })

    const syncResult = await syncResponse.json()

    if (!syncResponse.ok || !syncResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: syncResult.error ?? 'Urgent sync failed',
          syncResponse: syncResult,
        },
        { status: syncResponse.status },
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Urgent sync completed successfully',
      data: syncResult.data,
    })
  } catch (error) {
    console.error('❌ [Urgent Sync API] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to trigger urgent sync',
      },
      { status: 500 },
    )
  }
}
