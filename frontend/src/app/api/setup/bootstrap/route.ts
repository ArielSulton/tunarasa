import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { institutions, users } from '@/lib/db/schema'
import { count } from 'drizzle-orm'
import { seedDefaultInstitutions } from '@/lib/services/institutions-management'

/**
 * Bootstrap Setup API Endpoint
 *
 * This endpoint is for initial system setup ONLY.
 * It can be called without authentication, but only works when:
 * 1. No institutions exist in the database
 * 2. System is in development mode
 *
 * This prevents accidental execution in production.
 */

export async function POST(_request: NextRequest) {
  try {
    // Security check: Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Bootstrap endpoint not available in production' }, { status: 403 })
    }

    // Check if institutions already exist
    const [institutionCount] = await db.select({ count: count() }).from(institutions)

    if (institutionCount.count > 0) {
      return NextResponse.json(
        {
          error: 'System already initialized - institutions exist',
          existingCount: institutionCount.count,
        },
        { status: 409 },
      )
    }

    // Check if we have at least one user to use as creator
    const [userCount] = await db.select({ count: count() }).from(users)

    if (userCount.count === 0) {
      return NextResponse.json(
        {
          error: 'No users found - cannot create institutions without a user to set as creator',
          hint: 'Please register at least one user first',
        },
        { status: 400 },
      )
    }

    // Seed default institutions
    console.log('🚀 Starting bootstrap institution seeding...')
    await seedDefaultInstitutions()

    return NextResponse.json({
      success: true,
      message: 'Bootstrap completed successfully - Dukcapil institution created',
      institutionsCreated: 1,
    })
  } catch (_error) {
    console.error('Bootstrap error:', _error)

    return NextResponse.json(
      {
        error: 'Bootstrap failed',
        details: _error instanceof Error ? _error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  // Status check endpoint
  try {
    const [institutionCount] = await db.select({ count: count() }).from(institutions)

    const [userCount] = await db.select({ count: count() }).from(users)

    return NextResponse.json({
      status: {
        institutions: institutionCount.count,
        users: userCount.count,
        canBootstrap: institutionCount.count === 0 && userCount.count > 0,
        environment: process.env.NODE_ENV,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Status check failed' }, { status: 500 })
  }
}
