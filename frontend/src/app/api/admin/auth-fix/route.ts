import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, roles, userSyncLog } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { seedDefaultRoles } from '@/lib/db/seed-roles'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function GET(_request: NextRequest) {
  try {
    console.log('🔍 [Auth Fix] Running system diagnostics...')

    // 1. Check if roles exist
    const existingRoles = await db.select().from(roles)

    // 2. Check recent user sync issues
    const recentSyncLogs = await db.select().from(userSyncLog).orderBy(desc(userSyncLog.createdAt)).limit(10)

    // 3. Check users with auth but no database record
    const authUsersResponse = await supabaseAdmin.auth.admin.listUsers()
    const authUsers = authUsersResponse.data.users

    const dbUsers = await db.select().from(users)
    const authUserIds = authUsers.map((u) => u.id)
    const dbUserIds = dbUsers.map((u) => u.supabaseUserId)

    const missingFromDb = authUserIds.filter((id) => !dbUserIds.includes(id))
    const orphanedInDb = dbUserIds.filter((id) => !authUserIds.includes(id))

    // 4. Check specific problematic user
    const problematicUserId = 'f662bcc5-77d3-4e05-84d0-096a31db5676'
    const problematicUser = authUsers.find((u) => u.id === problematicUserId)
    const problematicDbUser = dbUsers.find((u) => u.supabaseUserId === problematicUserId)

    const diagnostics = {
      timestamp: new Date().toISOString(),
      system_status: {
        roles_exist: existingRoles.length > 0,
        roles_count: existingRoles.length,
        auth_users_count: authUsers.length,
        db_users_count: dbUsers.length,
      },
      roles: existingRoles.map((r) => ({
        id: r.roleId,
        name: r.roleName,
        description: r.description,
      })),
      sync_issues: {
        missing_from_db: missingFromDb,
        orphaned_in_db: orphanedInDb,
        missing_count: missingFromDb.length,
        orphaned_count: orphanedInDb.length,
      },
      recent_sync_logs: recentSyncLogs.map((log) => ({
        sync_id: log.syncId,
        supabase_user_id: log.supabaseUserId,
        event_type: log.eventType,
        sync_status: log.syncStatus,
        error_message: log.errorMessage,
        created_at: log.createdAt.toISOString(),
      })),
      problematic_user_analysis: {
        user_id: problematicUserId,
        exists_in_auth: !!problematicUser,
        exists_in_db: !!problematicDbUser,
        auth_data: problematicUser
          ? {
              email: problematicUser.email,
              email_confirmed_at: problematicUser.email_confirmed_at,
              created_at: problematicUser.created_at,
              last_sign_in_at: problematicUser.last_sign_in_at,
            }
          : null,
        db_data: problematicDbUser
          ? {
              user_id: problematicDbUser.userId,
              email: problematicDbUser.email,
              role_id: problematicDbUser.roleId,
              is_active: problematicDbUser.isActive,
              email_verified: problematicDbUser.emailVerified,
            }
          : null,
      },
      recommendations: [] as string[],
    }

    // Generate recommendations
    const recommendations: string[] = []

    if (existingRoles.length === 0) {
      recommendations.push('SEED_ROLES: Run role seeding to create default roles')
    }

    if (missingFromDb.length > 0) {
      recommendations.push(`SYNC_USERS: ${missingFromDb.length} auth users missing from database`)
    }

    if (!problematicDbUser && problematicUser) {
      recommendations.push('SYNC_PROBLEMATIC_USER: Specific user f662bcc5... needs database sync')
    }

    if (recentSyncLogs.some((log) => log.syncStatus === 'failed')) {
      recommendations.push('FIX_SYNC_ERRORS: Recent sync failures detected')
    }

    diagnostics.recommendations = recommendations

    return NextResponse.json(diagnostics)
  } catch (error) {
    console.error('❌ [Auth Fix] Diagnostics error:', error)
    return NextResponse.json(
      {
        error: 'Diagnostics failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, user_id } = await request.json()

    console.log(`🔧 [Auth Fix] Running action: ${action}${user_id ? ` for user: ${user_id}` : ''}`)

    switch (action) {
      case 'seed_roles':
        await seedDefaultRoles()
        return NextResponse.json({
          success: true,
          message: 'Roles seeded successfully',
        })

      case 'sync_all_users':
        const authUsersResponse = await supabaseAdmin.auth.admin.listUsers()
        const authUsers = authUsersResponse.data.users

        let syncCount = 0
        const errors: string[] = []

        for (const authUser of authUsers) {
          try {
            await db
              .insert(users)
              .values({
                supabaseUserId: authUser.id,
                email: authUser.email ?? '',
                roleId: 3, // Default to user role
                isActive: true,
                emailVerified: !!authUser.email_confirmed_at,
                userMetadata: authUser.user_metadata || {},
                createdAt: new Date(authUser.created_at),
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: users.supabaseUserId,
                set: {
                  email: authUser.email ?? '',
                  emailVerified: !!authUser.email_confirmed_at,
                  userMetadata: authUser.user_metadata || {},
                  updatedAt: new Date(),
                },
              })

            syncCount++
          } catch (error) {
            errors.push(`${authUser.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }

        return NextResponse.json({
          success: true,
          message: `Synced ${syncCount} users`,
          errors,
        })

      case 'fix_problematic_user':
        if (!user_id) {
          return NextResponse.json(
            {
              error: 'user_id required for this action',
            },
            { status: 400 },
          )
        }

        // Get user from Supabase Auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(user_id)

        if (authError) {
          return NextResponse.json(
            {
              error: 'User not found in Supabase Auth',
              details: authError,
            },
            { status: 404 },
          )
        }

        // Force sync with superadmin role
        await db
          .insert(users)
          .values({
            supabaseUserId: user_id,
            email: authUser.user.email ?? '',
            roleId: 1, // Superadmin
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
              roleId: 1, // Superadmin
              isActive: true,
              emailVerified: !!authUser.user.email_confirmed_at,
              userMetadata: authUser.user.user_metadata || {},
              updatedAt: new Date(),
            },
          })

        // Log successful sync
        await db.insert(userSyncLog).values({
          supabaseUserId: user_id,
          eventType: 'auth.user.updated',
          syncStatus: 'success',
          supabasePayload: {
            user_id: authUser.user.id,
            email: authUser.user.email,
            email_confirmed_at: authUser.user.email_confirmed_at,
            action: 'manual_fix',
          },
        })

        return NextResponse.json({
          success: true,
          message: 'User fixed and promoted to superadmin',
        })

      default:
        return NextResponse.json(
          {
            error: 'Invalid action',
            available_actions: ['seed_roles', 'sync_all_users', 'fix_problematic_user'],
          },
          { status: 400 },
        )
    }
  } catch (error) {
    console.error('❌ [Auth Fix] Action error:', error)
    return NextResponse.json(
      {
        error: 'Action failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
