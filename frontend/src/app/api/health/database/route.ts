import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

/**
 * Database Health Check Endpoint
 *
 * Simple endpoint to check if database connection is working
 */
export async function GET() {
  try {
    console.log('🏥 [Health Check] Testing database connection...')

    // Simple query to test database connectivity
    const startTime = Date.now()
    await db.execute(sql`SELECT 1 as health_check`)
    const responseTime = Date.now() - startTime

    console.log(`✅ [Health Check] Database healthy - responded in ${responseTime}ms`)

    return NextResponse.json({
      success: true,
      status: 'healthy',
      responseTime,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ [Health Check] Database unhealthy:', error)

    return NextResponse.json(
      {
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown database error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }, // Service Unavailable
    )
  }
}
