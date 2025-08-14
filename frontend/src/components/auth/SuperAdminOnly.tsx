/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
'use client'

import { Shield, Crown, AlertTriangle } from 'lucide-react'
import { useSupabaseUser, useIsAdmin, useIsSuperAdmin } from '@/hooks/use-supabase-auth'

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
          <h2 className="mb-2 text-xl font-semibold text-red-600">Autentikasi Diperlukan</h2>
          <p className="mb-4 text-gray-600">Anda perlu masuk untuk mengakses area ini.</p>
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
      <div className="bg-card w-full rounded-lg border p-6 text-center shadow-sm">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-red-600">Akses Terbatas</h2>
        <p className="mb-4 text-sm text-gray-600">
          {fallbackToAdmin
            ? 'Anda memerlukan hak akses superadmin atau admin untuk mengakses area ini.'
            : 'Anda memerlukan hak akses superadmin untuk mengakses area ini.'}
        </p>
        <div className="space-y-1 text-xs text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <Crown className="h-3 w-3 text-yellow-600" />
            <span>SuperAdmin: Akses penuh sistem</span>
          </div>
          {fallbackToAdmin && (
            <div className="flex items-center justify-center gap-2">
              <Shield className="h-3 w-3 text-blue-600" />
              <span>Admin: Akses terbatas sistem</span>
            </div>
          )}
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
