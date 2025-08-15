import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, roles, userSyncLog } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'

// Lazy initialize Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase environment variables are required')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = id

    console.log(`🔍 [Diagnostic] Checking user: ${userId}`)

    // 1. Check user in Supabase Auth
    const { data: authUser, error: authError } = await getSupabaseAdmin().auth.admin.getUserById(userId)

    if (authError) {
      console.error('❌ Supabase Auth error:', authError)
      return NextResponse.json(
        {
          error: 'User not found in Supabase Auth',
          details: authError,
        },
        { status: 404 },
      )
    }

    // 2. Check user in our database
    const [dbUser] = await db
      .select({
        userId: users.userId,
        supabaseUserId: users.supabaseUserId,
        email: users.email,
        roleId: users.roleId,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        roleName: roles.roleName,
        roleDescription: roles.description,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.roleId))
      .where(eq(users.supabaseUserId, userId))

    // 3. Get sync logs for this user
    const syncLogs = await db
      .select()
      .from(userSyncLog)
      .where(eq(userSyncLog.supabaseUserId, userId))
      .orderBy(desc(userSyncLog.createdAt))
      .limit(5)

    // 4. Calculate timing information
    const now = new Date()
    const authCreatedAt = new Date(authUser.user.created_at)
    const timeSinceCreation = now.getTime() - authCreatedAt.getTime()
    const isRecentUser = timeSinceCreation < 300000 // 5 minutes

    const diagnosticData = {
      timestamp: now.toISOString(),
      user_id: userId,

      // Supabase Auth data
      auth_data: {
        id: authUser.user.id,
        email: authUser.user.email,
        email_confirmed_at: authUser.user.email_confirmed_at,
        created_at: authUser.user.created_at,
        updated_at: authUser.user.updated_at,
        last_sign_in_at: authUser.user.last_sign_in_at,
        is_email_confirmed: !!authUser.user.email_confirmed_at,
      },

      // Database user data
      db_data: {
        exists: !!dbUser,
        user_id: dbUser?.userId,
        email: dbUser?.email,
        role_id: dbUser?.roleId,
        role_name: dbUser?.roleName,
        role_description: dbUser?.roleDescription,
        is_active: dbUser?.isActive,
        email_verified: dbUser?.emailVerified,
        created_at: dbUser?.createdAt?.toISOString(),
        updated_at: dbUser?.updatedAt?.toISOString(),
      },

      // Timing analysis
      timing: {
        auth_created_at: authCreatedAt.toISOString(),
        time_since_creation_ms: timeSinceCreation,
        time_since_creation_readable: `${Math.floor(timeSinceCreation / 1000)}s`,
        is_recent_user: isRecentUser,
        within_grace_period: isRecentUser,
      },

      // Access checks
      access_checks: {
        can_access_dashboard: dbUser?.isActive && [1, 2].includes(dbUser?.roleId ?? 0),
        can_access_admin: dbUser?.isActive && [1, 2].includes(dbUser?.roleId ?? 0),
        is_superadmin: dbUser?.roleId === 1,
        is_admin: dbUser?.roleId === 2,
        middleware_should_allow: isRecentUser || (dbUser?.isActive && [1, 2].includes(dbUser?.roleId ?? 0)),
      },

      // Sync logs
      sync_logs: syncLogs.map((log) => ({
        sync_id: log.syncId,
        event_type: log.eventType,
        sync_status: log.syncStatus,
        error_message: log.errorMessage,
        created_at: log.createdAt.toISOString(),
      })),

      // Issues detected
      issues_detected: [] as string[],
    }

    // Detect potential issues
    const issues: string[] = []

    if (!dbUser) {
      issues.push('USER_NOT_IN_DATABASE')
    }

    if (dbUser && !dbUser.isActive) {
      issues.push('USER_INACTIVE')
    }

    if (dbUser && ![1, 2].includes(dbUser.roleId ?? 0)) {
      issues.push('INSUFFICIENT_ROLE')
    }

    if (authUser.user.email_confirmed_at && !isRecentUser && !dbUser) {
      issues.push('AUTH_DB_SYNC_FAILED')
    }

    if (syncLogs.some((log) => log.syncStatus === 'failed')) {
      issues.push('SYNC_FAILURES_DETECTED')
    }

    if (!authUser.user.email_confirmed_at) {
      issues.push('EMAIL_NOT_CONFIRMED')
    }

    diagnosticData.issues_detected = issues

    return NextResponse.json(diagnosticData)
  } catch (error) {
    console.error('❌ [Diagnostic] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = id
    const { action } = await request.json()

    console.log(`🔧 [Diagnostic] Action: ${action} for user: ${userId}`)

    switch (action) {
      case 'promote_to_superadmin':
        // Upsert user with superadmin role
        await db
          .insert(users)
          .values({
            supabaseUserId: userId,
            email: '', // Will be updated by trigger
            roleId: 1, // Superadmin
            isActive: true,
            emailVerified: true,
          })
          .onConflictDoUpdate({
            target: users.supabaseUserId,
            set: {
              roleId: 1,
              isActive: true,
              emailVerified: true,
              updatedAt: new Date(),
            },
          })

        return NextResponse.json({
          success: true,
          message: 'User promoted to superadmin',
        })

      case 'force_sync':
        // Get user from Supabase Auth
        const { data: authUser, error: authError } = await getSupabaseAdmin().auth.admin.getUserById(userId)

        if (authError) {
          return NextResponse.json(
            {
              error: 'User not found in Supabase Auth',
              details: authError,
            },
            { status: 404 },
          )
        }

        // Force sync to database
        await db
          .insert(users)
          .values({
            supabaseUserId: userId,
            email: authUser.user.email ?? '',
            roleId: 1, // Default to superadmin for this user
            isActive: true,
            emailVerified: !!authUser.user.email_confirmed_at,
            userMetadata: authUser.user.user_metadata || {},
            createdAt: new Date(authUser.user.created_at),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: users.supabaseUserId,
            set: {
              email: authUser.user.email ?? '',
              roleId: 1,
              isActive: true,
              emailVerified: !!authUser.user.email_confirmed_at,
              userMetadata: authUser.user.user_metadata || {},
              updatedAt: new Date(),
            },
          })

        // Log successful sync
        await db.insert(userSyncLog).values({
          supabaseUserId: userId,
          eventType: 'auth.user.updated',
          syncStatus: 'success',
          supabasePayload: {
            user_id: authUser.user.id,
            email: authUser.user.email,
            email_confirmed_at: authUser.user.email_confirmed_at,
            action: 'force_sync',
          },
        })

        return NextResponse.json({
          success: true,
          message: 'User force synced to database',
        })

      case 'clear_cache':
        // This would clear middleware cache - for now just return success
        return NextResponse.json({
          success: true,
          message: 'Cache clear requested (implementation pending)',
        })

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            available_actions: ['promote_to_superadmin', 'force_sync', 'clear_cache'],
          },
          { status: 400 },
        )
    }
  } catch (error) {
    console.error('❌ [Diagnostic] PATCH Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
