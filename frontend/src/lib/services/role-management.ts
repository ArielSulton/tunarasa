import { db } from '@/lib/db'
import { roles, users } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'

export interface RoleDefinition {
  roleId: number
  roleName: string
  permissions: string[]
  description: string
}

export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    roleId: 1,
    roleName: 'superadmin',
    permissions: [
      'admin.full_access',
      'admin.user_management',
      'admin.role_management',
      'admin.system_config',
      'admin.analytics.view',
      'admin.conversations.manage',
      'admin.llm_evaluation.manage',
    ],
    description: 'Full system access with all administrative privileges',
  },
  {
    roleId: 2,
    roleName: 'admin',
    permissions: [
      'admin.analytics.view',
      'admin.conversations.view',
      'admin.conversations.validate',
      'admin.llm_evaluation.view',
    ],
    description: 'Administrative access for content validation and monitoring',
  },
  {
    roleId: 3,
    roleName: 'user',
    permissions: ['user.chat', 'user.gestures'],
    description: 'Basic user access for gesture recognition and chat',
  },
]

export async function initializeDefaultRoles(): Promise<void> {
  try {
    console.log('🔄 Initializing default roles...')

    // Delete existing roles first to avoid duplicates (only in development)
    // In production, you might want to handle this differently
    const existingRoles = await db.select().from(roles)
    if (existingRoles.length > 0) {
      console.log(`🗑️  Removing ${existingRoles.length} existing roles before re-creating...`)
      await db.delete(roles) // Clear existing roles
    }

    console.log('🚀 Creating default roles...')

    // Insert default roles with explicit role IDs
    await db.insert(roles).values([
      {
        roleId: 1,
        roleName: 'superadmin',
        description: 'Full system access with all administrative privileges',
        permissions: [
          'admin.full_access',
          'admin.user_management',
          'admin.role_management',
          'admin.system_config',
          'admin.analytics.view',
          'admin.conversations.manage',
          'admin.llm_evaluation.manage',
        ],
        isActive: true,
      },
      {
        roleId: 2,
        roleName: 'admin',
        description: 'Administrative access for content validation and monitoring',
        permissions: [
          'admin.analytics.view',
          'admin.conversations.view',
          'admin.conversations.validate',
          'admin.llm_evaluation.view',
        ],
        isActive: true,
      },
      {
        roleId: 3,
        roleName: 'user',
        description: 'Basic user access for gesture recognition and chat',
        permissions: ['user.chat', 'user.gestures'],
        isActive: true,
      },
    ])

    console.log('✅ Default roles created successfully:')
    console.log('  - Role 1: superadmin')
    console.log('  - Role 2: admin')
    console.log('  - Role 3: user (default)')
  } catch (error) {
    console.error('❌ Error initializing default roles:', error)
    throw error
  }
}

export async function assignUserRole(supabaseUserId: string, roleId: number): Promise<void> {
  try {
    console.log(`🔄 Assigning role ${roleId} to user ${supabaseUserId}`)

    // Validate role ID
    if (![1, 2, 3].includes(roleId)) {
      throw new Error(`Invalid role ID: ${roleId}. Must be 1 (superadmin), 2 (admin), or 3 (user)`)
    }

    // Update user's role
    const result = await db
      .update(users)
      .set({
        roleId,
        updatedAt: new Date(),
      })
      .where(eq(users.supabaseUserId, supabaseUserId))
      .returning({ userId: users.userId, email: users.email, roleId: users.roleId })

    if (result.length === 0) {
      throw new Error(`User with Supabase ID ${supabaseUserId} not found`)
    }

    console.log(`✅ Role ${roleId} assigned successfully to user:`, result[0])
  } catch (error) {
    console.error('❌ Error assigning role:', error)
    throw error
  }
}

/**
 * Manually promote the first user to superadmin if needed
 * This is a recovery function in case the automatic assignment failed
 */
export async function promoteFirstUserToSuperadmin(): Promise<{ success: boolean; user?: unknown; message: string }> {
  try {
    console.log('🔄 Attempting to promote first user to superadmin...')

    // Check if there's already a superadmin
    const hasSuperadminAlready = await hasSuperadmin()
    if (hasSuperadminAlready) {
      return {
        success: false,
        message: 'Superadmin already exists in the system',
      }
    }

    // Find the oldest user (first registered)
    const firstUser = await db
      .select({
        userId: users.userId,
        supabaseUserId: users.supabaseUserId,
        email: users.email,
        roleId: users.roleId,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt)
      .limit(1)

    if (firstUser.length === 0) {
      return {
        success: false,
        message: 'No users found in the system',
      }
    }

    const user = firstUser[0]

    // Promote to superadmin
    await assignUserRole(user.supabaseUserId, 1)

    console.log(`✅ Successfully promoted first user to superadmin:`, user.email)

    return {
      success: true,
      user: {
        email: user.email,
        userId: user.userId,
        oldRoleId: user.roleId,
        newRoleId: 1,
      },
      message: `Successfully promoted ${user.email} to superadmin`,
    }
  } catch (error) {
    console.error('❌ Error promoting first user to superadmin:', error)
    return {
      success: false,
      message: `Error promoting first user: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

export async function getUserRole(
  supabaseUserId: string,
): Promise<{ roleId: number | null; roleName: string | null } | null> {
  try {
    const result = await db
      .select({
        roleId: users.roleId,
        roleName: roles.roleName,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.roleId))
      .where(eq(users.supabaseUserId, supabaseUserId))
      .limit(1)

    return result[0] || null
  } catch (error) {
    console.error('Error fetching user role:', error)
    throw error
  }
}

export async function hasPermission(supabaseUserId: string, permission: string): Promise<boolean> {
  try {
    const userRole = await getUserRole(supabaseUserId)

    if (!userRole) {
      return false
    }

    const roleDefinition = DEFAULT_ROLES.find((r) => r.roleId === userRole.roleId)
    return roleDefinition?.permissions.includes(permission) ?? false
  } catch (error) {
    console.error('Error checking permission:', error)
    return false
  }
}

// Cache for admin/superadmin emails to avoid parsing env vars repeatedly
let cachedSuperadminEmails: string[] | null = null
let cachedAdminEmails: string[] | null = null

/**
 * Get cached superadmin emails or parse from environment
 */
function getSuperadminEmails(): string[] {
  if (!cachedSuperadminEmails) {
    try {
      const envEmails = process.env.SUPERADMIN_EMAILS
      cachedSuperadminEmails = envEmails
        ? envEmails
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean)
        : ['superadmin@tunarasa.my.id', 'arielsulton26@gmail.com']

      console.log('🔧 [Role Management] Superadmin emails loaded:', cachedSuperadminEmails)
    } catch (error) {
      console.error('❌ [Role Management] Error parsing superadmin emails:', error)
      cachedSuperadminEmails = ['superadmin@tunarasa.my.id', 'arielsulton26@gmail.com']
    }
  }
  return cachedSuperadminEmails || []
}

/**
 * Get cached admin emails or parse from environment
 */
function getAdminEmails(): string[] {
  if (!cachedAdminEmails) {
    try {
      const envEmails = process.env.ADMIN_EMAILS
      cachedAdminEmails = envEmails
        ? envEmails
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean)
        : ['admin@tunarasa.my.id', 'superadmin@tunarasa.my.id', 'arielsulton26@gmail.com']
      console.log('🔧 [Role Management] Admin emails loaded:', cachedAdminEmails)
    } catch (error) {
      console.error('❌ [Role Management] Error parsing admin emails:', error)
      cachedAdminEmails = ['admin@tunarasa.my.id', 'superadmin@tunarasa.my.id', 'arielsulton26@gmail.com']
    }
  }
  return cachedAdminEmails || []
}

/**
 * Determines the appropriate role for a new user based on business rules:
 *
 * 1. First user in the system automatically becomes superadmin (role_id: 1)
 * 2. Users matching predefined admin email patterns get admin role (role_id: 2)
 * 3. Users matching predefined superadmin email patterns get superadmin role (role_id: 1)
 * 4. All other users get regular user role (role_id: 3)
 *
 * This ensures the first user can always access the system and manage other users.
 *
 * @param email - The email address of the user signing up
 * @returns Promise<number> - The role_id to assign (1=superadmin, 2=admin, 3=user)
 */
export async function determineUserRole(email: string): Promise<number> {
  try {
    // Optimized logging for production
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Determining role for email: ${email}`)
    }

    // CRITICAL: Check if this is the very first user in the database
    // This is the primary mechanism to ensure there's always a superadmin
    const userCountResult = await db.select({ count: count() }).from(users)
    const totalUsers = userCountResult[0]?.count || 0

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Current user count in database: ${totalUsers}`)
    }

    // FIRST USER RULE: If this is the first user, make them superadmin
    // This guarantees system access even if no predefined admin emails exist
    if (totalUsers === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 First user detected - assigning superadmin role (role_id: 1)')
      }
      return 1 // superadmin
    }

    // Optimized email matching with cached values
    const emailLower = email.toLowerCase()
    const superadminEmails = getSuperadminEmails()
    const adminEmails = getAdminEmails()

    if (superadminEmails.includes(emailLower)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Email matches superadmin list - assigning superadmin role (role_id: 1)')
      }
      return 1 // superadmin
    }

    if (adminEmails.includes(emailLower)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Email matches admin list - assigning admin role (role_id: 2)')
      }
      return 2 // admin
    }

    // Default to regular user for all other cases
    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 Default assignment - assigning user role (role_id: 3)')
    }
    return 3 // user
  } catch (error) {
    console.error('❌ Error determining user role:', error)
    // In case of error, default to regular user for safety
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ Falling back to user role (role_id: 3) due to error')
    }
    return 3 // user
  }
}

/**
 * Check if there are any superadmins in the system
 * Useful for administrative operations and system health checks
 */
export async function hasSuperadmin(): Promise<boolean> {
  try {
    const superadminCount = await db.select({ count: count() }).from(users).where(eq(users.roleId, 1))

    return (superadminCount[0]?.count || 0) > 0
  } catch (error) {
    console.error('❌ Error checking for superadmin:', error)
    return false
  }
}

/**
 * Get total user count in the system
 */
export async function getTotalUserCount(): Promise<number> {
  try {
    const userCountResult = await db.select({ count: count() }).from(users)
    return userCountResult[0]?.count || 0
  } catch (error) {
    console.error('❌ Error getting user count:', error)
    return 0
  }
}

/**
 * Ensure roles exist before user operations
 * This is a safety function that auto-initializes roles if they don't exist
 */
export async function ensureRolesExist(): Promise<boolean> {
  try {
    console.log('🔍 Checking if roles exist...')

    // Use count query for better performance
    const roleCount = await db.select({ count: count() }).from(roles)
    const totalRoles = roleCount[0]?.count || 0

    console.log(`📊 Found ${totalRoles} roles in database`)

    if (totalRoles === 0) {
      console.log('⚠️  No roles found. Auto-initializing default roles...')
      await initializeDefaultRoles()
      return true
    }

    // Only check for specific roles if count is low (performance optimization)
    if (totalRoles < 3) {
      const existingRoles = await db.select({ roleId: roles.roleId }).from(roles)
      const requiredRoleIds = [1, 2, 3]
      const existingRoleIds = existingRoles.map((r) => r.roleId)
      const missingRoles = requiredRoleIds.filter((id) => !existingRoleIds.includes(id))

      if (missingRoles.length > 0) {
        console.log(`⚠️  Missing roles: ${missingRoles.join(', ')}. Re-initializing roles...`)
        await initializeDefaultRoles()
        return true
      }
    }

    console.log('✅ All required roles exist')
    return false // No initialization needed
  } catch (error) {
    console.error('❌ Error checking/ensuring roles:', error)
    throw error
  }
}
