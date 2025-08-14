/**
 * Unauthorized Access Page
 * Shown when users try to access admin-only areas without proper permissions
 */

'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AuthStatus } from '@/components/auth/auth-components'
import { Shield, Crown, AlertTriangle, Home } from 'lucide-react'
import { useAdminAccess } from '@/components/auth/AdminOnly'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function UnauthorizedPage() {
  const { user, hasAdminAccess, roleId, role } = useAdminAccess()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg space-y-6 p-6 text-center">
        {/* Error Icon and Status */}
        <div className="space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="text-4xl font-bold text-red-600">403</h1>
          <h2 className="text-2xl font-semibold text-gray-900">Akses Ditolak</h2>
          <p className="text-gray-600">
            Anda tidak memiliki izin untuk mengakses dashboard admin.
            {hasAdminAccess
              ? 'Ini mungkin masalah sementara dengan sesi Anda.'
              : 'Diperlukan hak istimewa Admin atau SuperAdmin.'}
          </p>
        </div>

        {/* User Status Information */}
        {user && (
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 font-medium text-gray-900">Status Akun Anda</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Peran:</span>
                <span className="font-medium capitalize">{role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Role ID:</span>
                <span className="font-medium">{roleId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Akses Admin:</span>
                <span className={`font-medium ${hasAdminAccess ? 'text-green-600' : 'text-red-600'}`}>
                  {hasAdminAccess ? 'Ya' : 'Tidak'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Role Requirements */}
        <div className="rounded-lg border bg-blue-50 p-4">
          <h3 className="mb-3 font-medium text-blue-900">Persyaratan Akses</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-600" />
              <span>SuperAdmin (role_id: 1): Akses sistem penuh</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span>Admin (role_id: 2): Akses dashboard dan analitik</span>
            </div>
          </div>
        </div>

        {/* Auth Status */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <AuthStatus />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="outline" className="flex items-center gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Beranda
              </Link>
            </Button>
            {!hasAdminAccess && (
              <Button asChild>
                <Link href="/sign-in">Masuk dengan Akun Lain</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="text-sm text-gray-500">
          Jika Anda yakin ini adalah kesalahan, silakan hubungi administrator sistem Anda.
        </div>
      </div>
    </div>
  )
}
