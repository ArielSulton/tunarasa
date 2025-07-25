'use client'

import { AuthStatusWrapper } from '@/components/auth/AuthStatusWrapper'
import { Shield, CheckCircle, Users, Lock } from 'lucide-react'

export default function AksesKhusus() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200">
      {/* Enhanced Background Elements */}
      <div className="absolute top-0 right-0 h-96 w-96 translate-x-32 -translate-y-32 animate-pulse rounded-full bg-blue-300/30"></div>
      <div className="absolute right-0 bottom-0 h-[800px] w-[800px] translate-x-96 translate-y-96 rounded-full bg-blue-400/20"></div>
      <div className="absolute top-1/4 left-0 h-64 w-64 -translate-x-32 rounded-full bg-blue-200/20"></div>

      <div className="relative z-10 min-h-screen px-4 py-20">
        <div className="mx-auto w-full max-w-2xl">
          {/* Header Section with Better Visual Hierarchy */}
          <div className="mb-12 text-center">
            {/* Icon Hero */}
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 shadow-lg">
              <Shield className="h-10 w-10 text-white" />
            </div>

            {/* Main Heading with Better Typography */}
            <h1 className="mb-4 text-4xl leading-tight font-bold text-gray-900 md:text-5xl">
              Akses{' '}
              <span className="relative text-blue-600" style={{ fontFamily: 'cursive' }}>
                Khusus
                <div className="absolute -bottom-2 left-0 h-1 w-full rounded-full bg-blue-600/30"></div>
              </span>
            </h1>

            <p className="mb-2 text-xl font-medium text-gray-700">hanya bisa diperoleh setelah verifikasi akun</p>
          </div>

          {/* Features Section for Better Understanding */}
          <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="p-4 text-center">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">Keamanan Terjamin</h3>
              <p className="text-sm text-gray-600">Enkripsi end-to-end untuk melindungi akses admin</p>
            </div>

            <div className="p-4 text-center">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">Role-Based Access</h3>
              <p className="text-sm text-gray-600">Akses disesuaikan dengan tingkat otoritas pengguna</p>
            </div>

            <div className="p-4 text-center">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                <Lock className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">Verifikasi Berlapis</h3>
              <p className="text-sm text-gray-600">Sistem autentikasi multi-faktor untuk keamanan ekstra</p>
            </div>
          </div>

          {/* Auth Section with Better Visual Integration */}
          <div className="rounded-2xl border border-white/50 bg-white/80 p-8 shadow-xl backdrop-blur-sm">
            <div className="mb-6 text-center">
              <h2 className="mb-2 text-xl font-semibold text-gray-900">Masuk ke Sistem Admin</h2>
              <p className="text-sm text-gray-600">Pilih metode autentikasi untuk melanjutkan</p>
            </div>

            <AuthStatusWrapper />

            {/* Help Text */}
            <div className="mt-6 border-t border-gray-200 pt-6 text-center">
              <p className="text-sm text-gray-500">Butuh bantuan? Hubungi tim support atau administrator sistem</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
