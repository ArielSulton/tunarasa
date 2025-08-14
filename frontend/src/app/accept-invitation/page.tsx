'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, AlertCircle, Clock, User, Mail, Shield } from 'lucide-react'

interface InvitationData {
  email: string
  role: string
  customMessage?: string
  expiresAt: string
  createdAt: string
  status: string
  isExpired: boolean
  isAlreadyAccepted: boolean
  isCancelled: boolean
  timeRemaining: number
  timeRemainingFormatted: string | null
}

export default function AcceptInvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [isValidating, setIsValidating] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  })

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Validate invitation token on component mount
  useEffect(() => {
    if (!token) {
      setError('Tautan undangan tidak valid - token hilang')
      setIsValidating(false)
      return
    }

    void validateInvitation(token)
  }, [token])

  const validateInvitation = async (invitationToken: string) => {
    try {
      const response = await fetch(`/api/auth/accept-invitation?token=${encodeURIComponent(invitationToken)}`)
      const result = await response.json()

      if (response.ok && result.valid) {
        setInvitation(result.data)
        setError(null)
      } else {
        setError(result.error ?? 'Undangan tidak valid')
      }
    } catch (error) {
      console.error('Error validating invitation:', error)
      setError('Gagal memvalidasi undangan')
    } finally {
      setIsValidating(false)
    }
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.firstName.trim()) {
      errors.firstName = 'Nama depan wajib diisi'
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Nama belakang wajib diisi'
    }

    if (formData.password.length < 8) {
      errors.password = 'Kata sandi harus minimal 8 karakter'
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Kata sandi tidak cocok'
    }

    // Password strength validation
    const hasUpperCase = /[A-Z]/.test(formData.password)
    const hasLowerCase = /[a-z]/.test(formData.password)
    const hasNumbers = /\d/.test(formData.password)
    const _hasNonalphas = /\W/.test(formData.password)

    if (formData.password && (!hasUpperCase || !hasLowerCase || !hasNumbers)) {
      errors.password = 'Kata sandi harus mengandung huruf besar, kecil, dan angka'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || !invitation || !token) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/accept-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          email: invitation.email,
          password: formData.password,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/sign-in?message=Account created successfully, please sign in')
        }, 3000)
      } else {
        setError(result.error ?? 'Gagal menerima undangan')
      }
    } catch (error) {
      console.error('Error accepting invitation:', error)
      setError('Gagal menerima undangan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  if (isValidating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Memvalidasi undangan...</p>
        </div>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-900">Undangan Tidak Valid</CardTitle>
            <CardDescription className="text-red-700">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')} className="w-full" variant="outline">
              Kembali ke Beranda
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-green-900">Selamat Datang di Tunarasa!</CardTitle>
            <CardDescription className="text-green-700">
              Akun admin Anda telah berhasil dibuat. Anda akan diarahkan ke halaman masuk sebentar lagi.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (invitation?.isAlreadyAccepted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-blue-900">Sudah Diterima</CardTitle>
            <CardDescription className="text-blue-700">
              Undangan ini sudah diterima. Silakan masuk untuk mengakses akun Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/sign-in')} className="w-full">
              Masuk ke Akun
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invitation?.isExpired || invitation?.isCancelled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle className="text-amber-900">
              {invitation.isExpired ? 'Undangan Kadaluarsa' : 'Undangan Dibatalkan'}
            </CardTitle>
            <CardDescription className="text-amber-700">
              {invitation.isExpired
                ? 'Undangan ini telah kadaluarsa dan tidak bisa digunakan lagi.'
                : 'Undangan ini telah dibatalkan dan tidak valid lagi.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')} className="w-full" variant="outline">
              Kembali ke Beranda
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>Terima Undangan Admin</CardTitle>
            <CardDescription>Lengkapi pengaturan akun Anda untuk bergabung dengan tim admin Tunarasa</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Invitation Details */}
            <div className="space-y-2 rounded-lg bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Email:</span>
                <span>{invitation?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Peran:</span>
                <span className="font-semibold text-blue-600 capitalize">{invitation?.role}</span>
              </div>
              {invitation?.timeRemainingFormatted && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Berakhir dalam:</span>
                  <span className="text-amber-600">{invitation.timeRemainingFormatted}</span>
                </div>
              )}
            </div>

            {/* Custom Message */}
            {invitation?.customMessage && (
              <Alert>
                <AlertDescription>
                  <strong>Pesan dari admin:</strong> {invitation.customMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Registration Form */}
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="mb-2 block text-sm font-medium">
                    Nama Depan *
                  </label>
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className={validationErrors.firstName ? 'border-red-500' : ''}
                    disabled={isSubmitting}
                  />
                  {validationErrors.firstName && (
                    <p className="mt-1 text-xs text-red-500">{validationErrors.firstName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="lastName" className="mb-2 block text-sm font-medium">
                    Nama Belakang *
                  </label>
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className={validationErrors.lastName ? 'border-red-500' : ''}
                    disabled={isSubmitting}
                  />
                  {validationErrors.lastName && (
                    <p className="mt-1 text-xs text-red-500">{validationErrors.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium">
                  Kata Sandi *
                </label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={validationErrors.password ? 'border-red-500' : ''}
                  disabled={isSubmitting}
                />
                {validationErrors.password && <p className="mt-1 text-xs text-red-500">{validationErrors.password}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  Harus minimal 8 karakter dengan huruf besar, kecil, dan angka
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium">
                  Konfirmasi Kata Sandi *
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className={validationErrors.confirmPassword ? 'border-red-500' : ''}
                  disabled={isSubmitting}
                />
                {validationErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">{validationErrors.confirmPassword}</p>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting || !invitation}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Membuat Akun...
                  </>
                ) : (
                  'Terima Undangan & Buat Akun'
                )}
              </Button>
            </form>

            <div className="text-center text-xs text-gray-500">
              Dengan menerima undangan ini, Anda setuju untuk bergabung dengan tim admin Tunarasa dan mengikuti
              kebijakan keamanan dan privasi kami.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
