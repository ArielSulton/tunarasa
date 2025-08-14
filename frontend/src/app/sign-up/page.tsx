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
      setError('Kata sandi tidak cocok')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      console.log('❌ Password too short')
      setError('Kata sandi harus minimal 6 karakter')
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
          userFriendlyError =
            'Terlalu banyak percobaan pendaftaran. Silakan tunggu beberapa menit sebelum mencoba lagi.'
        } else if (result.error.message.includes('User already registered')) {
          userFriendlyError = 'Akun dengan email ini sudah ada. Silakan coba masuk sebagai gantinya.'
        } else if (result.error.message.includes('Invalid email')) {
          userFriendlyError = 'Silakan masukkan alamat email yang valid.'
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
        setError('Kesalahan jaringan: Tidak dapat terhubung ke server. Silakan periksa koneksi internet Anda.')
      } else {
        setError('Terjadi kesalahan yang tidak terduga. Silakan coba lagi.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Buat Akun</CardTitle>
          <CardDescription>Masukkan informasi Anda untuk membuat akun baru</CardDescription>
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
                placeholder="Masukkan kata sandi Anda (min. 6 karakter)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi Kata Sandi</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Konfirmasi kata sandi Anda"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Buat Akun
            </Button>

            <div className="text-center text-sm">
              Sudah punya akun?{' '}
              <Link href="/sign-in" className="text-primary hover:underline">
                Masuk
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
