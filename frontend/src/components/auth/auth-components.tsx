/**
 * Authentication components using Supabase Auth
 */

'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/components/auth/SupabaseAuthProvider'
import { useSupabaseUser, useIsAdmin } from '@/lib/hooks/use-supabase-auth'
import { useState } from 'react'
import { User, LogOut, AlertTriangle } from 'lucide-react'

/**
 * Sign In component
 */
export function AuthSignIn() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🚀 [AuthSignIn] Form submitted')
    console.log('- Email:', email)
    console.log('- Password length:', password.length)

    setLoading(true)
    setError('')

    try {
      console.log('🔗 [AuthSignIn] Calling signIn function...')
      const result = await signIn(email, password)
      console.log('📊 [AuthSignIn] Sign in result:', result)

      if (result.error) {
        console.error('❌ [AuthSignIn] Sign in failed:', result.error)
        setError(result.error.message || 'Sign in failed')
      } else {
        console.log('✅ [AuthSignIn] Sign in successful!')
      }
    } catch (error) {
      console.error('❌ [AuthSignIn] Exception during sign in:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
      console.log('🏁 [AuthSignIn] Process completed')
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Sign in to your Tunarasa admin account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSignIn(e)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Sign Up component
 */
export function AuthSignUp() {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🚀 [AuthSignUp] Form submitted')
    console.log('- Email:', email)
    console.log('- Password length:', password.length)
    console.log('- Confirm password length:', confirmPassword.length)

    setLoading(true)
    setError('')
    setMessage('')

    // Validate passwords match
    if (password !== confirmPassword) {
      console.log('❌ [AuthSignUp] Passwords do not match')
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    // Validate password strength
    if (password.length < 6) {
      console.log('❌ [AuthSignUp] Password too short')
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    try {
      console.log('🔗 [AuthSignUp] Calling signUp function...')
      const result = await signUp(email, password)
      console.log('📊 [AuthSignUp] Sign up result:', result)

      if (result.error) {
        console.error('❌ [AuthSignUp] Sign up failed:', result.error)
        setError(result.error.message || 'Sign up failed')
      } else {
        console.log('✅ [AuthSignUp] Sign up successful!')
        setMessage('Check your email for confirmation link')
        // Clear form on success
        setEmail('')
        setPassword('')
        setConfirmPassword('')
      }
    } catch (error) {
      console.error('❌ [AuthSignUp] Exception during sign up:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
      console.log('🏁 [AuthSignUp] Process completed')
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>Create your Tunarasa admin account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSignUp(e)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {message && (
                <Alert>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Sign Up'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * User profile button
 */
export function AuthUserButton() {
  const { signOut } = useAuth()
  const { user } = useSupabaseUser()

  const handleSignOut = async () => {
    await signOut()
  }

  if (!user) return null

  return (
    <div className="flex items-center space-x-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
        {user.fullName?.charAt(0) ?? user.email?.charAt(0) ?? <User className="h-4 w-4" />}
      </div>
      <Button variant="ghost" size="sm" onClick={void handleSignOut} className="flex items-center space-x-1">
        <LogOut className="h-4 w-4" />
        <span>Sign Out</span>
      </Button>
    </div>
  )
}

/**
 * Sign in button for guest users
 */
export function AuthSignInButton() {
  return (
    <Button variant="outline" asChild>
      <a href="/sign-in">Sign In</a>
    </Button>
  )
}

/**
 * Sign up button for guest users
 */
export function AuthSignUpButton() {
  return (
    <Button asChild>
      <a href="/sign-up">Sign Up</a>
    </Button>
  )
}

/**
 * Auth status component showing current user or sign in options
 */
export function AuthStatus() {
  const { user, loading } = useSupabaseUser()

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center space-x-2">
        <AuthSignInButton />
        <AuthSignUpButton />
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-muted-foreground text-sm">{user.fullName ?? user.firstName ?? user.email}</span>
      <AuthUserButton />
    </div>
  )
}

/**
 * Admin only wrapper component
 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSupabaseUser()
  const { isAdmin } = useIsAdmin()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-red-600" />
          <h2 className="text-destructive mb-2 text-xl font-semibold">Authentication Required</h2>
          <p className="text-muted-foreground">You need to be signed in to access this area.</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-red-600" />
          <h2 className="text-destructive mb-2 text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You need admin privileges to access this area.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
