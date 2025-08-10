import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

/**
 * POST /api/admin/cleanup-users
 * Clean up orphaned users and resolve sync conflicts
 */
export async function POST() {
  try {
    console.log('🧹 [Cleanup Users] Starting user cleanup process...')

    // Get all auth users
    const authUsersResponse = await supabaseAdmin.auth.admin.listUsers()
    const authUsers = authUsersResponse.data.users
    const authUserIds = authUsers.map((u) => u.id)

    console.log('📊 [Cleanup Users] Found', authUsers.length, 'users in Supabase Auth')

    // Get all database users
    const dbUsers = await db.select().from(users)
    console.log('📊 [Cleanup Users] Found', dbUsers.length, 'users in database')

    // Find orphaned users (in DB but not in Auth)
    const orphanedUsers = dbUsers.filter((dbUser) => !authUserIds.includes(dbUser.supabaseUserId))

    console.log('🗑️ [Cleanup Users] Found', orphanedUsers.length, 'orphaned users to remove')

    let removedCount = 0
    const removedUsers: Array<{ userId: number; email: string; supabaseUserId: string }> = []

    // Remove orphaned users
    for (const orphanedUser of orphanedUsers) {
      try {
        await db.delete(users).where(eq(users.userId, orphanedUser.userId))

        removedUsers.push({
          userId: orphanedUser.userId,
          email: orphanedUser.email,
          supabaseUserId: orphanedUser.supabaseUserId,
        })

        removedCount++
        console.log('🗑️ [Cleanup Users] Removed orphaned user:', {
          userId: orphanedUser.userId,
          email: orphanedUser.email,
          supabaseUserId: orphanedUser.supabaseUserId,
        })
      } catch (error) {
        console.error('❌ [Cleanup Users] Failed to remove orphaned user:', {
          userId: orphanedUser.userId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Find missing users (in Auth but not in DB)
    const missingUsers = authUsers.filter(
      (authUser) => !dbUsers.some((dbUser) => dbUser.supabaseUserId === authUser.id),
    )

    console.log('➕ [Cleanup Users] Found', missingUsers.length, 'missing users to sync')

    let syncedCount = 0
    const syncedUsers: Array<{ userId: number; email: string; supabaseUserId: string }> = []

    // Sync missing users
    for (const authUser of missingUsers) {
      try {
        // Determine role - superadmin for arielsulton26@gmail.com, regular user for others
        const roleId = authUser.email === 'arielsulton26@gmail.com' ? 1 : 3

        const result = await db
          .insert(users)
          .values({
            supabaseUserId: authUser.id,
            email: authUser.email ?? '',
            firstName: authUser.user_metadata?.first_name ?? null,
            lastName: authUser.user_metadata?.last_name ?? null,
            fullName: authUser.user_metadata?.full_name ?? null,
            imageUrl: authUser.user_metadata?.image_url ?? null,
            roleId,
            isActive: true,
            emailVerified: !!authUser.email_confirmed_at,
            userMetadata: authUser.user_metadata || {},
            lastSignInAt: authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at) : null,
            createdAt: new Date(authUser.created_at),
            updatedAt: new Date(),
          })
          .returning({
            userId: users.userId,
            email: users.email,
          })

        if (result?.[0]) {
          syncedUsers.push({
            userId: result[0].userId,
            email: result[0].email,
            supabaseUserId: authUser.id,
          })

          syncedCount++
          console.log('➕ [Cleanup Users] Synced missing user:', {
            userId: result[0].userId,
            email: result[0].email,
            supabaseUserId: authUser.id,
            roleId,
          })
        }
      } catch (error) {
        console.error('❌ [Cleanup Users] Failed to sync missing user:', {
          supabaseUserId: authUser.id,
          email: authUser.email,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    console.log('✅ [Cleanup Users] Cleanup completed:', {
      removedCount,
      syncedCount,
      totalProcessed: removedCount + syncedCount,
    })

    return NextResponse.json({
      success: true,
      message: 'User cleanup completed successfully',
      summary: {
        orphanedUsersRemoved: removedCount,
        missingUsersSynced: syncedCount,
        totalProcessed: removedCount + syncedCount,
      },
      details: {
        removedUsers,
        syncedUsers,
      },
    })
  } catch (error) {
    console.error('❌ [Cleanup Users] Cleanup failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'User cleanup failed',
      },
      { status: 500 },
    )
  }
}

/**
 * GET /api/admin/cleanup-users
 * Preview what cleanup would do without executing
 */
export async function GET() {
  try {
    console.log('🔍 [Cleanup Users] Analyzing users for cleanup preview...')

    // Get all auth users
    const authUsersResponse = await supabaseAdmin.auth.admin.listUsers()
    const authUsers = authUsersResponse.data.users
    const authUserIds = authUsers.map((u) => u.id)

    // Get all database users
    const dbUsers = await db.select().from(users)

    // Find orphaned users (in DB but not in Auth)
    const orphanedUsers = dbUsers.filter((dbUser) => !authUserIds.includes(dbUser.supabaseUserId))

    // Find missing users (in Auth but not in DB)
    const missingUsers = authUsers.filter(
      (authUser) => !dbUsers.some((dbUser) => dbUser.supabaseUserId === authUser.id),
    )

    // Find email conflicts
    const emailConflicts: Array<{
      email: string
      authUser: { id: string; created_at: string }
      dbUsers: Array<{ userId: number; supabaseUserId: string; createdAt: Date }>
    }> = []

    for (const authUser of authUsers) {
      if (!authUser.email) continue

      const conflictingDbUsers = dbUsers.filter(
        (dbUser) => dbUser.email === authUser.email && dbUser.supabaseUserId !== authUser.id,
      )

      if (conflictingDbUsers.length > 0) {
        emailConflicts.push({
          email: authUser.email,
          authUser: { id: authUser.id, created_at: authUser.created_at },
          dbUsers: conflictingDbUsers.map((dbUser) => ({
            userId: dbUser.userId,
            supabaseUserId: dbUser.supabaseUserId,
            createdAt: dbUser.createdAt,
          })),
        })
      }
    }

    return NextResponse.json({
      success: true,
      analysis: {
        authUsersCount: authUsers.length,
        dbUsersCount: dbUsers.length,
        orphanedUsersCount: orphanedUsers.length,
        missingUsersCount: missingUsers.length,
        emailConflictsCount: emailConflicts.length,
      },
      preview: {
        orphanedUsers: orphanedUsers.map((user) => ({
          userId: user.userId,
          email: user.email,
          supabaseUserId: user.supabaseUserId,
          createdAt: user.createdAt,
        })),
        missingUsers: missingUsers.map((user) => ({
          supabaseUserId: user.id,
          email: user.email,
          createdAt: user.created_at,
        })),
        emailConflicts,
      },
      recommendations: [
        orphanedUsers.length > 0 && `Remove ${orphanedUsers.length} orphaned users from database`,
        missingUsers.length > 0 && `Sync ${missingUsers.length} missing users to database`,
        emailConflicts.length > 0 && `Resolve ${emailConflicts.length} email conflicts`,
      ].filter(Boolean),
    })
  } catch (error) {
    console.error('❌ [Cleanup Users] Preview failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Cleanup preview failed',
      },
      { status: 500 },
    )
  }
}
