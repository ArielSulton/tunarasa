/**
 * Unauthorized Access Page
 * Shown when users try to access admin-only areas without proper permissions
 */

'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BuildSafeAuthStatus } from '@/components/auth/BuildSafeAuthStatus'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function UnauthorizedPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-6 text-center">
        <div className="space-y-4">
          <h1 className="text-destructive text-4xl font-bold">403</h1>
          <h2 className="text-2xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            You don&apos;t have permission to access this area. Admin privileges are required.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-center">
            <BuildSafeAuthStatus />
          </div>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/">Go Home</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </div>

        <div className="text-muted-foreground text-sm">
          If you believe this is an error, please contact your administrator.
        </div>
      </div>
    </div>
  )
}
