import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { adminInvitations, users } from '@/lib/db/schema'
import { eq, and, desc, asc, count } from 'drizzle-orm'

/**
 * List all admin invitations with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and authorization
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user has superadmin role
    const userRole = user.publicMetadata?.role as string
    if (userRole !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - Only superadmins can view invitations' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 100) // Max 100 items per page
    const status = searchParams.get('status') // pending, accepted, cancelled, expired
    const role = searchParams.get('role') // admin, superadmin
    const sortBy = searchParams.get('sortBy') ?? 'createdAt' // createdAt, updatedAt, email
    const sortOrder = searchParams.get('sortOrder') ?? 'desc' // asc, desc

    const offset = (page - 1) * limit

    // Build query conditions
    const conditions = []
    if (status) {
      conditions.push(eq(adminInvitations.status, status))
    }
    if (role) {
      conditions.push(eq(adminInvitations.role, role))
    }

    // Apply sorting
    const sortColumn = (() => {
      switch (sortBy) {
        case 'email':
          return adminInvitations.email
        case 'updatedAt':
          return adminInvitations.updatedAt
        case 'expiresAt':
          return adminInvitations.expiresAt
        case 'status':
          return adminInvitations.status
        case 'role':
          return adminInvitations.role
        default:
          return adminInvitations.createdAt
      }
    })()

    const orderByClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

    // Build complete query with all conditions
    const query = db
      .select({
        invitationId: adminInvitations.invitationId,
        email: adminInvitations.email,
        role: adminInvitations.role,
        status: adminInvitations.status,
        customMessage: adminInvitations.customMessage,
        createdAt: adminInvitations.createdAt,
        updatedAt: adminInvitations.updatedAt,
        expiresAt: adminInvitations.expiresAt,
        acceptedAt: adminInvitations.acceptedAt,
        cancelledAt: adminInvitations.cancelledAt,
        invitedBy: adminInvitations.invitedBy,
        inviterName: users.fullName, // Join to get inviter name
      })
      .from(adminInvitations)
      .leftJoin(users, eq(adminInvitations.invitedBy, users.userId))
      .$dynamic()

    // Apply filters and sorting in one chain
    const finalQuery =
      conditions.length > 0 ? query.where(and(...conditions)).orderBy(orderByClause) : query.orderBy(orderByClause)

    // Apply pagination
    const invitations = await finalQuery.limit(limit).offset(offset)

    // Get total count for pagination
    const countQueryBase = db.select({ count: count() }).from(adminInvitations)
    const totalCountResult =
      conditions.length > 0 ? await countQueryBase.where(and(...conditions)) : await countQueryBase

    const totalCount = totalCountResult[0].count

    // Calculate invitation status summary
    const statusSummary = await db
      .select({
        status: adminInvitations.status,
        count: count(),
      })
      .from(adminInvitations)
      .groupBy(adminInvitations.status)

    const statusCounts = statusSummary.reduce(
      (acc, item) => {
        acc[item.status] = item.count
        return acc
      },
      {} as Record<string, number>,
    )

    // Check for expired invitations that haven't been marked as expired
    const now = new Date()
    const expiredInvitations = invitations.filter((inv) => inv.status === 'pending' && new Date(inv.expiresAt) < now)

    return NextResponse.json({
      success: true,
      data: {
        invitations: invitations.map((inv) => ({
          ...inv,
          // Mark as expired if past expiry date
          isExpired: inv.status === 'pending' && new Date(inv.expiresAt) < now,
          // Calculate time remaining for pending invitations
          timeRemaining:
            inv.status === 'pending' ? Math.max(0, new Date(inv.expiresAt).getTime() - now.getTime()) : null,
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1,
        },
        summary: {
          total: totalCount,
          pending: statusCounts.pending ?? 0,
          accepted: statusCounts.accepted ?? 0,
          cancelled: statusCounts.cancelled ?? 0,
          expired: statusCounts.expired ?? 0,
          expiredPending: expiredInvitations.length, // Real-time expired count
        },
        filters: {
          status,
          role,
          sortBy,
          sortOrder,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('List invitations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Bulk operations on invitations
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication and authorization
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user has superadmin role
    const userRole = user.publicMetadata?.role as string
    if (userRole !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - Only superadmins can manage invitations' }, { status: 403 })
    }

    const body = await request.json()
    const { action, invitationIds } = body

    if (!action || !invitationIds || !Array.isArray(invitationIds)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const results = []

    switch (action) {
      case 'cancel':
        // Bulk cancel invitations
        for (const invitationId of invitationIds) {
          try {
            const result = await db
              .update(adminInvitations)
              .set({
                status: 'cancelled',
                cancelledAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(adminInvitations.invitationId, invitationId))
              .returning({
                invitationId: adminInvitations.invitationId,
                email: adminInvitations.email,
              })

            if (result.length > 0) {
              results.push({ invitationId, status: 'cancelled', success: true })
            } else {
              results.push({ invitationId, status: 'not_found', success: false })
            }
          } catch (err) {
            results.push({ invitationId, status: 'error', success: false, error: String(err) })
          }
        }
        break

      case 'delete':
        // Bulk delete invitations (hard delete)
        for (const invitationId of invitationIds) {
          try {
            const result = await db
              .delete(adminInvitations)
              .where(eq(adminInvitations.invitationId, invitationId))
              .returning({
                invitationId: adminInvitations.invitationId,
              })

            if (result.length > 0) {
              results.push({ invitationId, status: 'deleted', success: true })
            } else {
              results.push({ invitationId, status: 'not_found', success: false })
            }
          } catch (err) {
            results.push({ invitationId, status: 'error', success: false, error: String(err) })
          }
        }
        break

      case 'mark_expired':
        // Mark pending invitations as expired
        for (const invitationId of invitationIds) {
          try {
            const result = await db
              .update(adminInvitations)
              .set({
                status: 'expired',
                updatedAt: new Date(),
              })
              .where(and(eq(adminInvitations.invitationId, invitationId), eq(adminInvitations.status, 'pending')))
              .returning({
                invitationId: adminInvitations.invitationId,
                email: adminInvitations.email,
              })

            if (result.length > 0) {
              results.push({ invitationId, status: 'expired', success: true })
            } else {
              results.push({ invitationId, status: 'not_pending', success: false })
            }
          } catch (err) {
            results.push({ invitationId, status: 'error', success: false, error: String(err) })
          }
        }
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      data: {
        action,
        totalProcessed: invitationIds.length,
        successCount,
        failureCount,
        results,
      },
      message: `Bulk ${action} completed: ${successCount} succeeded, ${failureCount} failed`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Bulk invitation operation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
