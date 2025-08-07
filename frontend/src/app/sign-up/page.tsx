'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/SupabaseAuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signUp } = useAuth()

  // Monitor URL changes and component state
  useEffect(() => {
    console.log('📍 SignUp page loaded')
    console.log('- Current URL:', window.location.href)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('🔥 [DEBUG] handleSubmit called!')
    e.preventDefault()
    console.log('🚀 Sign up form submitted')
    console.log('- Email:', email)
    console.log('- Password length:', password.length)
    console.log('- Passwords match:', password === confirmPassword)

    setLoading(true)
    setError(null)

    // Form validation
    if (password !== confirmPassword) {
      console.log('❌ Passwords do not match')
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      console.log('❌ Password too short')
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    try {
      console.log('🔗 Calling signUp function...')
      const result = await signUp(email, password)

      if (result.error) {
        console.error('❌ Sign up failed:', result.error.message)

        // Provide more helpful error messages
        let userFriendlyError = result.error.message
        if (result.error.message.includes('Email rate limit exceeded')) {
          userFriendlyError = 'Too many signup attempts. Please wait a few minutes before trying again.'
        } else if (result.error.message.includes('User already registered')) {
          userFriendlyError = 'An account with this email already exists. Please try signing in instead.'
        } else if (result.error.message.includes('Invalid email')) {
          userFriendlyError = 'Please enter a valid email address.'
        }

        setError(userFriendlyError)
      } else {
        console.log('✅ Sign up successful!')
        console.log('- User created:', !!result.data?.user)
        console.log('- Session created:', !!result.data?.session)

        if (result.data?.user) {
          console.log('- User ID:', result.data.user.id)
          console.log('- Email confirmed:', !!result.data.user.email_confirmed_at)
        }

        console.log('🔄 About to redirect to /email-verify using window.location.replace')

        // Use window.location.replace to avoid middleware issues
        window.location.replace('/email-verify')
      }
    } catch (error) {
      console.error('❌ Sign up exception:', error)

      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setError(
          'Network error: Cannot reach Supabase. Please check your internet connection and Supabase configuration.',
        )
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Enter your information to create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
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
                placeholder="Enter your password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>

            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link href="/sign-in" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
