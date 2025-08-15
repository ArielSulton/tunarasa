'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth/SupabaseAuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowLeft } from 'lucide-react'

// Force dynamic rendering and disable static optimization
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Component that uses auth hooks - only rendered client-side
function ForgotPasswordContent() {
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

  return <ForgotPasswordInternalContent />
}

function ForgotPasswordInternalContent() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await resetPassword(email)

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Terjadi kesalahan yang tidak terduga')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-green-600">Periksa Email Anda</CardTitle>
            <CardDescription>
              Kami telah mengirimkan tautan reset kata sandi. Silakan periksa email Anda dan ikuti petunjuk untuk
              mereset kata sandi Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/sign-in" className="text-primary inline-flex items-center text-sm hover:underline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali ke masuk
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Reset Kata Sandi</CardTitle>
          <CardDescription>
            Masukkan alamat email Anda dan kami akan mengirimkan tautan reset kata sandi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={void handleSubmit} className="space-y-4">
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirim Tautan Reset
            </Button>

            <div className="text-center">
              <Link
                href="/sign-in"
                className="text-muted-foreground hover:text-primary inline-flex items-center text-sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke masuk
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ForgotPasswordPage() {
  const [isMounted, setIsMounted] = useState(false)

  // Client-side mounting check
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prevent server-side rendering of auth hooks
  if (!isMounted) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return <ForgotPasswordContent />
}
