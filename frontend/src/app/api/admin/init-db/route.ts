import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { users, roles, genders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { initializeDefaultRoles } from '@/lib/services/role-management'

/**
 * Database Initialization API Endpoint
 *
 * Initializes the database with default roles and genders.
 * Creates the first superadmin user if no users exist.
 * This endpoint can only be accessed by authenticated users.
 */

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    const body = (await request.json()) as { action: string; force?: boolean }
    const { action, force = false } = body

    switch (action) {
      case 'init-roles':
        const rolesCreated = await initializeDefaultRoles()
        return NextResponse.json({
          success: true,
          message: rolesCreated ? 'Default roles created successfully' : 'Default roles already exist',
          created: rolesCreated,
        })

      case 'init-genders':
        const gendersCreated = await initializeDefaultGenders()
        return NextResponse.json({
          success: true,
          message: gendersCreated ? 'Default genders created successfully' : 'Default genders already exist',
          created: gendersCreated,
        })

      case 'init-first-admin':
        const adminResult = await initializeFirstSuperAdmin(user.id, force)
        return NextResponse.json(adminResult)

      case 'full-init':
        // Initialize everything
        const results = {
          roles: await initializeDefaultRoles(),
          genders: await initializeDefaultGenders(),
          admin: await initializeFirstSuperAdmin(user.id, force),
        }

        return NextResponse.json({
          success: true,
          message: 'Database initialization completed',
          results,
        })

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Database initialization error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check authentication
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Get database status
    const [rolesCount, gendersCount, usersCount] = await Promise.all([
      db.select().from(roles),
      db.select().from(genders),
      db.select().from(users),
    ])

    const hasSuperAdmin = usersCount.some((u) => u.roleId === 1)

    return NextResponse.json({
      success: true,
      status: {
        roles: {
          count: rolesCount.length,
          initialized: rolesCount.length > 0,
        },
        genders: {
          count: gendersCount.length,
          initialized: gendersCount.length > 0,
        },
        users: {
          count: usersCount.length,
          hasSuperAdmin,
        },
        needsInitialization: rolesCount.length === 0 || gendersCount.length === 0 || !hasSuperAdmin,
      },
    })
  } catch (error) {
    console.error('Database status check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Initialize default genders
 */
async function initializeDefaultGenders(): Promise<boolean> {
  try {
    const existingGenders = await db.select().from(genders)

    if (existingGenders.length === 0) {
      await db.insert(genders).values([
        {
          genderId: 1,
          genderName: 'Male',
        },
        {
          genderId: 2,
          genderName: 'Female',
        },
        {
          genderId: 3,
          genderName: 'Non-binary',
        },
        {
          genderId: 4,
          genderName: 'Prefer not to say',
        },
      ])

      console.log('Default genders initialized successfully')
      return true
    }

    return false
  } catch (error) {
    console.error('Error initializing default genders:', error)
    return false
  }
}

/**
 * Initialize the first superadmin user
 */
async function initializeFirstSuperAdmin(clerkUserId: string, force: boolean = false) {
  try {
    // Check if any superadmin exists
    const existingSuperAdmin = await db.select().from(users).where(eq(users.roleId, 1)).limit(1)

    if (existingSuperAdmin.length > 0 && !force) {
      return {
        success: true,
        message: 'SuperAdmin already exists',
        created: false,
        superAdminEmail: existingSuperAdmin[0].email,
      }
    }

    // Check if current user exists in database
    const existingUser = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1)

    if (existingUser.length > 0) {
      // Update existing user to superadmin
      await db
        .update(users)
        .set({
          roleId: 1, // Superadmin role
          updatedAt: new Date(),
        })
        .where(eq(users.clerkUserId, clerkUserId))

      return {
        success: true,
        message: 'Existing user promoted to SuperAdmin',
        created: false,
        promoted: true,
      }
    }

    // If user doesn't exist, they need to be synced first
    return {
      success: false,
      error: 'User not found in database. Please sync users first.',
      needsSync: true,
    }
  } catch (error) {
    console.error('Error initializing first superadmin:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
