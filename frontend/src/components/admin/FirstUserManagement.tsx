'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, User, UserCheck, Users, AlertTriangle, CheckCircle } from 'lucide-react'

interface SystemStatus {
  totalUsers: number
  hasSuperadmin: boolean
  needsFirstUserPromotion: boolean
  message: string
}

interface PromotionResult {
  success: boolean
  message: string
  user?: {
    email: string
    userId: number
    oldRoleId: number
    newRoleId: number
  }
}

export function FirstUserManagement() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [promoting, setPromoting] = useState(false)
  const [promotionResult, setPromotionResult] = useState<PromotionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/first-user-promotion')
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.statusText}`)
      }

      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch system status')
    } finally {
      setLoading(false)
    }
  }

  const promoteFirstUser = async () => {
    try {
      setPromoting(true)
      setError(null)
      setPromotionResult(null)

      const response = await fetch('/api/admin/first-user-promotion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        setPromotionResult(data)
        // Refresh status after successful promotion
        await fetchStatus()
      } else {
        setError(data.error ?? 'Failed to promote first user')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote first user')
    } finally {
      setPromoting(false)
    }
  }

  useEffect(() => {
    void fetchStatus()
  }, [])

  const getStatusIcon = () => {
    if (!status) return <Users className="h-5 w-5" />

    if (status.hasSuperadmin) {
      return <CheckCircle className="h-5 w-5 text-green-500" />
    } else if (status.needsFirstUserPromotion) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    } else {
      return <User className="h-5 w-5 text-blue-500" />
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            First User & Superadmin Management
          </CardTitle>
          <CardDescription>Manage the first user promotion to ensure system has a superadmin</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status Display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">System Status</span>
              <Button variant="outline" size="sm" onClick={() => void fetchStatus()} disabled={loading} className="h-8">
                <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground text-sm">Loading system status...</span>
              </div>
            ) : status ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Total Users:</span>
                    <Badge variant="outline" className="ml-2">
                      {status.totalUsers}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Has Superadmin:</span>
                    <Badge variant={status.hasSuperadmin ? 'default' : 'destructive'} className="ml-2">
                      {status.hasSuperadmin ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>

                <Alert variant={status.hasSuperadmin ? 'default' : 'destructive'}>
                  <AlertDescription className="text-sm">{status.message}</AlertDescription>
                </Alert>
              </div>
            ) : null}
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Promotion Result */}
          {promotionResult && (
            <Alert variant={promotionResult.success ? 'default' : 'destructive'}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p>{promotionResult.message}</p>
                  {promotionResult.user && (
                    <p className="text-muted-foreground text-xs">
                      Promoted: {promotionResult.user.email} (Role {promotionResult.user.oldRoleId} →{' '}
                      {promotionResult.user.newRoleId})
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Button */}
          {status && status.needsFirstUserPromotion && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Action Required</h4>
              <p className="text-muted-foreground text-sm">
                The system has users but no superadmin. You can promote the first registered user to superadmin.
              </p>
              <Button onClick={() => void promoteFirstUser()} disabled={promoting} className="w-full">
                {promoting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Promoting First User...
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Promote First User to Superadmin
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Info Section */}
          <div className="space-y-2 border-t pt-4">
            <h4 className="text-sm font-medium">How This Works</h4>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• The first user to sign up automatically becomes superadmin</li>
              <li>• Subsequent users get regular user role by default</li>
              <li>• Only superadmins can invite new admins</li>
              <li>• This tool helps recover if the automatic assignment failed</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-inside list-decimal space-y-2 text-sm text-gray-600">
            <li>Run diagnostics and fix any detected issues using the buttons above</li>
            <li>Have the affected user sign out completely and clear browser cookies</li>
            <li>User should sign back in and try accessing /dashboard</li>
            <li>If issues persist, check the middleware logs during the access attempt</li>
            <li>The middleware cache will automatically refresh after 2 minutes</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}

export default FirstUserManagement
