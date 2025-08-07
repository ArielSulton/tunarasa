import { NextRequest, NextResponse } from 'next/server'
// import { createServerClient } from '@supabase/ssr'
import { db } from '@/lib/db'
import { users, userSyncLog } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { determineUserRole, ensureRolesExist } from '@/lib/services/role-management'

interface SyncUserRequest {
  userId: string
  email: string
  userData?: {
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
    image_url?: string | null
    user_metadata?: Record<string, unknown>
    email_confirmed_at?: string | null
  }
  isNewUser?: boolean
}

export async function POST(request: NextRequest) {
  let syncAttempt = 1
  let userId: string | undefined
  let email: string | undefined

  try {
    const body = (await request.json()) as SyncUserRequest
    userId = body.userId
    email = body.email
    const { userData, isNewUser = false } = body

    // Extract sync attempt from headers for monitoring
    syncAttempt = parseInt(request.headers.get('X-Sync-Attempt') ?? '1')

    // Enhanced validation with detailed logging
    if (!userId) {
      console.error('❌ [Sync API] Missing userId in request:', {
        body,
        headers: Object.fromEntries(request.headers.entries()),
      })
      return NextResponse.json({ success: false, error: 'User ID is required', field: 'userId' }, { status: 400 })
    }

    if (!email) {
      console.error('❌ [Sync API] Missing email in request:', {
        body,
        headers: Object.fromEntries(request.headers.entries()),
      })
      return NextResponse.json({ success: false, error: 'Email is required', field: 'email' }, { status: 400 })
    }

    // Additional validation for UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      console.error('❌ [Sync API] Invalid userId format:', { userId, email })
      return NextResponse.json({ success: false, error: 'Invalid user ID format', field: 'userId' }, { status: 400 })
    }

    // Streamlined logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 [Sync API] Processing sync (attempt ${syncAttempt}):`, email)
    }

    // Parallel execution of role determination and role existence check
    const [roleId] = await Promise.all([determineUserRole(email), ensureRolesExist()])

    if (process.env.NODE_ENV === 'development') {
      console.log('📋 [Sync API] Determined role:', roleId)
    }

    // Enhanced user data preparation with null checks and logging
    const now = new Date()

    // Double-check userId before database operation
    if (!userId || userId === 'null' || userId === 'undefined') {
      console.error('❌ [Sync API] userId is null/undefined before DB operation:', { userId, email, roleId })
      return NextResponse.json(
        { success: false, error: 'User ID is null or invalid before database operation' },
        { status: 400 },
      )
    }

    const userDataToUpsert = {
      supabaseUserId: userId,
      email,
      firstName: userData?.first_name ?? null,
      lastName: userData?.last_name ?? null,
      fullName: userData?.full_name ?? null,
      imageUrl: userData?.image_url ?? null,
      roleId,
      emailVerified: !!userData?.email_confirmed_at,
      userMetadata: userData?.user_metadata ?? {},
      lastSignInAt: now,
      updatedAt: now,
    }

    // Log the data we're about to insert for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 [Sync API] User data to upsert:', {
        supabaseUserId: userDataToUpsert.supabaseUserId,
        email: userDataToUpsert.email,
        roleId: userDataToUpsert.roleId,
        emailVerified: userDataToUpsert.emailVerified,
      })
    }

    // Check if user already exists to handle role assignment properly
    let existingUser = null
    try {
      const existingUsers = await db
        .select({
          userId: users.userId,
          email: users.email,
          roleId: users.roleId,
          supabaseUserId: users.supabaseUserId,
        })
        .from(users)
        .where(eq(users.supabaseUserId, userId))
        .limit(1)

      existingUser = existingUsers[0] || null

      if (process.env.NODE_ENV === 'development') {
        console.log('📋 [Sync API] Existing user check:', {
          found: !!existingUser,
          userId: existingUser?.userId,
          roleId: existingUser?.roleId,
        })
      }
    } catch (error) {
      console.error('❌ [Sync API] Error checking existing user:', error)
      // Still proceed but log the error for monitoring
      if (process.env.NODE_ENV === 'development') {
        console.log('📋 [Sync API] Proceeding despite error checking existing user')
      }
    }

    let result: Array<{ userId: number; email: string; roleId: number | null }>

    if (existingUser) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📋 [Sync API] Updating existing user:', {
          existingRoleId: existingUser.roleId,
          newRoleId: roleId,
          shouldUpdateRole: existingUser.roleId !== roleId && isNewUser,
        })
      }

      // Update existing user - only update role for new users or if explicitly promoting
      const updateData: Partial<typeof userDataToUpsert> = {
        email: userDataToUpsert.email,
        emailVerified: userDataToUpsert.emailVerified,
        lastSignInAt: userDataToUpsert.lastSignInAt,
        updatedAt: userDataToUpsert.updatedAt,
        // Only update profile data if provided
        ...(userData?.first_name && { firstName: userDataToUpsert.firstName }),
        ...(userData?.last_name && { lastName: userDataToUpsert.lastName }),
        ...(userData?.full_name && { fullName: userDataToUpsert.fullName }),
        ...(userData?.image_url && { imageUrl: userDataToUpsert.imageUrl }),
        ...(userData?.user_metadata && { userMetadata: userDataToUpsert.userMetadata }),
      }

      // Update role if this is a new user signup or if the determined role is superadmin
      if (isNewUser || roleId === 1) {
        updateData.roleId = roleId
      }

      result = await db.update(users).set(updateData).where(eq(users.supabaseUserId, userId)).returning({
        userId: users.userId,
        email: users.email,
        roleId: users.roleId,
      })
    } else {
      // Insert new user
      if (process.env.NODE_ENV === 'development') {
        console.log('📋 [Sync API] Inserting new user with roleId:', roleId)
      }

      try {
        result = await db.insert(users).values(userDataToUpsert).returning({
          userId: users.userId,
          email: users.email,
          roleId: users.roleId,
        })
      } catch (insertError: unknown) {
        // Handle duplicate key error - user was created by another process
        if (
          insertError &&
          typeof insertError === 'object' &&
          'code' in insertError &&
          'constraint_name' in insertError &&
          insertError.code === '23505' &&
          insertError.constraint_name === 'users_supabase_user_id_unique'
        ) {
          console.log('📋 [Sync API] User already exists, switching to update mode')

          // Retry with update
          const updateData = {
            email: userDataToUpsert.email,
            emailVerified: userDataToUpsert.emailVerified,
            lastSignInAt: userDataToUpsert.lastSignInAt,
            updatedAt: userDataToUpsert.updatedAt,
            roleId, // Apply new role
          }

          result = await db.update(users).set(updateData).where(eq(users.supabaseUserId, userId)).returning({
            userId: users.userId,
            email: users.email,
            roleId: users.roleId,
          })
        } else {
          // Re-throw other errors
          throw insertError
        }
      }
    }

    if (!result?.length) {
      throw new Error('Failed to create or update user record')
    }

    const syncedUser = result[0]

    // Async logging without blocking response
    if (process.env.NODE_ENV === 'development' || syncAttempt > 1) {
      void db
        .insert(userSyncLog)
        .values({
          supabaseUserId: userId,
          eventType: isNewUser ? 'auth.user.created' : 'auth.user.updated',
          syncStatus: 'success',
          supabasePayload: {
            user_id: userId,
            email,
            database_user_id: syncedUser.userId,
            role_id: syncedUser.roleId,
            sync_method: 'api_endpoint',
            sync_attempt: syncAttempt,
            timestamp: now.toISOString(),
          },
        })
        .catch(() => {}) // Silent error for logging failures
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          userId: syncedUser.userId,
          email: syncedUser.email,
          roleId: syncedUser.roleId,
        },
        message: 'User synced successfully',
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('❌ [Sync API] Error syncing user:', error)

    // Async error logging without blocking response
    if (userId) {
      void db
        .insert(userSyncLog)
        .values({
          supabaseUserId: userId,
          eventType: 'auth.user.created',
          syncStatus: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          supabasePayload: {
            user_id: userId,
            email,
            sync_method: 'api_endpoint',
            sync_attempt: syncAttempt,
            error_type: error instanceof Error ? error.constructor.name : 'unknown',
            timestamp: new Date().toISOString(),
          },
        })
        .catch(() => {}) // Silent error for logging failures
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to sync user to database',
      },
      { status: 500 },
    )
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Check if user exists in database
    const user = await db.select().from(users).where(eq(users.supabaseUserId, userId)).limit(1)

    const exists = user.length > 0
    const syncStatus = exists ? 'completed' : 'pending'

    console.log(`🔍 [Sync API] Sync status check for ${userId}:`, syncStatus)

    return NextResponse.json({
      userId,
      exists,
      syncStatus,
      userData: exists ? user[0] : null,
    })
  } catch (error) {
    console.error('❌ [Sync API] Error checking sync status:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to check sync status',
      },
      { status: 500 },
    )
  }
}
