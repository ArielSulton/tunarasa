import { NextRequest, NextResponse } from 'next/server'
import { promoteFirstUserToSuperadmin, hasSuperadmin, getTotalUserCount } from '@/lib/services/role-management'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(_request: NextRequest) {
  try {
    // Get user from auth
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check if user is already a superadmin (if superadmins exist)
    const hasExistingSuperadmin = await hasSuperadmin()
    if (hasExistingSuperadmin) {
      // If superadmins exist, verify the current user is one of them using Drizzle ORM
      const currentUserResults = await db
        .select({
          role_id: users.roleId,
        })
        .from(users)
        .where(eq(users.supabaseUserId, user.id))
        .limit(1)

      const currentUser = currentUserResults[0]

      if (!currentUser || currentUser.role_id !== 1) {
        return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
      }
    }

    // Attempt to promote first user
    const result = await promoteFirstUserToSuperadmin()

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: result.message,
          user: result.user,
        },
        { status: 200 },
      )
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error('Error in first user promotion API:', error)
    return NextResponse.json({ error: 'Failed to promote first user' }, { status: 500 })
  }
}

export async function GET(_request: NextRequest) {
  try {
    // Get system status for first user promotion
    const totalUsers = await getTotalUserCount()
    const hasExistingSuperadmin = await hasSuperadmin()

    return NextResponse.json(
      {
        totalUsers,
        hasSuperadmin: hasExistingSuperadmin,
        needsFirstUserPromotion: totalUsers > 0 && !hasExistingSuperadmin,
        message:
          totalUsers === 0
            ? 'No users in system yet - first signup will become superadmin automatically'
            : hasExistingSuperadmin
              ? 'System has superadmin - no promotion needed'
              : 'System needs first user promotion to superadmin',
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error checking first user promotion status:', error)
    return NextResponse.json({ error: 'Failed to check system status' }, { status: 500 })
  }
}
