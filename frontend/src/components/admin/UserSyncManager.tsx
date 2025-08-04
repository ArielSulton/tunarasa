'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  RefreshCw,
  Users,
  UserPlus,
  UserMinus,
  Database,
  CheckCircle,
  AlertTriangle,
  Info,
  Loader2,
  Download,
} from 'lucide-react'

interface SyncStatistics {
  totalUsers: number
  missingUsers: number
  orphanedUsers: number
  syncStats: Record<string, number>
  lastSyncAt: string | null
}

interface SyncResult {
  success: boolean
  data?: Record<string, unknown>
  message?: string
}

export function UserSyncManager() {
  const [statistics, setStatistics] = useState<SyncStatistics | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  // Load statistics on component mount
  useEffect(() => {
    void loadStatistics()
  }, [])

  const loadStatistics = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/sync-users?action=statistics')
      const result = await response.json()

      if (result.success) {
        setStatistics(result.data)
      } else {
        setMessage({ type: 'error', text: 'Failed to load sync statistics' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Error loading statistics' })
    } finally {
      setLoading(false)
    }
  }

  const performSync = async (action: string, userId?: string) => {
    setSyncLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/sync-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, userId }),
      })

      const result: SyncResult = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: result.message ?? 'Sync completed successfully' })
        await loadStatistics() // Reload statistics
      } else {
        setMessage({ type: 'error', text: result.message ?? 'Sync failed' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Error performing sync operation' })
    } finally {
      setSyncLoading(false)
    }
  }

  const initializeDatabase = async () => {
    setSyncLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/init-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'full-init' }),
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: result.message ?? 'Database initialized successfully' })
        await loadStatistics()
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Database initialization failed' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Error initializing database' })
    } finally {
      setSyncLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'retry':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSyncHealthScore = () => {
    if (!statistics) return 0

    const total = statistics.totalUsers
    const issues = statistics.missingUsers + statistics.orphanedUsers

    if (total === 0) return 100
    return Math.max(0, Math.round(((total - issues) / total) * 100))
  }

  const healthScore = getSyncHealthScore()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Synchronization</h2>
          <p className="text-gray-600">Manage Clerk ↔ Supabase user data synchronization</p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadStatistics()}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Messages */}
      {message && (
        <Alert
          className={
            message.type === 'success'
              ? 'border-green-200 bg-green-50'
              : message.type === 'error'
                ? 'border-red-200 bg-red-50'
                : 'border-blue-200 bg-blue-50'
          }
        >
          {message.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
          {message.type === 'error' && <AlertTriangle className="h-4 w-4 text-red-600" />}
          {message.type === 'info' && <Info className="h-4 w-4 text-blue-600" />}
          <AlertDescription
            className={
              message.type === 'success'
                ? 'text-green-800'
                : message.type === 'error'
                  ? 'text-red-800'
                  : 'text-blue-800'
            }
          >
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Sync Health Overview */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sync Health</CardTitle>
            <Database className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthScore}%</div>
            <div className="mt-2">
              <Progress value={healthScore} className="h-2" />
            </div>
            <div className="mt-2 text-xs text-gray-600">
              {healthScore >= 95 ? 'Excellent' : healthScore >= 80 ? 'Good' : healthScore >= 60 ? 'Fair' : 'Poor'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.totalUsers ?? 0}</div>
            <div className="text-xs text-gray-600">Active users in database</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {(statistics?.missingUsers ?? 0) + (statistics?.orphanedUsers ?? 0)}
            </div>
            <div className="text-xs text-gray-600">Missing + orphaned users</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Sync Issues */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserMinus className="h-5 w-5 text-red-600" />
                Sync Issues
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                <div>
                  <div className="font-medium text-red-900">Missing Users</div>
                  <div className="text-sm text-red-700">Users in Clerk but not in Supabase</div>
                </div>
                <Badge className="bg-red-100 text-red-800">{statistics.missingUsers}</Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-orange-50 p-3">
                <div>
                  <div className="font-medium text-orange-900">Orphaned Users</div>
                  <div className="text-sm text-orange-700">Users in Supabase but not in Clerk</div>
                </div>
                <Badge className="bg-orange-100 text-orange-800">{statistics.orphanedUsers}</Badge>
              </div>

              <Separator />

              <div className="space-y-2">
                <Button
                  onClick={() => void performSync('sync-missing')}
                  disabled={syncLoading || statistics.missingUsers === 0}
                  className="w-full"
                  variant="outline"
                >
                  {syncLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Sync Missing Users ({statistics.missingUsers})
                </Button>

                <Button
                  onClick={() => void performSync('cleanup-orphaned')}
                  disabled={syncLoading || statistics.orphanedUsers === 0}
                  className="w-full"
                  variant="outline"
                >
                  {syncLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserMinus className="mr-2 h-4 w-4" />
                  )}
                  Cleanup Orphaned Users ({statistics.orphanedUsers})
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sync Operations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-600" />
                Sync Operations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Button onClick={() => void performSync('sync-all')} disabled={syncLoading} className="w-full">
                  {syncLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Full Sync (All Users)
                </Button>

                <Button
                  onClick={() => void initializeDatabase()}
                  disabled={syncLoading}
                  className="w-full"
                  variant="outline"
                >
                  {syncLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="mr-2 h-4 w-4" />
                  )}
                  Initialize Database
                </Button>
              </div>

              <Separator />

              {/* Recent Sync Status */}
              <div>
                <h4 className="mb-3 font-medium">Recent Sync Status</h4>
                <div className="space-y-2">
                  {Object.entries(statistics.syncStats).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(status)}>{status}</Badge>
                      </div>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {statistics.lastSyncAt && (
                <div className="text-xs text-gray-600">
                  Last sync: {new Date(statistics.lastSyncAt).toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Button
              variant="outline"
              onClick={() => window.open('/api/admin/sync-users?action=missing', '_blank')}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              View Missing Users
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/api/admin/sync-users?action=orphaned', '_blank')}
              className="flex items-center gap-2"
            >
              <UserMinus className="h-4 w-4" />
              View Orphaned Users
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/api/admin/sync-users?action=statistics', '_blank')}
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              View Full Stats
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
