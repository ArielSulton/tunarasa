'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  // BarChart3,
  ExternalLink,
  UserPlus,
  Send,
  CheckCircle,
  XCircle,
  RefreshCw,
  Crown,
  Shield,
  AlertCircle,
  Loader2,
  Activity,
} from 'lucide-react'
import { SuperAdminOnly, useUserRole } from '@/components/auth/SuperAdminOnly'
import { AdminOnly } from '@/components/auth/AdminOnly'

// Force dynamic rendering to prevent build-time auth evaluation
export const dynamic = 'force-dynamic'

interface AdminUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  role: 'admin' | 'superadmin'
  status: 'active' | 'inactive'
  lastActive: string | Date | null
  createdAt: string | Date
  invitedBy?: string
}

interface PendingInvitation {
  id: string
  email: string
  role: 'admin' | 'superadmin'
  invitedBy: string
  invitedAt: string | Date
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  expiresAt: string | Date
  customMessage?: string
}

function DashboardContent() {
  const { role: _role } = useUserRole()
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [_pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invitation form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'superadmin'>('admin')
  const [customMessage, setCustomMessage] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [invitationStatus, setInvitationStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  // Fetch admin users and invitations
  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch current admins
      const adminsResponse = await fetch('/api/admin/users')
      if (adminsResponse.ok) {
        const adminsData = await adminsResponse.json()
        if (adminsData.success && adminsData.data) {
          setAdmins(adminsData.data.users ?? [])
        }
      }

      // Fetch pending invitations
      const invitationsResponse = await fetch('/api/admin/invitations')
      if (invitationsResponse.ok) {
        const invitationsData = await invitationsResponse.json()
        if (invitationsData.success && invitationsData.data) {
          setPendingInvitations(invitationsData.data.invitations ?? [])
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch admin data'
      setError(errorMessage)
      console.error('Admin data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAdminData()
  }, [fetchAdminData])

  const handleSendInvitation = async () => {
    if (!inviteEmail) return

    setIsInviting(true)
    setInvitationStatus('idle')

    try {
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
        const errorData = await response.json()
        throw new Error(errorData.error ?? 'Failed to send invitation')
      }

      const _result = await response.json()

      setInvitationStatus('success')
      setStatusMessage(`Invitation sent successfully to ${inviteEmail}`)

      // Reset form
      setInviteEmail('')
      setCustomMessage('')
      setInviteRole('admin')
      setInviteDialogOpen(false)

      // Refresh data
      await fetchAdminData()
    } catch (error) {
      setInvitationStatus('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to send invitation. Please try again.')
      console.error('Invitation error:', error)
    } finally {
      setIsInviting(false)
    }
  }

  const _handleResendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/admin/invite/${invitationId}/resend`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to resend invitation')
      }

      setStatusMessage('Invitation resent successfully')
      setInvitationStatus('success')
      await fetchAdminData()
    } catch {
      setStatusMessage('Failed to resend invitation')
      setInvitationStatus('error')
    }
  }

  const _handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/admin/invite/${invitationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to cancel invitation')
      }

      setStatusMessage('Invitation cancelled successfully')
      setInvitationStatus('success')
      await fetchAdminData()
    } catch {
      setStatusMessage('Failed to cancel invitation')
      setInvitationStatus('error')
    }
  }

  const getRoleIcon = (userRole: string) => {
    return userRole === 'superadmin' ? (
      <Crown className="h-4 w-4 text-amber-600" />
    ) : (
      <Shield className="h-4 w-4 text-blue-600" />
    )
  }

  const getRoleBadge = (userRole: string) => {
    return userRole === 'superadmin' ? (
      <Badge variant="secondary" className="border-amber-200 bg-amber-50 text-amber-700">
        <Crown className="mr-1 h-3 w-3" />
        Super Admin
      </Badge>
    ) : (
      <Badge variant="secondary" className="border-blue-200 bg-blue-50 text-blue-700">
        <Shield className="mr-1 h-3 w-3" />
        Admin
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    return status === 'active' ? (
      <Badge variant="secondary" className="border-green-200 bg-green-50 text-green-700">
        <CheckCircle className="mr-1 h-3 w-3" />
        Active
      </Badge>
    ) : (
      <Badge variant="secondary" className="border-gray-200 bg-gray-50 text-gray-700">
        <XCircle className="mr-1 h-3 w-3" />
        Inactive
      </Badge>
    )
  }

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'Never'
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return 'Invalid date'
    }
  }

  const formatLastActive = (date: string | Date | null) => {
    if (!date) return 'Never'
    try {
      const now = new Date()
      const lastActive = new Date(date)
      const diffInMs = now.getTime() - lastActive.getTime()
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

      if (diffInDays === 0) {
        return 'Today'
      } else if (diffInDays === 1) {
        return '1 day ago'
      } else if (diffInDays < 7) {
        return `${diffInDays} days ago`
      } else {
        return formatDate(date)
      }
    } catch {
      return 'Unknown'
    }
  }

  if (loading) {
    return (
      <div className="bg-background min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <span className="text-muted-foreground ml-3 text-lg font-medium">Loading dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">Manage administrators and monitor system health</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => void fetchAdminData()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {invitationStatus !== 'idle' && (
          <Alert variant={invitationStatus === 'success' ? 'default' : 'destructive'}>
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        )}

        {/* Main Content - Clean Grid Layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Grafana Link Card - Prominent */}
          <Card className="lg:col-span-1">
            <CardContent className="p-6">
              <div className="space-y-4 text-center">
                <div className="bg-primary/10 mx-auto flex h-14 w-14 items-center justify-center rounded-full">
                  <Activity className="text-primary h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Monitoring</h3>
                  <p className="text-muted-foreground mt-1 text-sm">Advanced analytics & system metrics</p>
                </div>
                <Button className="w-full" asChild>
                  <a
                    href="http://localhost:3030"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Grafana
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Admin Management Actions */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="text-primary h-5 w-5" />
                    Administrator Management
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {admins.length} administrator{admins.length !== 1 ? 's' : ''} currently active
                  </p>
                </div>
                <SuperAdminOnly>
                  <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite Admin
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Invite New Administrator</DialogTitle>
                        <DialogDescription>
                          Send an invitation email to add a new administrator to the system.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
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
                            <Select
                              value={inviteRole}
                              onValueChange={(value: 'admin' | 'superadmin') => setInviteRole(value)}
                            >
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
                          <Button variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={isInviting}>
                            Cancel
                          </Button>
                          <Button onClick={() => void handleSendInvitation()} disabled={!inviteEmail || isInviting}>
                            {isInviting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                      </div>
                    </DialogContent>
                  </Dialog>
                </SuperAdminOnly>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Admin Management Table - Clean & Focused */}
        <Card>
          <CardHeader>
            <CardTitle>Current Administrators</CardTitle>
            <p className="text-muted-foreground text-sm">
              All system administrators with their roles, status, and activity information
            </p>
          </CardHeader>
          <CardContent>
            {admins.length === 0 ? (
              <div className="py-12 text-center">
                <Shield className="text-muted-foreground/40 mx-auto mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-semibold">No administrators found</h3>
                <p className="text-muted-foreground">There are no administrators configured in the system.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Name</TableHead>
                      <TableHead className="w-[280px]">Email</TableHead>
                      <TableHead className="w-[140px]">Role</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[130px]">Last Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.map((admin) => (
                      <TableRow key={admin.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {getRoleIcon(admin.role)}
                            <div>
                              <div className="font-medium">
                                {admin.fullName ??
                                  (`${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() || 'Unnamed User')}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm">{admin.email}</div>
                        </TableCell>
                        <TableCell>{getRoleBadge(admin.role)}</TableCell>
                        <TableCell>{getStatusBadge(admin.status)}</TableCell>
                        <TableCell>
                          <div className="text-muted-foreground text-sm">{formatLastActive(admin.lastActive)}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Wrap the dashboard with AdminOnly protection
export default function AdminDashboard() {
  return (
    <AdminOnly>
      <DashboardContent />
    </AdminOnly>
  )
}
