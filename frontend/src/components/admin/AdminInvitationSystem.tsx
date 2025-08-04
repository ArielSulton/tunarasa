'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, UserPlus, Send, CheckCircle, XCircle, Clock, Trash2, RefreshCw } from 'lucide-react'
import { SuperAdminOnly } from '@/components/auth/SuperAdminOnly'

interface PendingInvitation {
  id: string
  email: string
  role: 'admin' | 'superadmin'
  invitedBy: string
  invitedAt: Date
  status: 'pending' | 'accepted' | 'expired'
  expiresAt: Date
}

export function AdminInvitationSystem() {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'superadmin'>('admin')
  const [customMessage, setCustomMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [invitationStatus, setInvitationStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  // Mock pending invitations data (replace with actual API call)
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([
    {
      id: '1',
      email: 'admin2@tunarasa.com',
      role: 'admin',
      invitedBy: 'superadmin@tunarasa.com',
      invitedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      status: 'pending',
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    },
    {
      id: '2',
      email: 'admin3@tunarasa.com',
      role: 'admin',
      invitedBy: 'superadmin@tunarasa.com',
      invitedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      status: 'accepted',
      expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    },
  ])

  const handleSendInvitation = async () => {
    if (!inviteEmail) return

    setIsLoading(true)
    setInvitationStatus('idle')

    try {
      // Call API to send invitation via Resend
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          customMessage: customMessage || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send invitation')
      }

      const result = await response.json()

      // Add new invitation to pending list
      const newInvitation: PendingInvitation = {
        id: result.invitationId ?? Date.now().toString(),
        email: inviteEmail,
        role: inviteRole,
        invitedBy: 'current-user@tunarasa.com', // Get from user context
        invitedAt: new Date(),
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }

      setPendingInvitations((prev) => [newInvitation, ...prev])

      setInvitationStatus('success')
      setStatusMessage(`Invitation sent successfully to ${inviteEmail}`)

      // Reset form
      setInviteEmail('')
      setCustomMessage('')
      setInviteRole('admin')
    } catch (error) {
      setInvitationStatus('error')
      setStatusMessage('Failed to send invitation. Please try again.')
      console.error('Invitation error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/admin/invite/${invitationId}/resend`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to resend invitation')
      }

      setStatusMessage('Invitation resent successfully')
      setInvitationStatus('success')
    } catch {
      setStatusMessage('Failed to resend invitation')
      setInvitationStatus('error')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/admin/invite/${invitationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to cancel invitation')
      }

      setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId))
      setStatusMessage('Invitation cancelled successfully')
      setInvitationStatus('success')
    } catch {
      setStatusMessage('Failed to cancel invitation')
      setInvitationStatus('error')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'accepted':
        return 'bg-green-100 text-green-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <SuperAdminOnly>
      <div className="space-y-6">
        {/* Invitation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite New Admin
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invitationStatus !== 'idle' && (
              <Alert
                className={invitationStatus === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}
              >
                <AlertDescription className={invitationStatus === 'success' ? 'text-green-800' : 'text-red-800'}>
                  {statusMessage}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="admin@tunarasa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={(value: 'admin' | 'superadmin') => setInviteRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-message">Custom Message (Optional)</Label>
              <Textarea
                id="custom-message"
                placeholder="Add a personal message to the invitation email..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                onClick={() => void handleSendInvitation()}
                disabled={!inviteEmail || isLoading}
                className="min-w-32"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingInvitations.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <Mail className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <p>No pending invitations</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between rounded-lg border bg-gray-50 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(invitation.status)}
                        <Badge className={getStatusColor(invitation.status)}>{invitation.status}</Badge>
                      </div>
                      <div>
                        <div className="font-medium">{invitation.email}</div>
                        <div className="text-sm text-gray-600">
                          Role: {invitation.role} • Invited by: {invitation.invitedBy}
                        </div>
                        <div className="text-xs text-gray-500">
                          Sent: {invitation.invitedAt.toLocaleDateString()} • Expires:{' '}
                          {invitation.expiresAt.toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {invitation.status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleResendInvitation(invitation.id)}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Resend
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleCancelInvitation(invitation.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Template Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Email Template Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="mb-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Tunarasa Admin Invitation</h3>
                <p className="text-sm text-gray-600">You&apos;ve been invited to join the Tunarasa admin team</p>
              </div>

              <div className="space-y-4 text-sm">
                <p>Hello,</p>
                <p>
                  You have been invited to join the Tunarasa administration team as an <strong>{inviteRole}</strong>.
                </p>
                {customMessage && (
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-blue-800">&quot;{customMessage}&quot;</p>
                  </div>
                )}
                <p>Click the button below to accept your invitation and set up your account:</p>
                <div className="my-4">
                  <Button className="bg-blue-600 hover:bg-blue-700">Accept Invitation</Button>
                </div>
                <p className="text-xs text-gray-500">
                  This invitation will expire in 7 days. If you did not expect this invitation, please ignore this
                  email.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminOnly>
  )
}
