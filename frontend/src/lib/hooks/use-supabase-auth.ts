'use client'

import { useAuth } from '@/components/auth/SupabaseAuthProvider'
import { useEffect, useState } from 'react'

export interface UserWithRole {
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
 * Hook to get current user with role information
 * Uses API endpoints instead of direct database queries for consistency with middleware
 */
export function useSupabaseUser() {
  const { user, loading: authLoading } = useAuth()
  const [userData, setUserData] = useState<UserWithRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || authLoading) {
      setLoading(authLoading)
      setUserData(null)
      return
    }

    async function fetchUserData() {
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

        if (result.success && result.data?.user) {
          const user = result.data.user
          setUserData({
            userId: user.user_id,
            supabaseUserId: user.supabase_user_id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            fullName: user.full_name,
            imageUrl: user.image_url,
            roleId: user.role_id,
            isActive: user.is_active,
            role: user.role
              ? {
                  roleName: user.role.role_name,
                  permissions: user.role.permissions ?? [],
                }
              : undefined,
          })
        } else {
          console.log('🔍 [useSupabaseUser] No user data returned from API')
          setUserData(null)
        }
      } catch (error) {
        console.error('❌ [useSupabaseUser] Error fetching user data:', error)
        setUserData(null)
      } finally {
        setLoading(false)
      }
    }

    void fetchUserData()
  }, [user, authLoading])

  return {
    user: userData,
    supabaseUser: user,
    loading,
    isLoaded: !loading,
  }
}

/**
 * Hook to check if current user is admin
 * Replaces Clerk's role checking
 */
export function useIsAdmin() {
  const { user, loading } = useSupabaseUser()

  return {
    isAdmin: user?.isActive && [1, 2].includes(user.roleId),
    loading,
  }
}

/**
 * Hook to check if current user is super admin
 */
export function useIsSuperAdmin() {
  const { user, loading } = useSupabaseUser()

  return {
    isSuperAdmin: user?.isActive && user.roleId === 1,
    loading,
  }
}

/**
 * Hook for authentication state
 * Replaces Clerk's useAuth hook
 */
export function useSupabaseAuth() {
  const auth = useAuth()
  const { user: userData } = useSupabaseUser()

  return {
    ...auth,
    userData,
    isSignedIn: !!auth.user,
    getToken: () => auth.session?.access_token ?? null,
  }
}
