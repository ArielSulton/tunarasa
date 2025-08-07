'use client'

import { AdminOnly } from './AdminOnly'

interface AdminLayoutProps {
  children: React.ReactNode
  requireSuperAdmin?: boolean
  title?: string
  description?: string
}

/**
 * Admin Layout Component
 * Provides consistent layout and protection for admin pages
 */
export function AdminLayout({
  children,
  requireSuperAdmin = false,
  title = 'Admin Dashboard',
  description = 'Administrative interface for Tunarasa system',
}: AdminLayoutProps) {
  return (
    <AdminOnly requireSuperAdmin={requireSuperAdmin}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="border-b bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </AdminOnly>
  )
}

/**
 * Simple Admin Wrapper - just protection without layout
 */
export function AdminWrapper({
  children,
  requireSuperAdmin = false,
}: {
  children: React.ReactNode
  requireSuperAdmin?: boolean
}) {
  return <AdminOnly requireSuperAdmin={requireSuperAdmin}>{children}</AdminOnly>
}
