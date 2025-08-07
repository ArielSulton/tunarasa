import { NextRequest, NextResponse } from 'next/server'
import { seedDefaultRoles } from '@/lib/db/seed-roles'

/**
 * Role Seeding API Endpoint
 *
 * This endpoint initializes the database with default roles.
 * It can be called before any user signs up to prevent foreign key constraint violations.
 *
 * Security Note: This endpoint doesn't require authentication, making it useful for
 * initial system setup. In production, you might want to protect this endpoint
 * or remove it after initial setup.
 *
 * Usage:
 * POST /api/seed-roles
 *
 * Response:
 * - 200: Roles seeded successfully or already exist
 * - 500: Error seeding roles
 */

export async function POST(request: NextRequest) {
  try {
    console.log('🌱 Role seeding API endpoint called')
    console.log('- Timestamp:', new Date().toISOString())
    console.log('- URL:', request.url)
    console.log('- Method:', request.method)

    // Call the seeding function
    await seedDefaultRoles()

    return NextResponse.json({
      success: true,
      message: 'Default roles seeded successfully',
      roles: [
        { id: 1, name: 'superadmin', description: 'Full system access' },
        { id: 2, name: 'admin', description: 'Administrative access' },
        { id: 3, name: 'user', description: 'Basic user access' },
      ],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ Role seeding failed:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to seed roles',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Role seeding endpoint',
    usage: 'Send a POST request to seed default roles',
    roles: [
      { id: 1, name: 'superadmin', description: 'Full system access' },
      { id: 2, name: 'admin', description: 'Administrative access' },
      { id: 3, name: 'user', description: 'Basic user access' },
    ],
    note: 'POST /api/seed-roles to initialize roles',
  })
}
