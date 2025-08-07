/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAdminAccess } from '@/components/auth/AdminOnly'
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Settings, Wrench } from 'lucide-react'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function TestRBACPage() {
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [fixResult, setFixResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { user, hasAdminAccess, roleId, isSuperAdmin, isAdmin, role } = useAdminAccess()

  const runDiagnostics = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/sync-diagnostics')
      const data = await response.json()
      setDiagnostics(data)
    } catch (error) {
      console.error('Diagnostics failed:', error)
      setDiagnostics({ error: 'Failed to run diagnostics' })
    }
    setLoading(false)
  }

  const runFix = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/auth-fix', { method: 'POST' })
      const data = await response.json()
      setFixResult(data)

      // Refresh the page after successful fix
      if (data.success) {
        setTimeout(() => window.location.reload(), 2000)
      }
    } catch (error) {
      console.error('Fix failed:', error)
      setFixResult({ error: 'Failed to run fix' })
    }
    setLoading(false)
  }

  const StatusIcon = ({ success }: { success: boolean }) =>
    success ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">RBAC Testing & Diagnostics</h1>
          <p className="mt-2 text-gray-600">Test and fix role-based access control issues</p>
        </div>
        {/* Current User Status */}
        <Card>
          <CardHeader>
            <CardTitle>Current User Status</CardTitle>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Email:</span>
                    <p className="font-mono">{user.email}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Role ID:</span>
                    <p className="font-mono">{roleId}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Role Name:</span>
                    <p className="font-mono capitalize">{user.role?.roleName ?? 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Active:</span>
                    <Badge variant={user.isActive ? 'default' : 'destructive'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={hasAdminAccess ? 'default' : 'secondary'}>
                    Admin Access: {hasAdminAccess ? 'Yes' : 'No'}
                  </Badge>
                  <Badge variant={isSuperAdmin ? 'default' : 'secondary'}>
                    Super Admin: {isSuperAdmin ? 'Yes' : 'No'}
                  </Badge>
                  <Badge variant={isAdmin ? 'default' : 'secondary'}>Admin: {isAdmin ? 'Yes' : 'No'}</Badge>
                </div>

                {/* Issue Detection */}
                {roleId === 1 && role !== 'superadmin' && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertCircle className="h-5 w-5" />
                      <p className="font-medium">🚨 Authentication Issue Detected!</p>
                    </div>
                    <p className="mt-1 text-sm text-red-700">
                      You have <code>role_id = 1</code> (SuperAdmin) but role shows as &quot;<strong>{role}</strong>
                      &quot;. This indicates the role relationship in the database is broken.
                    </p>
                    <p className="mt-2 text-xs text-red-600">
                      ➡️ Use the &quot;Fix Auth Issues&quot; button below to resolve this automatically.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600">No user data available</p>
            )}
          </CardContent>
        </Card>

        {/* Auth Diagnostics & Fix */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Authentication Diagnostics & Fix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button onClick={() => void runDiagnostics()} disabled={loading}>
                {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                Run Diagnostics
              </Button>
              <Button onClick={() => void runFix()} variant="outline" disabled={loading}>
                {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
                Fix Auth Issues
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Diagnostics Results */}
        {diagnostics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Diagnostics Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded bg-gray-50 p-4 text-sm whitespace-pre-wrap">
                {JSON.stringify(diagnostics, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Fix Results */}
        {fixResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {fixResult.success ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Fix Completed Successfully
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    Fix Failed
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fixResult.success && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="font-medium text-green-800">✅ {fixResult.message}</p>
                    <p className="mt-1 text-sm text-green-700">Page will refresh in 2 seconds to apply changes.</p>
                  </div>
                )}

                {fixResult.fixes && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Fix Steps:</h4>
                    {fixResult.fixes.map((fix: any, index: number) => (
                      <div key={index} className="flex items-center gap-2 rounded bg-gray-50 p-2">
                        <StatusIcon success={fix.success} />
                        <span className="text-sm">
                          {fix.step}. {fix.action}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <pre className="overflow-auto rounded bg-gray-50 p-4 text-sm whitespace-pre-wrap">
                  {JSON.stringify(fixResult, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-2 text-sm">
              <li>Click &quot;Run Diagnostics&quot; to identify the specific issue</li>
              <li>Click &quot;Fix Auth Issues&quot; to automatically resolve database problems</li>
              <li>
                Try accessing the admin dashboard at <code>/dashboard</code>
              </li>
              <li>If issues persist, check the server logs for detailed error messages</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
