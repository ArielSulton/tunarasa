'use client'

import { createContext, useContext, type PropsWithChildren } from 'react'

interface NoAuthContextType {
  user: null
  session: null
  loading: false
  signIn: (email: string, password: string) => Promise<{ data: null; error: Error }>
  signUp: (email: string, password: string) => Promise<{ data: null; error: Error }>
  signOut: () => Promise<{ error: null }>
  resetPassword: (email: string) => Promise<{ data: null; error: Error }>
}

const NoAuthContext = createContext<NoAuthContextType | undefined>(undefined)

/**
 * NoAuth Provider for Docker builds or when Supabase is not configured
 * Provides a consistent auth interface without real authentication
 */
export function NoAuthProvider({ children }: PropsWithChildren) {
  const signIn = (email: string, _password: string) => {
    console.warn('Auth is disabled - signIn called with:', { email, password: '***' })
    return Promise.resolve({ data: null, error: new Error('Authentication is disabled') })
  }

  const signUp = (email: string, _password: string) => {
    console.warn('Auth is disabled - signUp called with:', { email, password: '***' })
    return Promise.resolve({ data: null, error: new Error('Authentication is disabled') })
  }

  const signOut = () => {
    console.warn('Auth is disabled - signOut called')
    return Promise.resolve({ error: null })
  }

  const resetPassword = (email: string) => {
    console.warn('Auth is disabled - resetPassword called with:', { email })
    return Promise.resolve({ data: null, error: new Error('Authentication is disabled') })
  }

  const value: NoAuthContextType = {
    user: null,
    session: null,
    loading: false,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }

  return <NoAuthContext.Provider value={value}>{children}</NoAuthContext.Provider>
}

export function useNoAuth() {
  const context = useContext(NoAuthContext)
  if (context === undefined) {
    throw new Error('useNoAuth must be used within a NoAuthProvider')
  }
  return context
}

export default NoAuthProvider
