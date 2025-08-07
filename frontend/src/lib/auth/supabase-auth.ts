import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { users, roles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Get current authenticated user from Supabase
 */
export async function getCurrentUser() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    return user
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Get current user's database record with role information
 * Uses Drizzle ORM for database consistency with middleware
 */
export async function getCurrentUserWithRole() {
  try {
    const user = await getCurrentUser()
    if (!user) return null

    // Use Drizzle ORM for consistent database access (same as middleware)
    const userResults = await db
      .select({
        user_id: users.userId,
        supabase_user_id: users.supabaseUserId,
        email: users.email,
        first_name: users.firstName,
        last_name: users.lastName,
        full_name: users.fullName,
        image_url: users.imageUrl,
        role_id: users.roleId,
        is_active: users.isActive,
        created_at: users.createdAt,
        updated_at: users.updatedAt,
        // Join role information
        role_name: roles.roleName,
        permissions: roles.permissions,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.roleId))
      .where(eq(users.supabaseUserId, user.id))
      .limit(1)

    const userData = userResults[0]

    if (!userData) {
      console.log('🔍 [getCurrentUserWithRole] User not found in database:', user.email)
      return null
    }

    console.log('✅ [getCurrentUserWithRole] User data retrieved:', {
      email: userData.email,
      role_id: userData.role_id,
      is_active: userData.is_active,
    })

    return {
      user_id: userData.user_id,
      supabase_user_id: userData.supabase_user_id,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      full_name: userData.full_name,
      image_url: userData.image_url,
      role_id: userData.role_id,
      is_active: userData.is_active,
      created_at: userData.created_at,
      updated_at: userData.updated_at,
      role: userData.role_name
        ? {
            role_name: userData.role_name,
            permissions: userData.permissions ?? [],
          }
        : null,
      supabaseUser: user,
    }
  } catch (error) {
    console.error('❌ [getCurrentUserWithRole] Database error:', error)
    return null
  }
}

/**
 * Check if current user is admin (role 1 or 2)
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const userData = await getCurrentUserWithRole()
    return userData?.is_active && [1, 2].includes(userData.role_id)
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/**
 * Check if current user is super admin (role 1)
 */
export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  try {
    const userData = await getCurrentUserWithRole()
    return userData?.is_active && userData.role_id === 1
  } catch (error) {
    console.error('Error checking super admin status:', error)
    return false
  }
}

/**
 * Require authentication and return user, throw error if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}

/**
 * Require admin role and return user data, throw error if not admin
 */
export async function requireAdmin() {
  const userData = await getCurrentUserWithRole()

  console.log('🔍 [requireAdmin] Access check:', {
    userData: userData
      ? {
          email: userData.email,
          role_id: userData.role_id,
          is_active: userData.is_active,
        }
      : null,
    hasData: !!userData,
    isActive: userData?.is_active,
    hasValidRole: userData ? [1, 2].includes(userData.role_id) : false,
  })

  if (!userData?.is_active || ![1, 2].includes(userData.role_id)) {
    console.error('❌ [requireAdmin] Access denied:', {
      userData,
      reason: !userData
        ? 'No user data'
        : !userData.is_active
          ? 'User inactive'
          : ![1, 2].includes(userData.role_id)
            ? `Invalid role: ${userData.role_id}`
            : 'Unknown',
    })
    throw new Error('Admin access required')
  }

  console.log('✅ [requireAdmin] Access granted')
  return userData
}

/**
 * Require super admin role and return user data, throw error if not super admin
 */
export async function requireSuperAdmin() {
  const userData = await getCurrentUserWithRole()
  if (!userData?.is_active || userData.role_id !== 1) {
    throw new Error('Super admin access required')
  }
  return userData
}

/**
 * Middleware helper to validate API routes
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function validateApiAuth(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    return { user, isAuthenticated: !!user }
  } catch (error) {
    return { user: null, isAuthenticated: false, error }
  }
}

/**
 * Middleware helper to validate admin API routes
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function validateApiAdminAuth(request: NextRequest) {
  try {
    const userData = await getCurrentUserWithRole()
    const isAdmin = userData?.is_active && [1, 2].includes(userData.role_id)
    return {
      user: userData?.supabaseUser ?? null,
      userData,
      isAuthenticated: !!userData,
      isAdmin,
      error: null,
    }
  } catch (error) {
    return {
      user: null,
      userData: null,
      isAuthenticated: false,
      isAdmin: false,
      error,
    }
  }
}
