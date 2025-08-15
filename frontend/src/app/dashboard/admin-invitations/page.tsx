'use client'

import { useState, useEffect } from 'react'
import { AdminInvitationSystem } from '@/components/admin/AdminInvitationSystem'
import { Loader2 } from 'lucide-react'

// Force dynamic rendering and disable static optimization
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Component that contains auth-dependent content
function AdminInvitationsContent() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Management</h1>
          <p className="mt-1 text-gray-600">Manage admin invitations and user roles</p>
        </div>

        {/* Admin Invitation System */}
        <AdminInvitationSystem />
      </div>
    </div>
  )
}

export default function AdminInvitationsPage() {
  const [isMounted, setIsMounted] = useState(false)

  // Client-side mounting check
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prevent server-side rendering of auth hooks
  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return <AdminInvitationsContent />
}
