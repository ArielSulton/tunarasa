/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
'use client'

import { Shield, Crown, AlertTriangle } from 'lucide-react'
import { useSupabaseUser, useIsAdmin, useIsSuperAdmin } from '@/lib/hooks/use-supabase-auth'

/**
 * SuperAdmin only wrapper component with role hierarchy logic
 *
 * Role Hierarchy:
 * - superadmin: Full system access, can manage all admins, invite new admins
 * - admin: Limited access, can view data but cannot manage other admins
 *
 * Superadmin Logic:
 * 1. Users with roleId 1 are superadmins
 * 2. Superadmin can invite other admins via email (resend API)
 * 3. Only superadmin can promote/demote other users
 * 4. Superadmin has access to all admin functions plus user management
 */

interface SuperAdminOnlyProps {
  children: React.ReactNode
  fallbackToAdmin?: boolean // Allow admin access as fallback
}

/**
 * SuperAdmin only wrapper component with automatic role detection
 */
export function SuperAdminOnly({ children, fallbackToAdmin = false }: SuperAdminOnlyProps) {
  const { user, supabaseUser, loading } = useSupabaseUser()
  const { isSuperAdmin } = useIsSuperAdmin()
  const { isAdmin } = useIsAdmin()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    )
  }

  // Check if user is authenticated with Supabase
  if (!supabaseUser || !user) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-red-600">Authentication Required</h2>
          <p className="mb-4 text-gray-600">You need to be signed in to access this area.</p>
        </div>
      </div>
    )
  }

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 [SuperAdminOnly] Access check:', {
      userRoleId: user?.roleId,
      isActive: user?.isActive,
      isSuperAdmin,
      isAdmin,
      fallbackToAdmin,
      loading,
    })
  }

  // Check access permissions
  const hasAccess = isSuperAdmin || (fallbackToAdmin && isAdmin)

  if (!hasAccess) {
    console.log('🚫 [SuperAdminOnly] Access denied, showing restricted component')
    return (
      <div className="flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-red-600">Access Restricted</h2>
          <p className="mb-4 text-gray-600">
            {fallbackToAdmin
              ? 'You need superadmin or admin privileges to access this area.'
              : 'You need superadmin privileges to access this area.'}
          </p>
          <div className="space-y-2 text-sm text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <Crown className="h-4 w-4 text-yellow-600" />
              <span>SuperAdmin: Full system access</span>
            </div>
            {fallbackToAdmin && (
              <div className="flex items-center justify-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span>Admin: Limited system access</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Role checking utility functions
 */
export function useUserRole() {
  const { user } = useSupabaseUser()
  const { isSuperAdmin } = useIsSuperAdmin()
  const { isAdmin } = useIsAdmin()

  return {
    role: user?.role?.roleName ?? 'user',
    isSuperAdmin,
    isAdmin: isAdmin && !isSuperAdmin, // Admin but not superadmin
    hasAdminAccess: isAdmin ?? isSuperAdmin,
    canManageUsers: isSuperAdmin,
    canInviteAdmins: isSuperAdmin,
  }
}

/**
 * Role-based access control hook
 */
export function useRoleAccess() {
  const roleInfo = useUserRole()

  return {
    ...roleInfo,
    canAccessDashboard: roleInfo.hasAdminAccess,
    canManageSystem: roleInfo.isSuperAdmin,
    canViewAnalytics: roleInfo.hasAdminAccess,
    canModifySettings: roleInfo.isSuperAdmin,
  }
}
