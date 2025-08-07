import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/supabase-auth'
import { db } from '@/lib/db'
import { users, roles, genders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { initializeDefaultRoles } from '@/lib/services/role-management'
import { setupRLSPolicies, verifyRLSPolicies } from '@/lib/db/setup-rls'

/**
 * Database Initialization API Endpoint
 *
 * Initializes the database with default roles and genders.
 * Creates the first superadmin user if no users exist.
 * Sets up Row Level Security (RLS) policies to fix user sign-up issues.
 *
 * Available POST actions:
 * - init-roles: Initialize default roles
 * - init-genders: Initialize default genders
 * - init-first-admin: Set up first superadmin
 * - setup-rls: Apply RLS policies (FIXES USER SIGN-UP ISSUE)
 * - verify-rls: Verify RLS policies are correctly applied
 * - full-init: Complete initialization including RLS setup
 *
 * This endpoint can only be accessed by authenticated superadmin users.
 */

export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization - require super admin
    const authUser = await requireSuperAdmin()

    const body = (await request.json()) as { action: string; force?: boolean }
    const { action, force = false } = body

    switch (action) {
      case 'init-roles':
        await initializeDefaultRoles()
        return NextResponse.json({
          success: true,
          message: 'Default roles initialization completed',
          created: true,
        })

      case 'init-genders':
        const gendersCreated = await initializeDefaultGenders()
        return NextResponse.json({
          success: true,
          message: gendersCreated ? 'Default genders created successfully' : 'Default genders already exist',
          created: gendersCreated,
        })

      case 'init-first-admin':
        const adminResult = await initializeFirstSuperAdmin(authUser.supabaseUserId, force)
        return NextResponse.json(adminResult)

      case 'setup-rls':
        console.log('🔒 Setting up RLS policies...')
        const rlsResult = await setupRLSPolicies(db)
        if (rlsResult.success) {
          const verification = await verifyRLSPolicies(db)
          return NextResponse.json({
            success: true,
            message: 'RLS policies applied successfully',
            verification: verification.success ? verification : undefined,
          })
        } else {
          return NextResponse.json(
            {
              success: false,
              error: 'Failed to apply RLS policies',
              details: rlsResult.error,
            },
            { status: 500 },
          )
        }

      case 'verify-rls':
        console.log('🔍 Verifying RLS policies...')
        const verificationResult = await verifyRLSPolicies(db)
        return NextResponse.json({
          success: verificationResult.success,
          message: verificationResult.success ? 'RLS policies verified' : 'RLS verification failed',
          ...(verificationResult.success
            ? { policies: verificationResult.policies, rlsStatus: verificationResult.rlsStatus }
            : { error: verificationResult.error }),
        })

      case 'full-init':
        // Initialize everything including RLS policies
        console.log('🚀 Starting full database initialization...')

        await initializeDefaultRoles()
        const gendersInit = await initializeDefaultGenders()
        const adminInit = await initializeFirstSuperAdmin(authUser.supabaseUserId, force)

        // Apply RLS policies
        console.log('🔒 Applying RLS policies...')
        const rlsSetup = await setupRLSPolicies(db)
        const rlsVerification = rlsSetup.success ? await verifyRLSPolicies(db) : { success: false }

        const results = {
          roles: true,
          genders: gendersInit,
          admin: adminInit,
          rls: {
            setup: rlsSetup.success,
            verified: rlsVerification.success,
            policies: rlsVerification.success && 'policies' in rlsVerification ? rlsVerification.policies : undefined,
          },
        }

        return NextResponse.json({
          success: true,
          message: rlsSetup.success
            ? 'Database initialization completed successfully - User sign-up should now work!'
            : 'Database initialization completed with RLS setup issues',
          results,
        })

      default:
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Database initialization error:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check authentication and authorization - require super admin
    await requireSuperAdmin()

    // Get database status
    const [rolesCount, gendersCount, usersCount] = await Promise.all([
      db.select().from(roles),
      db.select().from(genders),
      db.select().from(users),
    ])

    const hasSuperAdmin = usersCount.some((u) => u.roleId === 1)

    // Check RLS policies status
    const rlsStatus = await verifyRLSPolicies(db)
    const hasUserInsertPolicy =
      rlsStatus.success &&
      'policies' in rlsStatus &&
      rlsStatus.policies?.some(
        (p: Record<string, unknown>) => p.tablename === 'users' && p.policyname === 'Users can insert own data',
      )

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
        rls: {
          verified: rlsStatus.success,
          hasUserInsertPolicy,
          signUpReady: hasUserInsertPolicy,
          totalPolicies: rlsStatus.success && 'policies' in rlsStatus ? (rlsStatus.policies?.length ?? 0) : 0,
        },
        needsInitialization: rolesCount.length === 0 || gendersCount.length === 0 || !hasSuperAdmin,
        needsRLSSetup: !hasUserInsertPolicy,
      },
    })
  } catch (error) {
    console.error('Database status check error:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

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
async function initializeFirstSuperAdmin(supabaseUserId: string, force: boolean = false) {
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
    const existingUser = await db.select().from(users).where(eq(users.supabaseUserId, supabaseUserId)).limit(1)

    if (existingUser.length > 0) {
      // Update existing user to superadmin
      await db
        .update(users)
        .set({
          roleId: 1, // Superadmin role
          updatedAt: new Date(),
        })
        .where(eq(users.supabaseUserId, supabaseUserId))

      return {
        success: true,
        message: 'Existing user promoted to SuperAdmin',
        created: false,
        promoted: true,
      }
    }

    // With Supabase Auth, user should already exist from the auth system
    return {
      success: false,
      error: 'User not found in database. This should not happen with Supabase Auth.',
      needsSync: false,
    }
  } catch (error) {
    console.error('Error initializing first superadmin:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
