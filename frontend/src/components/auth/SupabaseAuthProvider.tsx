'use client'

import { createClient } from '@/lib/supabase/client'
import { logEnvironmentCheck } from '@/lib/supabase/env-checker'
import { validateSupabaseConfig } from '@/lib/supabase/config-validator'
import { createContext, useContext, useEffect, useState, useCallback, type PropsWithChildren } from 'react'
import type { User, Session, AuthError, SupabaseClient } from '@supabase/supabase-js'

interface AuthResult {
  data: { user: User | null; session: Session | null } | null
  error: AuthError | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ data: unknown | null; error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Cache for user role data to improve middleware performance
const USER_ROLE_CACHE_PREFIX = 'user_role_cache_'
const SYNC_COOLDOWN_PREFIX = 'last_sync_'
const SYNC_COOLDOWN_MS = 300000 // 5 minutes

export function SupabaseAuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)

  // Initialize Supabase client with optimized error handling
  useEffect(() => {
    let mounted = true

    const initializeSupabase = () => {
      try {
        console.log('🔗 [SupabaseAuthProvider] Initializing...')

        // Validate configuration first
        const configValidation = validateSupabaseConfig()
        if (!configValidation.isValid) {
          console.error('❌ [SupabaseAuthProvider] Configuration invalid:', configValidation.errors)
          console.error('')
          console.error('🚑 SETUP REQUIRED: Please update your .env.local file with actual Supabase credentials.')
          console.error('See SUPABASE_SETUP_INSTRUCTIONS.md for detailed setup steps.')
          console.error('')

          if (mounted) {
            setLoading(false)
          }
          return
        }

        logEnvironmentCheck()
        const client = createClient()

        if (mounted) {
          setSupabase(client)
        }
      } catch (error) {
        console.error('❌ [SupabaseAuthProvider] Failed to initialize:', error)
        console.error('')
        console.error('🚑 If you see configuration errors above, please update your .env.local file.')
        console.error('See SUPABASE_SETUP_INSTRUCTIONS.md for detailed setup steps.')
        console.error('')

        if (mounted) {
          setLoading(false)
        }
      }
    }

    void initializeSupabase()

    return () => {
      mounted = false
    }
  }, [])

  // Optimized retryable error detection
  const isRetryableError = useCallback((error: unknown) => {
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as { code?: string; message?: string }
      // Only retry for specific database and network errors
      return (
        (['PGRST301', 'PGRST302'].includes(errorObj.code ?? '') || errorObj.message?.includes('fetch')) ??
        errorObj.message?.includes('timeout') ??
        errorObj.message?.includes('network')
      )
    }
    return false
  }, [])

  // Cache user role data for middleware performance
  const cacheUserRole = useCallback((userId: string, roleId: number) => {
    if (typeof window !== 'undefined') {
      const cacheData = {
        userId,
        roleId,
        timestamp: Date.now(),
        isActive: true,
      }
      sessionStorage.setItem(`${USER_ROLE_CACHE_PREFIX}${userId}`, JSON.stringify(cacheData))
    }
  }, [])

  // Check if user sync is in cooldown period
  const isSyncInCooldown = useCallback((userId: string) => {
    if (typeof window === 'undefined') return false

    const lastSyncKey = `${SYNC_COOLDOWN_PREFIX}${userId}`
    const lastSync = sessionStorage.getItem(lastSyncKey)

    if (!lastSync) return false

    return Date.now() - parseInt(lastSync) < SYNC_COOLDOWN_MS
  }, [])

  // Set sync cooldown
  const setSyncCooldown = useCallback((userId: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`${SYNC_COOLDOWN_PREFIX}${userId}`, String(Date.now()))
    }
  }, [])

  // Optimized user sync with performance improvements
  const syncUserToDB = useCallback(
    async (user: User, isNewUser = false, retryCount = 0) => {
      if (!supabase) {
        console.error('❌ Cannot sync user: Supabase client not initialized')
        return { success: false, error: 'Supabase client not initialized' }
      }

      // Enhanced user validation
      if (!user?.id) {
        console.error('❌ [SupabaseAuthProvider] User object or user.id is null/undefined:', {
          userExists: !!user,
          userId: user?.id,
          userEmail: user?.email,
          isNewUser,
          retryCount,
        })
        return { success: false, error: 'Invalid user object: missing user ID' }
      }

      if (!user?.email) {
        console.error('❌ [SupabaseAuthProvider] User email is null/undefined:', {
          userId: user.id,
          userEmail: user?.email,
          isNewUser,
          retryCount,
        })
        return { success: false, error: 'Invalid user object: missing email' }
      }

      // Skip sync if in cooldown period
      if (isSyncInCooldown(user.id)) {
        return { success: true, data: { skipped: true } }
      }

      const maxRetries = 2 // Reduced for faster performance
      const retryDelay = Math.min(500 + retryCount * 300, 1500) // Optimized backoff

      // Streamlined logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Syncing user (${retryCount + 1}/${maxRetries + 1}): ${user.email}`)
      }

      try {
        // Enhanced sync payload with validation
        const syncPayload = {
          userId: user.id,
          email: user.email,
          userData: {
            first_name: user.user_metadata?.first_name ?? null,
            last_name: user.user_metadata?.last_name ?? null,
            full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
            image_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
            user_metadata: user.user_metadata ?? {},
            email_confirmed_at: user.email_confirmed_at,
          },
          isNewUser,
        }

        // Additional payload validation before sending
        if (!syncPayload.userId || !syncPayload.email) {
          console.error('❌ [SupabaseAuthProvider] Invalid sync payload:', {
            userId: syncPayload.userId,
            email: syncPayload.email,
            hasUserData: !!syncPayload.userData,
          })
          return { success: false, error: 'Invalid sync payload: missing required fields' }
        }

        // Debug log for development
        if (process.env.NODE_ENV === 'development') {
          console.log('📋 [SupabaseAuthProvider] Sync payload:', {
            userId: syncPayload.userId,
            email: syncPayload.email,
            isNewUser: syncPayload.isNewUser,
          })
        }

        // Fetch with timeout and abort controller
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

        const syncResponse = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sync-Attempt': String(retryCount + 1),
          },
          body: JSON.stringify(syncPayload),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        const syncResult = await syncResponse.json()

        if (!syncResponse.ok || !syncResult.success) {
          const errorMessage = syncResult.error ?? `Sync failed: ${syncResponse.status}`

          // Smart retry for specific errors only
          if (retryCount < maxRetries && isRetryableError({ message: errorMessage })) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay))
            return syncUserToDB(user, isNewUser, retryCount + 1)
          }

          return { success: false, error: errorMessage }
        }

        // Cache user role and set cooldown
        if (syncResult.data?.roleId) {
          cacheUserRole(user.id, syncResult.data.roleId)
        }
        setSyncCooldown(user.id)

        return { success: true, data: syncResult.data }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return { success: false, error: 'Sync timeout' }
        }

        // Retry only for network errors
        if (retryCount < maxRetries && isRetryableError(error)) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          return syncUserToDB(user, isNewUser, retryCount + 1)
        }

        return { success: false, error: String(error) }
      }
    },
    [supabase, isRetryableError, isSyncInCooldown, cacheUserRole, setSyncCooldown],
  )

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    console.log('🔗 Setting up Supabase auth listeners...')

    // Get initial session
    void supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('❌ Error getting initial session:', error)
        }

        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        // Check for pending sync operations
        if (typeof window !== 'undefined' && session?.user) {
          const pendingSync = localStorage.getItem('pending_user_sync')
          if (pendingSync) {
            try {
              const syncData = JSON.parse(pendingSync) as {
                userId: string
                email: string
                timestamp: number
                isNewUser: boolean
              }
              // Retry if pending sync is for same user and recent
              if (syncData.userId === session.user.id && Date.now() - syncData.timestamp < 3600000) {
                console.log('🔄 Retrying pending user sync...')
                void syncUserToDB(session.user, syncData.isNewUser)
                  .then(() => localStorage.removeItem('pending_user_sync'))
                  .catch(console.error)
              } else {
                localStorage.removeItem('pending_user_sync')
              }
            } catch {
              localStorage.removeItem('pending_user_sync')
            }
          }
        }
      })
      .catch((error) => {
        console.error('❌ Fatal error getting session:', error)
        setLoading(false)
      })

    // Optimized auth state change handler
    const {
      data: { subscription },
      // eslint-disable-next-line @typescript-eslint/require-await
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Auth state change:', event)
      }

      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      // Optimized sync logic for critical events only
      if (['SIGNED_IN', 'SIGNED_UP', 'TOKEN_REFRESHED'].includes(event) && session?.user) {
        const isNewUser =
          String(event) === 'SIGNED_UP' || (!session.user.email_confirmed_at && String(event) === 'SIGNED_IN')

        // Non-blocking sync with minimal error handling
        syncUserToDB(session.user, isNewUser)
          .then((syncResult) => {
            if (!syncResult.success && typeof window !== 'undefined') {
              // Store failure for recovery
              localStorage.setItem(
                'pending_user_sync',
                JSON.stringify({
                  userId: session.user.id,
                  email: session.user.email,
                  timestamp: Date.now(),
                  isNewUser,
                }),
              )
            } else if (typeof window !== 'undefined') {
              localStorage.removeItem('pending_user_sync')
            }
          })
          .catch(() => {
            // Silent error handling for better UX
          })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, syncUserToDB])

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { data: null, error: new Error('Supabase client not initialized') as AuthError }
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  // Optimized signUp function
  const signUp = async (email: string, password: string) => {
    if (!supabase) {
      const error = new Error('Supabase client not initialized') as AuthError
      return { data: null, error }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          data: {
            email,
            created_at: new Date().toISOString(),
          },
        },
      })

      if (error && process.env.NODE_ENV === 'development') {
        console.error('❌ Sign up error:', error.message)
      }

      if (data?.user && process.env.NODE_ENV === 'development') {
        console.log('✅ User created:', data.user.email)
      }

      return { data, error }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Sign up exception:', error instanceof Error ? error.message : String(error))
      }
      throw error
    }
  }

  const signOut = async () => {
    if (!supabase) {
      return { error: new Error('Supabase client not initialized') as AuthError }
    }

    // Clear user role cache on signout
    if (typeof window !== 'undefined' && user?.id) {
      sessionStorage.removeItem(`${USER_ROLE_CACHE_PREFIX}${user.id}`)
      sessionStorage.removeItem(`${SYNC_COOLDOWN_PREFIX}${user.id}`)
    }

    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const resetPassword = async (email: string) => {
    if (!supabase) {
      return { data: null, error: new Error('Supabase client not initialized') as AuthError }
    }
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { data, error }
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within a SupabaseAuthProvider')
  }
  return context
}

export default SupabaseAuthProvider
