import { db } from '@/lib/db'
import { users, userSyncLog, roles } from '@/lib/db/schema'
import { eq, count, and, gte, isNull } from 'drizzle-orm'
import { createServerClient } from '@supabase/ssr'

interface DiagnosticResult {
  status: 'healthy' | 'warning' | 'critical'
  issues: Array<{
    type: 'error' | 'warning' | 'info'
    message: string
    details?: unknown
  }>
  stats: {
    totalUsers: number
    syncFailures24h: number
    averageSyncTime: number
    roleDistribution: Record<string, number>
  }
  recommendations: string[]
}

/**
 * Run comprehensive sync diagnostics
 */
export async function runSyncDiagnostics(targetUserId?: string): Promise<DiagnosticResult> {
  const issues: DiagnosticResult['issues'] = []
  const recommendations: string[] = []

  try {
    // Initialize stats
    const stats = {
      totalUsers: 0,
      syncFailures24h: 0,
      averageSyncTime: 0,
      roleDistribution: {} as Record<string, number>,
    }

    // Check database connectivity
    try {
      await db.select({ count: count() }).from(users).limit(1)
    } catch (error) {
      issues.push({
        type: 'error',
        message: 'Database connectivity issue',
        details: error instanceof Error ? error.message : String(error),
      })
    }

    // Check Supabase auth connectivity
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            getAll() {
              return []
            },
            setAll() {},
          },
        },
      )

      if (targetUserId) {
        const { data: _data, error } = await supabase.auth.admin.getUserById(targetUserId)
        if (error) {
          issues.push({
            type: 'warning',
            message: `Supabase auth user not found: ${targetUserId}`,
            details: error.message,
          })
        }
      }
    } catch (error) {
      issues.push({
        type: 'error',
        message: 'Supabase auth connectivity issue',
        details: error instanceof Error ? error.message : String(error),
      })
    }

    // Get total user count
    const userCountResult = await db.select({ count: count() }).from(users)
    stats.totalUsers = userCountResult[0]?.count || 0

    // Check for role consistency
    const roleCheck = await db
      .select({
        roleId: users.roleId,
        roleName: roles.roleName,
        userCount: count(),
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.roleId))
      .groupBy(users.roleId, roles.roleName)

    for (const role of roleCheck) {
      if (!role.roleName) {
        issues.push({
          type: 'error',
          message: `Users with invalid role_id: ${role.roleId}`,
          details: `${role.userCount} users affected`,
        })
      } else {
        stats.roleDistribution[role.roleName] = role.userCount
      }
    }

    // Check for sync failures in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentFailures = await db
      .select({ count: count() })
      .from(userSyncLog)
      .where(and(eq(userSyncLog.syncStatus, 'failed'), gte(userSyncLog.createdAt, oneDayAgo)))

    stats.syncFailures24h = recentFailures[0]?.count || 0

    // Check for users without sync records
    const usersWithoutSync = await db
      .select({
        userId: users.userId,
        supabaseUserId: users.supabaseUserId,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(userSyncLog, eq(users.supabaseUserId, userSyncLog.supabaseUserId))
      .where(isNull(userSyncLog.supabaseUserId))
      .limit(10)

    if (usersWithoutSync.length > 0) {
      issues.push({
        type: 'warning',
        message: `${usersWithoutSync.length} users have no sync records`,
        details: usersWithoutSync.map((u) => ({ email: u.email, created: u.createdAt })),
      })
      recommendations.push('Consider running manual sync for users without sync records')
    }

    // Check for duplicate users
    const duplicateEmails = await db
      .select({
        email: users.email,
        count: count(),
      })
      .from(users)
      .groupBy(users.email)
      .having(({ count }) => gte(count, 2))

    if (duplicateEmails.length > 0) {
      issues.push({
        type: 'error',
        message: `${duplicateEmails.length} duplicate email addresses found`,
        details: duplicateEmails,
      })
      recommendations.push('Remove duplicate user records')
    }

    // Check for orphaned sync logs
    const orphanedLogs = await db
      .select({ count: count() })
      .from(userSyncLog)
      .leftJoin(users, eq(userSyncLog.supabaseUserId, users.supabaseUserId))
      .where(isNull(users.supabaseUserId))

    const orphanedCount = orphanedLogs[0]?.count || 0
    if (orphanedCount > 0) {
      issues.push({
        type: 'warning',
        message: `${orphanedCount} orphaned sync log entries`,
        details: 'Sync logs exist for users not in users table',
      })
      recommendations.push('Clean up orphaned sync log entries')
    }

    // Check environment variables
    const requiredEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL']

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push({
          type: 'error',
          message: `Missing environment variable: ${envVar}`,
        })
      }
    }

    // Performance recommendations
    if (stats.totalUsers > 1000 && stats.syncFailures24h > 50) {
      recommendations.push('Consider implementing sync batching for large user base')
    }

    if (stats.syncFailures24h > 10) {
      recommendations.push('Review sync error patterns and implement better retry logic')
    }

    if (!stats.roleDistribution['superadmin']) {
      issues.push({
        type: 'error',
        message: 'No superadmin users found in system',
      })
      recommendations.push('Promote at least one user to superadmin role')
    }

    // Determine overall status
    let status: DiagnosticResult['status'] = 'healthy'

    const errorCount = issues.filter((i) => i.type === 'error').length
    const warningCount = issues.filter((i) => i.type === 'warning').length

    if (errorCount > 0) {
      status = 'critical'
    } else if (warningCount > 2 || stats.syncFailures24h > 20) {
      status = 'warning'
    }

    return {
      status,
      issues,
      stats,
      recommendations: [...new Set(recommendations)], // Remove duplicates
    }
  } catch (error) {
    return {
      status: 'critical',
      issues: [
        {
          type: 'error',
          message: 'Diagnostic check failed',
          details: error instanceof Error ? error.message : String(error),
        },
      ],
      stats: {
        totalUsers: 0,
        syncFailures24h: 0,
        averageSyncTime: 0,
        roleDistribution: {},
      },
      recommendations: ['Fix diagnostic system errors before proceeding'],
    }
  }
}
