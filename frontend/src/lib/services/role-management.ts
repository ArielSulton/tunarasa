import { clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users, roles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Role Management Service
 *
 * Handles user role management between Clerk and Supabase.
 * Synchronizes role information in both systems.
 */

export interface RoleUpdateResult {
  success: boolean
  error?: string
  oldRole?: string
  newRole?: string
}

/**
 * Get all available roles
 */
export async function getAllRoles() {
  try {
    return await db.select().from(roles).where(eq(roles.isActive, true)).orderBy(roles.roleId)
  } catch (error) {
    console.error('Error fetching roles:', error)
    return []
  }
}

/**
 * Get user role by Clerk user ID
 */
export async function getUserRole(clerkUserId: string) {
  try {
    const result = await db
      .select({
        roleId: users.roleId,
        roleName: roles.roleName,
        description: roles.description,
        permissions: roles.permissions,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.roleId))
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1)

    return result[0] || null
  } catch (error) {
    console.error('Error fetching user role:', error)
    return null
  }
}

/**
 * Update user role in both Clerk and Supabase
 */
export async function updateUserRole(
  clerkUserId: string,
  newRoleId: number,
  updatedBy: string,
): Promise<RoleUpdateResult> {
  try {
    // Get current user data
    const currentUser = await db
      .select({
        userId: users.userId,
        roleId: users.roleId,
        roleName: roles.roleName,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.roleId))
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1)

    if (currentUser.length === 0) {
      return {
        success: false,
        error: 'User not found in database',
      }
    }

    const oldRole = currentUser[0].roleName ?? 'unknown'

    // Get new role name
    const newRole = await db
      .select({ roleName: roles.roleName })
      .from(roles)
      .where(eq(roles.roleId, newRoleId))
      .limit(1)

    if (newRole.length === 0) {
      return {
        success: false,
        error: 'Invalid role ID',
      }
    }

    const newRoleName = newRole[0].roleName

    // Update role in Supabase
    await db
      .update(users)
      .set({
        roleId: newRoleId,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkUserId, clerkUserId))

    // Update role in Clerk public metadata
    const client = await clerkClient()
    await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        role: newRoleName,
        updatedBy,
        updatedAt: new Date().toISOString(),
      },
    })

    return {
      success: true,
      oldRole,
      newRole: newRoleName,
    }
  } catch (error) {
    console.error('Error updating user role:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Promote user to admin role
 */
export async function promoteToAdmin(clerkUserId: string, updatedBy: string): Promise<RoleUpdateResult> {
  return updateUserRole(clerkUserId, 2, updatedBy) // 2 = admin role
}

/**
 * Promote user to superadmin role
 */
export async function promoteToSuperAdmin(clerkUserId: string, updatedBy: string): Promise<RoleUpdateResult> {
  return updateUserRole(clerkUserId, 1, updatedBy) // 1 = superadmin role
}

/**
 * Demote user to regular user role
 */
export async function demoteToUser(clerkUserId: string, updatedBy: string): Promise<RoleUpdateResult> {
  return updateUserRole(clerkUserId, 3, updatedBy) // 3 = user role
}

/**
 * Check if user has permission for specific action
 */
export async function hasPermission(clerkUserId: string, permission: string): Promise<boolean> {
  try {
    const userRole = await getUserRole(clerkUserId)

    if (!userRole?.permissions) {
      return false
    }

    const permissions = userRole.permissions
    return permissions.includes(permission) || permissions.includes('*')
  } catch (error) {
    console.error('Error checking permission:', error)
    return false
  }
}

/**
 * Get all users with admin or superadmin roles
 */
export async function getAdminUsers() {
  try {
    return await db
      .select({
        userId: users.userId,
        clerkUserId: users.clerkUserId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        fullName: users.fullName,
        imageUrl: users.imageUrl,
        roleId: users.roleId,
        roleName: roles.roleName,
        isActive: users.isActive,
        lastSignInAt: users.lastSignInAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.roleId))
      .where(eq(users.isActive, true))
      .orderBy(users.roleId, users.createdAt)
  } catch (error) {
    console.error('Error fetching admin users:', error)
    return []
  }
}

/**
 * Initialize default roles if they don't exist
 */
export async function initializeDefaultRoles() {
  try {
    const existingRoles = await db.select().from(roles)

    if (existingRoles.length === 0) {
      await db.insert(roles).values([
        {
          roleId: 1,
          roleName: 'superadmin',
          description: 'Super Administrator with full system access',
          permissions: ['*'], // All permissions
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          roleId: 2,
          roleName: 'admin',
          description: 'Administrator with limited system access',
          permissions: ['dashboard.view', 'users.view', 'analytics.view', 'system.monitor'],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          roleId: 3,
          roleName: 'user',
          description: 'Regular user with basic access',
          permissions: ['profile.view', 'profile.edit'],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      console.log('Default roles initialized successfully')
      return true
    }

    return false
  } catch (error) {
    console.error('Error initializing default roles:', error)
    return false
  }
}

/**
 * Sync user role from Clerk to Supabase
 */
export async function syncUserRoleFromClerk(clerkUserId: string): Promise<boolean> {
  try {
    // Get user from Clerk
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(clerkUserId)
    const clerkRole = clerkUser.publicMetadata?.role as string

    if (!clerkRole) {
      return false
    }

    // Map role name to ID
    const roleMap: Record<string, number> = {
      superadmin: 1,
      admin: 2,
      user: 3,
    }

    const roleId = roleMap[clerkRole]
    if (!roleId) {
      return false
    }

    // Update role in Supabase
    await db
      .update(users)
      .set({
        roleId,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkUserId, clerkUserId))

    return true
  } catch (error) {
    console.error('Error syncing user role from Clerk:', error)
    return false
  }
}

/**
 * Get role statistics for dashboard
 */
export async function getRoleStatistics() {
  try {
    const stats = await db
      .select({
        roleName: roles.roleName,
        count: users.roleId,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.roleId))
      .where(eq(users.isActive, true))

    // Count users per role
    const roleStats = stats.reduce(
      (acc, user) => {
        const roleName = user.roleName ?? 'unknown'
        acc[roleName] = (acc[roleName] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return roleStats
  } catch (error) {
    console.error('Error getting role statistics:', error)
    return {}
  }
}
