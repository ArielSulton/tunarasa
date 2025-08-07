import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/supabase-auth'
import { db } from '@/lib/db'
import { users, roles } from '@/lib/db/schema'
import { eq, and, desc, asc, count, or, ilike } from 'drizzle-orm'

/**
 * List all admin users with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and authorization - require admin access
    await requireAdmin()

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100) // Max 100 items per page
    const status = searchParams.get('status') // active, inactive
    const role = searchParams.get('role') // admin, superadmin
    const search = searchParams.get('search') // Search by name or email
    const sortBy = searchParams.get('sortBy') ?? 'createdAt' // createdAt, lastSignInAt, email, fullName
    const sortOrder = searchParams.get('sortOrder') ?? 'desc' // asc, desc

    const offset = (page - 1) * limit

    // Build query conditions
    const conditions = []

    // Filter by admin/superadmin roles only (roleId 1 = superadmin, roleId 2 = admin)
    conditions.push(or(eq(users.roleId, 1), eq(users.roleId, 2)))

    if (status) {
      conditions.push(eq(users.isActive, status === 'active'))
    }

    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.fullName, `%${search}%`),
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
        ),
      )
    }

    // If filtering by role, convert to roleId
    if (role) {
      const roleId = role === 'superadmin' ? 1 : role === 'admin' ? 2 : null
      if (roleId) {
        conditions.push(eq(users.roleId, roleId))
      }
    }

    // Apply sorting
    const sortColumn = (() => {
      switch (sortBy) {
        case 'email':
          return users.email
        case 'fullName':
          return users.fullName
        case 'lastSignInAt':
          return users.lastSignInAt
        case 'updatedAt':
          return users.updatedAt
        default:
          return users.createdAt
      }
    })()

    const orderByClause = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

    // Build complete query with all conditions
    const query = db
      .select({
        userId: users.userId,
        supabaseUserId: users.supabaseUserId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        fullName: users.fullName,
        imageUrl: users.imageUrl,
        roleId: users.roleId,
        roleName: roles.roleName,
        isActive: users.isActive,
        lastSignInAt: users.lastSignInAt,
        emailVerified: users.emailVerified,
        invitedBy: users.invitedBy,
        invitedAt: users.invitedAt,
        invitationAcceptedAt: users.invitationAcceptedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.roleId))
      .$dynamic()

    // Apply filters and sorting in one chain
    const finalQuery =
      conditions.length > 0 ? query.where(and(...conditions)).orderBy(orderByClause) : query.orderBy(orderByClause)

    // Apply pagination
    const adminUsers = await finalQuery.limit(limit).offset(offset)

    // Get total count for pagination
    const countQueryBase = db.select({ count: count() }).from(users).leftJoin(roles, eq(users.roleId, roles.roleId))
    const totalCountResult =
      conditions.length > 0 ? await countQueryBase.where(and(...conditions)) : await countQueryBase

    const totalCount = totalCountResult[0].count

    // Calculate role distribution summary
    const roleSummary = await db
      .select({
        roleId: users.roleId,
        roleName: roles.roleName,
        count: count(),
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.roleId))
      .where(or(eq(users.roleId, 1), eq(users.roleId, 2))) // Only admin roles
      .groupBy(users.roleId, roles.roleName)

    const roleCounts = roleSummary.reduce(
      (acc, item) => {
        const roleKey = item.roleName?.toLowerCase() ?? 'unknown'
        acc[roleKey] = item.count
        return acc
      },
      {} as Record<string, number>,
    )

    // Calculate status summary
    const statusSummary = await db
      .select({
        isActive: users.isActive,
        count: count(),
      })
      .from(users)
      .where(or(eq(users.roleId, 1), eq(users.roleId, 2))) // Only admin roles
      .groupBy(users.isActive)

    const statusCounts = statusSummary.reduce(
      (acc, item) => {
        const statusKey = item.isActive ? 'active' : 'inactive'
        acc[statusKey] = item.count
        return acc
      },
      {} as Record<string, number>,
    )

    // Transform data for frontend
    const transformedUsers = adminUsers.map((user) => ({
      id: user.userId.toString(),
      supabaseUserId: user.supabaseUserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      imageUrl: user.imageUrl,
      role: user.roleName?.toLowerCase() === 'superadmin' ? 'superadmin' : 'admin',
      status: user.isActive ? 'active' : 'inactive',
      lastActive: user.lastSignInAt ? new Date(user.lastSignInAt) : null,
      emailVerified: user.emailVerified,
      invitedBy: user.invitedBy,
      invitedAt: user.invitedAt ? new Date(user.invitedAt) : null,
      invitationAcceptedAt: user.invitationAcceptedAt ? new Date(user.invitationAcceptedAt) : null,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
    }))

    return NextResponse.json({
      success: true,
      data: {
        users: transformedUsers,
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
          superadmin: roleCounts.superadmin ?? 0,
          admin: roleCounts.admin ?? 0,
          active: statusCounts.active ?? 0,
          inactive: statusCounts.inactive ?? 0,
        },
        filters: {
          status,
          role,
          search,
          sortBy,
          sortOrder,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('List admin users error:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Update admin user status or role (SuperAdmin only for role changes)
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication and authorization - require admin access
    const currentUser = await requireAdmin()

    const body = await request.json()
    const { userId, action, ...updateData } = body

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing required fields: userId, action' }, { status: 400 })
    }

    let result

    switch (action) {
      case 'activate':
        result = await db
          .update(users)
          .set({
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(users.userId, userId))
          .returning({
            userId: users.userId,
            email: users.email,
            isActive: users.isActive,
          })
        break

      case 'deactivate':
        result = await db
          .update(users)
          .set({
            isActive: false,
            updatedAt: new Date(),
          })
          .where(eq(users.userId, userId))
          .returning({
            userId: users.userId,
            email: users.email,
            isActive: users.isActive,
          })
        break

      case 'update_role':
        // Only superadmin can change roles
        if (currentUser.role !== 'superadmin') {
          return NextResponse.json(
            { error: 'Forbidden - Superadmin access required for role changes' },
            { status: 403 },
          )
        }

        const { role } = updateData
        if (!role || !['admin', 'superadmin'].includes(role)) {
          return NextResponse.json({ error: 'Invalid role. Must be admin or superadmin' }, { status: 400 })
        }

        const roleId = role === 'superadmin' ? 1 : 2

        result = await db
          .update(users)
          .set({
            roleId,
            updatedAt: new Date(),
          })
          .where(eq(users.userId, userId))
          .returning({
            userId: users.userId,
            email: users.email,
            roleId: users.roleId,
          })
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        action,
        user: result[0],
      },
      message: `User ${action} completed successfully`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Update admin user error:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
