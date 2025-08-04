import { clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users, userSyncLog, adminInvitations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import type { User as ClerkUser } from '@clerk/nextjs/server'

/**
 * User Synchronization Service
 *
 * Provides functions for synchronizing user data between Clerk and Supabase.
 * Includes manual sync operations and data recovery functions.
 */

export interface SyncResult {
  success: boolean
  userId?: string
  error?: string
  action: 'created' | 'updated' | 'skipped' | 'error'
}

export interface SyncSummary {
  totalProcessed: number
  created: number
  updated: number
  skipped: number
  errors: number
  errorDetails: Array<{ userId: string; error: string }>
}

/**
 * Sync a single user from Clerk to Supabase
 */
export async function syncUserFromClerk(clerkUserId: string): Promise<SyncResult> {
  try {
    // Get user from Clerk
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(clerkUserId)

    if (!clerkUser) {
      return {
        success: false,
        error: 'User not found in Clerk',
        action: 'error',
      }
    }

    // Check if user exists in our database
    const existingUser = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1)

    const result =
      existingUser.length > 0 ? await updateExistingUser(clerkUser, existingUser[0]) : await createNewUser(clerkUser)

    // Log the sync operation
    await logSyncOperation(
      clerkUserId,
      'manual',
      clerkUser as unknown as Record<string, unknown>,
      result.success ? 'success' : 'failed',
      result.error,
    )

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await logSyncOperation(clerkUserId, 'manual', {}, 'failed', errorMessage)

    return {
      success: false,
      error: errorMessage,
      action: 'error',
    }
  }
}

/**
 * Sync all users from Clerk to Supabase
 */
export async function syncAllUsersFromClerk(): Promise<SyncSummary> {
  const summary: SyncSummary = {
    totalProcessed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  }

  try {
    // Get all users from Clerk (with pagination)
    let hasMore = true
    let offset = 0
    const limit = 100

    while (hasMore) {
      const client = await clerkClient()
      const response = await client.users.getUserList({
        offset,
        limit,
      })

      for (const clerkUser of response.data) {
        summary.totalProcessed++

        const result = await syncUserFromClerk(clerkUser.id)

        if (result.success) {
          switch (result.action) {
            case 'created':
              summary.created++
              break
            case 'updated':
              summary.updated++
              break
            case 'skipped':
              summary.skipped++
              break
          }
        } else {
          summary.errors++
          summary.errorDetails.push({
            userId: clerkUser.id,
            error: result.error ?? 'Unknown error',
          })
        }
      }

      hasMore = response.data.length === limit
      offset += limit
    }
  } catch (error) {
    console.error('Error syncing all users:', error)
  }

  return summary
}

/**
 * Get users that exist in Clerk but not in Supabase
 */
export async function getMissingUsers(): Promise<string[]> {
  try {
    // Get all Clerk user IDs
    const client = await clerkClient()
    const clerkUsers = await client.users.getUserList({ limit: 1000 })
    const clerkUserIds = clerkUsers.data.map((user) => user.id)

    // Get all Supabase user IDs
    const supabaseUsers = await db.select({ clerkUserId: users.clerkUserId }).from(users)

    const supabaseUserIds = new Set(supabaseUsers.map((user) => user.clerkUserId))

    // Find missing users
    return clerkUserIds.filter((id) => !supabaseUserIds.has(id))
  } catch (error) {
    console.error('Error finding missing users:', error)
    return []
  }
}

/**
 * Get users that exist in Supabase but not in Clerk (orphaned users)
 */
export async function getOrphanedUsers(): Promise<string[]> {
  try {
    // Get all Supabase user IDs
    const supabaseUsers = await db
      .select({ clerkUserId: users.clerkUserId })
      .from(users)
      .where(eq(users.isActive, true))

    // Check each user in Clerk
    const orphanedUsers: string[] = []

    const client = await clerkClient()
    for (const user of supabaseUsers) {
      try {
        await client.users.getUser(user.clerkUserId)
      } catch {
        // User doesn't exist in Clerk
        orphanedUsers.push(user.clerkUserId)
      }
    }

    return orphanedUsers
  } catch (error) {
    console.error('Error finding orphaned users:', error)
    return []
  }
}

/**
 * Clean up orphaned users by marking them as inactive
 */
export async function cleanupOrphanedUsers(): Promise<number> {
  try {
    const orphanedUserIds = await getOrphanedUsers()

    if (orphanedUserIds.length === 0) {
      return 0
    }

    // Mark orphaned users as inactive
    await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkUserId, orphanedUserIds[0])) // Update one by one for safety

    return orphanedUserIds.length
  } catch (error) {
    console.error('Error cleaning up orphaned users:', error)
    return 0
  }
}

/**
 * Create a new user in Supabase from Clerk data
 */
async function createNewUser(clerkUser: ClerkUser): Promise<SyncResult> {
  try {
    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress

    if (!primaryEmail) {
      return {
        success: false,
        error: 'No primary email found',
        action: 'error',
      }
    }

    // Check for admin invitation
    const invitation = await db
      .select()
      .from(adminInvitations)
      .where(and(eq(adminInvitations.email, primaryEmail), eq(adminInvitations.status, 'pending')))
      .limit(1)

    // Determine role
    let roleId = 3 // Default user role
    let invitedBy = null
    let invitedAt = null

    if (invitation.length > 0) {
      const inv = invitation[0]
      roleId = inv.role === 'superadmin' ? 1 : inv.role === 'admin' ? 2 : 3
      invitedBy = inv.invitedBy
      invitedAt = inv.createdAt

      // Mark invitation as accepted
      await db
        .update(adminInvitations)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(adminInvitations.invitationId, inv.invitationId))
    }

    // Check if this is the first user (should be superadmin)
    const existingUsers = await db.select().from(users).limit(1)
    if (existingUsers.length === 0) {
      roleId = 1 // Make first user superadmin
    }

    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ')

    await db.insert(users).values({
      clerkUserId: clerkUser.id,
      email: primaryEmail,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      fullName: fullName || null,
      imageUrl: clerkUser.imageUrl,
      roleId,
      lastSignInAt: clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt) : null,
      emailVerified: true,
      clerkMetadata: clerkUser.publicMetadata || {},
      invitedBy,
      invitedAt,
      invitationAcceptedAt: invitedBy ? new Date() : null,
      createdAt: new Date(clerkUser.createdAt),
      updatedAt: new Date(),
    })

    return {
      success: true,
      userId: clerkUser.id,
      action: 'created',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'error',
    }
  }
}

/**
 * Update existing user in Supabase with Clerk data
 */
interface ExistingUserRecord {
  email: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  imageUrl: string | null
  lastSignInAt: Date | null
}

async function updateExistingUser(clerkUser: ClerkUser, existingUser: ExistingUserRecord): Promise<SyncResult> {
  try {
    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress

    if (!primaryEmail) {
      return {
        success: false,
        error: 'No primary email found',
        action: 'error',
      }
    }

    // Check if update is needed
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ')
    const needsUpdate =
      existingUser.email !== primaryEmail ||
      existingUser.firstName !== clerkUser.firstName ||
      existingUser.lastName !== clerkUser.lastName ||
      existingUser.fullName !== fullName ||
      existingUser.imageUrl !== clerkUser.imageUrl ||
      (clerkUser.lastSignInAt &&
        (!existingUser.lastSignInAt ||
          new Date(clerkUser.lastSignInAt).getTime() !== existingUser.lastSignInAt?.getTime()))

    if (!needsUpdate) {
      return {
        success: true,
        userId: clerkUser.id,
        action: 'skipped',
      }
    }

    await db
      .update(users)
      .set({
        email: primaryEmail,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        fullName: fullName || null,
        imageUrl: clerkUser.imageUrl,
        lastSignInAt: clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt) : null,
        clerkMetadata: clerkUser.publicMetadata || {},
        updatedAt: new Date(),
      })
      .where(eq(users.clerkUserId, clerkUser.id))

    return {
      success: true,
      userId: clerkUser.id,
      action: 'updated',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'error',
    }
  }
}

/**
 * Log sync operation for monitoring
 */
async function logSyncOperation(
  clerkUserId: string,
  eventType: string,
  clerkPayload: Record<string, unknown> | null,
  syncStatus: 'success' | 'failed' | 'retry',
  errorMessage?: string,
) {
  try {
    await db.insert(userSyncLog).values({
      clerkUserId,
      eventType,
      syncStatus,
      errorMessage: errorMessage ?? null,
      clerkPayload: clerkPayload ?? {},
      createdAt: new Date(),
    })
  } catch (error) {
    console.error('Failed to log sync operation:', error)
  }
}

/**
 * Get sync statistics for monitoring dashboard
 */
export async function getSyncStatistics() {
  try {
    const [totalUsers, missingUsers, orphanedUsers, recentSyncLogs] = await Promise.all([
      db.select().from(users).where(eq(users.isActive, true)),
      getMissingUsers(),
      getOrphanedUsers(),
      db.select().from(userSyncLog).orderBy(userSyncLog.createdAt).limit(100),
    ])

    const syncStats = recentSyncLogs.reduce(
      (acc, log) => {
        acc[log.syncStatus] = (acc[log.syncStatus] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return {
      totalUsers: totalUsers.length,
      missingUsers: missingUsers.length,
      orphanedUsers: orphanedUsers.length,
      syncStats,
      lastSyncAt: recentSyncLogs[0]?.createdAt || null,
    }
  } catch (error) {
    console.error('Error getting sync statistics:', error)
    return null
  }
}
