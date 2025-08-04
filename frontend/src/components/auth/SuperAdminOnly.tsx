'use client'

import { useUser } from '@clerk/nextjs'
import { Shield, Crown, AlertTriangle } from 'lucide-react'
import { authEnv, isClerkConfigured } from '@/config/auth'

/**
 * SuperAdmin only wrapper component with role hierarchy logic
 *
 * Role Hierarchy:
 * - superadmin: Full system access, can manage all admins, invite new admins
 * - admin: Limited access, can view data but cannot manage other admins
 *
 * Superadmin Logic:
 * 1. First user to access /akses-khusus becomes superadmin automatically
 * 2. Superadmin can invite other admins via email (resend API)
 * 3. Only superadmin can promote/demote other users
 * 4. Superadmin has access to all admin functions plus user management
 */

interface SuperAdminOnlyProps {
  children: React.ReactNode
  fallbackToAdmin?: boolean // Allow admin access as fallback
}

/**
 * Internal Clerk-enabled superadmin component
 */
function SuperAdminOnlyWithClerk({ children, fallbackToAdmin = false }: SuperAdminOnlyProps) {
  const { user, isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    )
  }

  const userRole = user?.publicMetadata?.role as string
  const isSuperAdmin = userRole === 'superadmin'
  const isAdmin = userRole === 'admin'

  // Check access permissions
  const hasAccess = isSuperAdmin || (fallbackToAdmin && isAdmin)

  if (!hasAccess) {
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
 * SuperAdmin only wrapper component with automatic role detection
 */
export function SuperAdminOnly({ children, fallbackToAdmin = false }: SuperAdminOnlyProps) {
  // Check if Clerk is configured first
  const shouldUseClerk = authEnv.NEXT_PUBLIC_ENABLE_CLERK_AUTH && isClerkConfigured()

  // If Clerk is not configured, allow access in guest mode for development/build
  if (!shouldUseClerk) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <Crown className="h-8 w-8 text-yellow-600" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-yellow-600">Development Mode</h2>
          <p className="mb-4 text-gray-600">SuperAdmin features are in guest mode (Clerk disabled)</p>
          {children}
        </div>
      </div>
    )
  }

  // Use separate component that calls useUser hook
  return <SuperAdminOnlyWithClerk fallbackToAdmin={fallbackToAdmin}>{children}</SuperAdminOnlyWithClerk>
}

/**
 * Role checking utility functions
 */
export function useUserRole() {
  const { user } = useUser()
  const userRole = user?.publicMetadata?.role as string

  return {
    role: userRole,
    isSuperAdmin: userRole === 'superadmin',
    isAdmin: userRole === 'admin',
    hasAdminAccess: userRole === 'superadmin' || userRole === 'admin',
    canManageUsers: userRole === 'superadmin',
    canInviteAdmins: userRole === 'superadmin',
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
