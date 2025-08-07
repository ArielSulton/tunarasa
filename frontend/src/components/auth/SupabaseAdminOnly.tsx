'use client'

import { useEffect, useState, type PropsWithChildren } from 'react'
import { useAuth } from './SupabaseAuthProvider'
import { Loader2 } from 'lucide-react'

interface SupabaseAdminOnlyProps extends PropsWithChildren {
  /**
   * Minimum role level required (1 = superadmin, 2 = admin)
   * @default 2
   */
  minRole?: 1 | 2
  /**
   * What to show when loading user role
   */
  fallback?: React.ReactNode
  /**
   * What to show when user is not admin
   */
  unauthorized?: React.ReactNode
}

/**
 * Component that only renders children if user has admin privileges
 * Replaces Clerk's role-based protection with Supabase Auth
 */
export default function SupabaseAdminOnly({ children, minRole = 2, fallback, unauthorized }: SupabaseAdminOnlyProps) {
  const { user, loading: authLoading } = useAuth()
  const [userRole, setUserRole] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || authLoading) {
      setLoading(authLoading)
      return
    }

    async function checkUserRole() {
      try {
        // Use API endpoint instead of direct Supabase client query
        const response = await fetch('/api/admin/users/me', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        if (result.success && result.data?.user?.is_active) {
          setUserRole(result.data.user.role_id)
        } else {
          setUserRole(null)
        }
      } catch (error) {
        console.error('❌ [SupabaseAdminOnly] Error checking user role:', error)
        setUserRole(null)
      } finally {
        setLoading(false)
      }
    }

    void checkUserRole()
  }, [user, authLoading])

  // Show loading state
  if (loading || authLoading) {
    return (
      fallback ?? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )
    )
  }

  // User not authenticated or doesn't have required role
  if (!user || !userRole || userRole > minRole) {
    return (
      unauthorized ?? (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <h2 className="text-lg font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">You don&apos;t have permission to view this content.</p>
          </div>
        </div>
      )
    )
  }

  // User has sufficient privileges
  return <>{children}</>
}
