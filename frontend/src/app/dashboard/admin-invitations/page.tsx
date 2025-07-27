'use client'

import { AdminInvitationSystem } from '@/components/admin/AdminInvitationSystem'

export default function AdminInvitationsPage() {
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
