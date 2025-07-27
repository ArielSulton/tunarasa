import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import {
  syncUserFromClerk,
  syncAllUsersFromClerk,
  getMissingUsers,
  getOrphanedUsers,
  cleanupOrphanedUsers,
  getSyncStatistics,
} from '@/lib/services/user-sync'

/**
 * User Synchronization API Endpoint
 *
 * Provides manual synchronization operations for admin users.
 * Only superadmin users can access these endpoints.
 */

export async function GET(request: NextRequest) {
  try {
    // Check authentication and authorization
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user has superadmin role
    const userRole = user.publicMetadata?.role as string
    if (userRole !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - Only superadmins can access sync operations' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'statistics':
        const stats = await getSyncStatistics()
        return NextResponse.json({
          success: true,
          data: stats,
        })

      case 'missing':
        const missingUsers = await getMissingUsers()
        return NextResponse.json({
          success: true,
          data: {
            count: missingUsers.length,
            userIds: missingUsers,
          },
        })

      case 'orphaned':
        const orphanedUsers = await getOrphanedUsers()
        return NextResponse.json({
          success: true,
          data: {
            count: orphanedUsers.length,
            userIds: orphanedUsers,
          },
        })

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Sync API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user has superadmin role
    const userRole = user.publicMetadata?.role as string
    if (userRole !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - Only superadmins can perform sync operations' }, { status: 403 })
    }

    const body = await request.json()
    const { action, userId } = body

    switch (action) {
      case 'sync-user':
        if (!userId) {
          return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
        }

        const userResult = await syncUserFromClerk(userId)
        return NextResponse.json({
          success: userResult.success,
          data: userResult,
          message: userResult.success
            ? `User ${userResult.action} successfully`
            : `Failed to sync user: ${userResult.error}`,
        })

      case 'sync-all':
        const allResult = await syncAllUsersFromClerk()
        return NextResponse.json({
          success: allResult.errors === 0,
          data: allResult,
          message: `Sync completed: ${allResult.created} created, ${allResult.updated} updated, ${allResult.skipped} skipped, ${allResult.errors} errors`,
        })

      case 'cleanup-orphaned':
        const cleanupCount = await cleanupOrphanedUsers()
        return NextResponse.json({
          success: true,
          data: { cleanedUp: cleanupCount },
          message: `Cleaned up ${cleanupCount} orphaned users`,
        })

      case 'sync-missing':
        const missingUsers = await getMissingUsers()
        const syncResults = {
          totalProcessed: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          errors: 0,
          errorDetails: [] as Array<{ userId: string; error: string }>,
        }

        for (const userId of missingUsers) {
          syncResults.totalProcessed++
          const result = await syncUserFromClerk(userId)

          if (result.success) {
            switch (result.action) {
              case 'created':
                syncResults.created++
                break
              case 'updated':
                syncResults.updated++
                break
              case 'skipped':
                syncResults.skipped++
                break
            }
          } else {
            syncResults.errors++
            syncResults.errorDetails.push({
              userId,
              error: result.error ?? 'Unknown error',
            })
          }
        }

        return NextResponse.json({
          success: syncResults.errors === 0,
          data: syncResults,
          message: `Missing users sync completed: ${syncResults.created} created, ${syncResults.errors} errors`,
        })

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Sync operation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication and authorization
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user has superadmin role
    const userRole = user.publicMetadata?.role as string
    if (userRole !== 'superadmin') {
      return NextResponse.json(
        { error: 'Forbidden - Only superadmins can perform cleanup operations' },
        { status: 403 },
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'cleanup-orphaned':
        const cleanupCount = await cleanupOrphanedUsers()
        return NextResponse.json({
          success: true,
          data: { cleanedUp: cleanupCount },
          message: `Cleaned up ${cleanupCount} orphaned users`,
        })

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Cleanup operation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
