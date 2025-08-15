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
import { useSupabaseUser, useIsAdmin } from '@/hooks/use-supabase-auth'
import { useState, useEffect } from 'react'
import { User, LogOut, AlertTriangle, Loader2 } from 'lucide-react'

/**
 * Sign In component
 * Protected version that handles auth context safely
 */
export function AuthSignIn() {
  const [isClient, setIsClient] = useState(false)

  // Ensure we're on the client side before using auth hooks
  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return <AuthSignInContent />
}

function AuthSignInContent() {
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
        setError(result.error.message || 'Masuk gagal')
      } else {
        console.log('✅ [AuthSignIn] Sign in successful!')
      }
    } catch (error) {
      console.error('❌ [AuthSignIn] Exception during sign in:', error)
      setError('Terjadi kesalahan tak terduga. Silakan coba lagi.')
    } finally {
      setLoading(false)
      console.log('🏁 [AuthSignIn] Process completed')
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Masuk</CardTitle>
            <CardDescription>Masuk ke akun admin Tunarasa Anda</CardDescription>
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
                {loading ? 'Sedang masuk...' : 'Masuk'}
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
 * Protected version that handles auth context safely
 */
export function AuthSignUp() {
  const [isClient, setIsClient] = useState(false)

  // Ensure we're on the client side before using auth hooks
  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return <AuthSignUpContent />
}

function AuthSignUpContent() {
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
      setError('Password tidak sama')
      setLoading(false)
      return
    }

    // Validate password strength
    if (password.length < 6) {
      console.log('❌ [AuthSignUp] Password too short')
      setError('Password harus minimal 6 karakter')
      setLoading(false)
      return
    }

    try {
      console.log('🔗 [AuthSignUp] Calling signUp function...')
      const result = await signUp(email, password)
      console.log('📊 [AuthSignUp] Sign up result:', result)

      if (result.error) {
        console.error('❌ [AuthSignUp] Sign up failed:', result.error)
        setError(result.error.message || 'Pendaftaran gagal')
      } else {
        console.log('✅ [AuthSignUp] Sign up successful!')
        setMessage('Periksa email Anda untuk link konfirmasi')
        // Clear form on success
        setEmail('')
        setPassword('')
        setConfirmPassword('')
      }
    } catch (error) {
      console.error('❌ [AuthSignUp] Exception during sign up:', error)
      setError('Terjadi kesalahan tak terduga. Silakan coba lagi.')
    } finally {
      setLoading(false)
      console.log('🏁 [AuthSignUp] Process completed')
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Daftar</CardTitle>
            <CardDescription>Buat akun admin Tunarasa Anda</CardDescription>
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
                <Label htmlFor="confirm-password">Konfirmasi Password</Label>
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
                {loading ? 'Membuat akun...' : 'Daftar'}
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
 * Protected version that handles auth context safely
 */
export function AuthUserButton() {
  const [isClient, setIsClient] = useState(false)

  // Ensure we're on the client side before using auth hooks
  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <Button variant="outline" disabled className="flex items-center space-x-2 px-6 py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  return <AuthUserButtonContent />
}

function AuthUserButtonContent() {
  const { signOut } = useAuth()
  const { user } = useSupabaseUser()
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Button
      variant="outline"
      onClick={() => void handleSignOut()}
      className="flex items-center space-x-2 px-6 py-2"
      disabled={loading}
    >
      <LogOut className="h-4 w-4" />
      <span>{loading ? 'Keluar...' : 'Keluar'}</span>
    </Button>
  )
}

/**
 * Sign in button for guest users
 */
export function AuthSignInButton() {
  return (
    <Button variant="outline" asChild>
      <a href="/sign-in">Masuk</a>
    </Button>
  )
}

/**
 * Sign up button for guest users
 */
export function AuthSignUpButton() {
  return (
    <Button asChild>
      <a href="/sign-up">Daftar</a>
    </Button>
  )
}

/**
 * Auth status component showing current user or sign in options
 * Protected version that handles auth context safely
 */
export function AuthStatus() {
  const [isClient, setIsClient] = useState(false)

  // Ensure we're on the client side before using auth hooks
  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="flex items-center justify-center space-x-2">
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
        <span className="text-muted-foreground text-sm">Memuat...</span>
      </div>
    )
  }

  return <AuthStatusContent />
}

function AuthStatusContent() {
  const [isInternalClient, setIsInternalClient] = useState(false)

  // Ensure we're on the client side before using auth hooks
  useEffect(() => {
    setIsInternalClient(true)
  }, [])

  if (!isInternalClient) {
    return (
      <div className="flex items-center justify-center space-x-2">
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
        <span className="text-muted-foreground text-sm">Memuat...</span>
      </div>
    )
  }

  return <AuthStatusInternalContent />
}

function AuthStatusInternalContent() {
  const { user, loading } = useSupabaseUser()
  const { signOut } = useAuth()
  const [signOutLoading, setSignOutLoading] = useState(false)

  const handleSignOut = async () => {
    setSignOutLoading(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setSignOutLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center space-x-2">
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
        <span className="text-muted-foreground text-sm">Memuat...</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center space-x-2">
          <AuthSignInButton />
          <AuthSignUpButton />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-lg font-medium text-white">
          {user.fullName?.charAt(0) ?? user.email?.charAt(0) ?? <User className="h-8 w-8" />}
        </div>
        <p className="mb-1 font-medium text-gray-900">{user.fullName ?? user.firstName ?? 'Admin User'}</p>
        <p className="mb-4 text-sm text-gray-600">{user.email}</p>
      </div>
      <Button
        variant="outline"
        onClick={() => void handleSignOut()}
        className="flex items-center space-x-2 px-6 py-2"
        disabled={signOutLoading}
      >
        <LogOut className="h-4 w-4" />
        <span>{signOutLoading ? 'Keluar...' : 'Keluar'}</span>
      </Button>
    </div>
  )
}

/**
 * Admin only wrapper component
 * Protected version that handles auth context safely
 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false)

  // Ensure we're on the client side before using auth hooks
  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    )
  }

  return <AdminOnlyContent>{children}</AdminOnlyContent>
}

function AdminOnlyContent({ children }: { children: React.ReactNode }) {
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
          <h2 className="text-destructive mb-2 text-xl font-semibold">Autentikasi Diperlukan</h2>
          <p className="text-muted-foreground">Anda perlu masuk untuk mengakses area ini.</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-red-600" />
          <h2 className="text-destructive mb-2 text-xl font-semibold">Akses Ditolak</h2>
          <p className="text-muted-foreground">Anda memerlukan hak akses admin untuk mengakses area ini.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
