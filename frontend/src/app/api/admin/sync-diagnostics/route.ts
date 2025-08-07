import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { runSyncDiagnostics } from '@/lib/auth/sync-diagnostics'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(_cookiesToSet) {
          // No need to set cookies in API route
        },
      },
    })

    // Check if user is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify admin privileges using Drizzle ORM
    const userResults = await db
      .select({
        role_id: users.roleId,
        is_active: users.isActive,
      })
      .from(users)
      .where(eq(users.supabaseUserId, user.id))
      .limit(1)

    const userData = userResults[0]

    if (!userData?.is_active || ![1, 2].includes(userData.role_id)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get userId from query params if provided
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')

    console.log('🔍 [Admin] Running sync diagnostics...')

    // Run diagnostics
    const diagnostics = await runSyncDiagnostics(targetUserId ?? undefined)

    console.log(`✅ [Admin] Diagnostics completed: ${diagnostics.issues.length} issues found`)

    return NextResponse.json({
      success: true,
      diagnostics,
      executedBy: {
        userId: user.id,
        email: user.email,
        role: userData.role_id === 1 ? 'superadmin' : 'admin',
      },
    })
  } catch (error) {
    console.error('❌ [Admin] Sync diagnostics error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to run sync diagnostics',
      },
      { status: 500 },
    )
  }
}

// POST endpoint to trigger sync for a specific user (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email } = body

    if (!userId || !email) {
      return NextResponse.json({ error: 'User ID and email are required' }, { status: 400 })
    }

    // Initialize Supabase client
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(_cookiesToSet) {
          // No need to set cookies in API route
        },
      },
    })

    // Check if requester is admin
    const {
      data: { user: adminUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !adminUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify admin privileges using Drizzle ORM
    const adminResults = await db
      .select({
        role_id: users.roleId,
        is_active: users.isActive,
      })
      .from(users)
      .where(eq(users.supabaseUserId, adminUser.id))
      .limit(1)

    const adminData = adminResults[0]

    if (!adminData?.is_active || ![1, 2].includes(adminData.role_id)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    console.log(`🔄 [Admin] Triggering sync for user: ${email}`)

    // Trigger sync via internal API
    const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email,
        isNewUser: false, // Admin-triggered syncs are usually for existing users
      }),
    })

    const syncResult = await syncResponse.json()

    if (!syncResponse.ok || !syncResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: syncResult.error ?? 'Sync failed',
          syncResponse: syncResult,
        },
        { status: 400 },
      )
    }

    console.log(`✅ [Admin] Sync completed for user: ${email}`)

    return NextResponse.json({
      success: true,
      message: `User sync completed successfully for ${email}`,
      syncResult: syncResult.data,
      triggeredBy: {
        userId: adminUser.id,
        email: adminUser.email,
        role: adminData.role_id === 1 ? 'superadmin' : 'admin',
      },
    })
  } catch (error) {
    console.error('❌ [Admin] Manual sync error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to trigger manual sync',
      },
      { status: 500 },
    )
  }
}
