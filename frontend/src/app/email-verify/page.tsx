'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail } from 'lucide-react'

export default function EmailVerifyPage() {
  const router = useRouter()

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Mail className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-600">Periksa Email Anda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Kami telah mengirimkan email verifikasi. Silakan periksa kotak masuk Anda dan klik tautan verifikasi untuk
            mengaktifkan akun Anda.
          </p>

          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Setelah memverifikasi email, Anda dapat masuk ke akun Anda.</p>

            <Button variant="outline" onClick={() => router.push('/sign-in')} className="w-full">
              Masuk ke Akun
            </Button>
          </div>

          <div className="text-muted-foreground pt-4 text-xs">
            <p>Tidak menerima email? Periksa folder spam atau coba daftar lagi.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
