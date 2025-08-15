'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/auth/SupabaseAuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

// Force dynamic rendering and disable static optimization
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Component that uses auth hooks - only rendered client-side
function SignInContent() {
  const [isInternalClient, setIsInternalClient] = useState(false)

  // Ensure we're on the client side before using auth hooks
  useEffect(() => {
    setIsInternalClient(true)
  }, [])

  if (!isInternalClient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return <SignInInternalContent />
}

function SignInInternalContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signIn } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      console.log('🔍 [SignIn] Starting sign-in process...')
      const { error, data } = await signIn(email, password)

      console.log('🔍 [SignIn] Sign-in result:', { error: error?.message, hasData: !!data })

      if (error) {
        console.error('❌ [SignIn] Sign-in error:', error.message)
        setError(error.message)
      } else {
        console.log('✅ [SignIn] Sign-in successful, redirecting to dashboard...')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('❌ [SignIn] Sign-in exception:', error)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Masuk</CardTitle>
          <CardDescription>Masukkan email dan kata sandi untuk mengakses akun Anda</CardDescription>
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
                placeholder="Masukkan email Anda"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Kata Sandi</Label>
              <Input
                id="password"
                type="password"
                placeholder="Masukkan kata sandi Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Masuk
            </Button>

            <div className="text-center text-sm">
              <Link
                href="/forgot-password"
                className="text-muted-foreground hover:text-primary underline underline-offset-4"
              >
                Lupa kata sandi?
              </Link>
            </div>

            <div className="text-center text-sm">
              Belum punya akun?{' '}
              <Link href="/sign-up" className="text-primary hover:underline">
                Daftar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignInPage() {
  const [isMounted, setIsMounted] = useState(false)

  // Client-side mounting check
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prevent server-side rendering of auth hooks
  if (!isMounted) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  return <SignInContent />
}
