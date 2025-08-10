/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Crown, AlertTriangle, Loader2 } from 'lucide-react'
import { useSupabaseUser, useIsAdmin, useIsSuperAdmin } from '@/hooks/use-supabase-auth'
import { Button } from '@/components/ui/button'

/**
 * Admin access control component with role hierarchy logic
 *
 * Role Hierarchy:
 * - role_id 1 (superadmin): Full system access, can manage all admins, invite new admins
 * - role_id 2 (admin): Limited access, can view data but cannot manage other admins
 * - role_id 3 (user): No admin access - redirected to unauthorized
 *
 * Admin Logic:
 * 1. Users with role_id 1 or 2 can access admin areas
 * 2. Only superadmin (role_id 1) can invite other admins
 * 3. Only superadmin can promote/demote other users
 * 4. Both roles have access to dashboard and analytics
 */

interface AdminOnlyProps {
  children: React.ReactNode
  requireSuperAdmin?: boolean // If true, only superadmin can access
  fallback?: React.ReactNode // Custom fallback component
}

/**
 * Admin only wrapper component with automatic role detection and redirection
 */
export function AdminOnly({ children, requireSuperAdmin = false, fallback }: AdminOnlyProps) {
  const { user, supabaseUser, loading } = useSupabaseUser()
  const { isSuperAdmin } = useIsSuperAdmin()
  const { isAdmin } = useIsAdmin()
  const router = useRouter()

  // Redirect to unauthorized page for non-admin users
  // Add delay to allow for database sync completion
  useEffect(() => {
    if (!loading && supabaseUser) {
      // If we have supabase user but no local user data, wait for sync
      if (!user) {
        console.log('🔄 [AdminOnly] Waiting for user sync completion...')
        return
      }

      const hasAccess = requireSuperAdmin ? isSuperAdmin : isAdmin || isSuperAdmin

      if (!hasAccess) {
        // Add a small delay to handle race conditions with database sync
        const redirectTimer = setTimeout(() => {
          console.log('🚫 [AdminOnly] Access denied after sync wait, redirecting to unauthorized')
          console.log('- User role ID:', user.roleId)
          console.log('- Is admin:', isAdmin)
          console.log('- Is super admin:', isSuperAdmin)
          console.log('- Requires super admin:', requireSuperAdmin)
          router.push('/unauthorized')
        }, 1500) // Wait 1.5 seconds for potential sync completion

        return () => clearTimeout(redirectTimer)
      }
    }
  }, [loading, user, supabaseUser, isAdmin, isSuperAdmin, requireSuperAdmin, router])

  // Show loading state or when user data is syncing
  if (loading || (supabaseUser && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">{loading ? 'Verifying access permissions...' : 'Syncing user data...'}</p>
        </div>
      </div>
    )
  }

  // Show authentication required message
  if (!supabaseUser || !user) {
    return (
      fallback ?? (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="max-w-md text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-red-600">Authentication Required</h2>
            <p className="mb-4 text-gray-600">You need to be signed in to access this area.</p>
            <Button onClick={() => router.push('/sign-in')} className="w-full">
              Sign In
            </Button>
          </div>
        </div>
      )
    )
  }

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 [AdminOnly] Access check:', {
      userRoleId: user?.roleId,
      isActive: user?.isActive,
      isSuperAdmin,
      isAdmin,
      requireSuperAdmin,
      loading,
    })
  }

  // Check access permissions
  const hasAccess = requireSuperAdmin ? isSuperAdmin : isAdmin || isSuperAdmin

  if (!hasAccess) {
    return (
      fallback ?? (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="max-w-md text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <Shield className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-red-600">Access Restricted</h2>
            <p className="mb-4 text-gray-600">
              {requireSuperAdmin
                ? 'You need superadmin privileges to access this area.'
                : 'You need admin or superadmin privileges to access this area.'}
            </p>
            <div className="mb-6 space-y-2 text-sm text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <Crown className="h-4 w-4 text-yellow-600" />
                <span>SuperAdmin (role_id: 1): Full system access</span>
              </div>
              {!requireSuperAdmin && (
                <div className="flex items-center justify-center gap-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span>Admin (role_id: 2): Limited system access</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Button onClick={() => router.push('/unauthorized')} className="w-full" variant="outline">
                Go to Unauthorized Page
              </Button>
              <Button onClick={() => router.push('/')} className="w-full">
                Go Home
              </Button>
            </div>
          </div>
        </div>
      )
    )
  }

  return <>{children}</>
}

/**
 * Higher-order component for admin-only pages
 */
export function withAdminAccess<P extends object>(
  Component: React.ComponentType<P>,
  options: { requireSuperAdmin?: boolean; fallback?: React.ReactNode } = {},
) {
  return function AdminProtectedComponent(props: P) {
    return (
      <AdminOnly requireSuperAdmin={options.requireSuperAdmin} fallback={options.fallback}>
        <Component {...props} />
      </AdminOnly>
    )
  }
}

/**
 * Role checking utility functions for conditional rendering
 */
export function useAdminAccess() {
  const { user } = useSupabaseUser()
  const { isSuperAdmin } = useIsSuperAdmin()
  const { isAdmin } = useIsAdmin()

  return {
    user,
    role: user?.role?.roleName ?? 'user',
    roleId: user?.roleId ?? 3,
    isSuperAdmin,
    isAdmin,
    hasAdminAccess: isAdmin || isSuperAdmin,
    canAccessDashboard: isAdmin || isSuperAdmin,
    canManageUsers: isSuperAdmin,
    canInviteAdmins: isSuperAdmin,
    canManageSystem: isSuperAdmin,
    canViewAnalytics: isAdmin || isSuperAdmin,
    canModifySettings: isSuperAdmin,
  }
}
