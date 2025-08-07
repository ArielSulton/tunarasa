import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users, roles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export interface ServerUserData {
  userId: number
  supabaseUserId: string
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  imageUrl?: string
  roleId: number
  isActive: boolean
  role?: {
    roleName: string
    permissions: string[]
  }
}

/**
 * Server-side function to get authenticated user with role information
 * Use this in Server Components and API routes
 */
export async function getServerUser(): Promise<{
  user: ServerUserData | null
  supabaseUser: unknown
}> {
  const supabase = await createClient()

  try {
    // Get the authenticated user from Supabase
    const {
      data: { user: supabaseUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !supabaseUser) {
      return { user: null, supabaseUser: null }
    }

    // Get user data with role information using Drizzle ORM (consistent with middleware)
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
      .where(eq(users.supabaseUserId, supabaseUser.id))
      .limit(1)

    const userData = userResults[0]

    if (!userData) {
      console.error('❌ [getServerUser] User not found in database:', supabaseUser.email)
      return { user: null, supabaseUser }
    }

    console.log('✅ [getServerUser] User data retrieved:', {
      email: userData.email,
      role_id: userData.role_id,
      is_active: userData.is_active,
    })

    const user: ServerUserData = {
      userId: userData.user_id,
      supabaseUserId: userData.supabase_user_id,
      email: userData.email,
      firstName: userData.first_name,
      lastName: userData.last_name,
      fullName: userData.full_name,
      imageUrl: userData.image_url,
      roleId: userData.role_id,
      isActive: userData.is_active,
      role: userData.role_name
        ? {
            roleName: userData.role_name,
            permissions: userData.permissions ?? [],
          }
        : undefined,
    }

    return { user, supabaseUser }
  } catch (error) {
    console.error('Error in getServerUser:', error)
    return { user: null, supabaseUser: null }
  }
}

/**
 * Server-side function to check if user is admin (role_id 1 or 2)
 */
export async function checkAdminAccess(): Promise<{
  hasAccess: boolean
  user: ServerUserData | null
  roleId?: number
}> {
  const { user } = await getServerUser()

  if (!user?.isActive) {
    return { hasAccess: false, user: null }
  }

  const hasAccess = [1, 2].includes(user.roleId)
  return { hasAccess, user, roleId: user.roleId }
}

/**
 * Server-side function to check if user is super admin (role_id 1)
 */
export async function checkSuperAdminAccess(): Promise<{
  hasAccess: boolean
  user: ServerUserData | null
  roleId?: number
}> {
  const { user } = await getServerUser()

  if (!user?.isActive) {
    return { hasAccess: false, user: null }
  }

  const hasAccess = user.roleId === 1
  return { hasAccess, user, roleId: user.roleId }
}

/**
 * Server-side function to require admin access - redirects if unauthorized
 * Use this in Server Components that require admin access
 */
export async function requireAdminAccess(): Promise<ServerUserData> {
  const { hasAccess, user } = await checkAdminAccess()

  if (!hasAccess || !user) {
    console.log('🚫 [Server Auth] Admin access required, redirecting to unauthorized')
    redirect('/unauthorized')
  }

  return user
}

/**
 * Server-side function to require super admin access - redirects if unauthorized
 * Use this in Server Components that require super admin access
 */
export async function requireSuperAdminAccess(): Promise<ServerUserData> {
  const { hasAccess, user } = await checkSuperAdminAccess()

  if (!hasAccess || !user) {
    console.log('🚫 [Server Auth] Super admin access required, redirecting to unauthorized')
    redirect('/unauthorized')
  }

  return user
}

/**
 * Server-side function to require authentication - redirects if not signed in
 * Use this in Server Components that require any authenticated user
 */
export async function requireAuth(): Promise<{
  user: ServerUserData | null
  supabaseUser: unknown
}> {
  const { user, supabaseUser } = await getServerUser()

  if (!supabaseUser) {
    console.log('🚫 [Server Auth] Authentication required, redirecting to sign-in')
    redirect('/sign-in')
  }

  return { user, supabaseUser }
}

/**
 * Utility type guards for role checking
 */
export function isAdmin(user: ServerUserData | null): boolean {
  return (user?.isActive && [1, 2].includes(user.roleId)) ?? false
}

export function isSuperAdmin(user: ServerUserData | null): boolean {
  return (user?.isActive && user.roleId === 1) ?? false
}

export function isUser(user: ServerUserData | null): boolean {
  return (user?.isActive && user.roleId === 3) ?? false
}

/**
 * Role hierarchy checker
 */
export function hasRoleAccess(user: ServerUserData | null, requiredRole: 'superadmin' | 'admin' | 'user'): boolean {
  if (!user?.isActive) return false

  switch (requiredRole) {
    case 'superadmin':
      return user.roleId === 1
    case 'admin':
      return [1, 2].includes(user.roleId)
    case 'user':
      return [1, 2, 3].includes(user.roleId)
    default:
      return false
  }
}
