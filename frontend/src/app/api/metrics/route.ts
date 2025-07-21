/**
 * Simple metrics endpoint to prevent 404 errors
 * Returns basic application metrics in Prometheus format
 */

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Basic metrics in Prometheus format
    const metrics = `
# HELP tunarasa_frontend_uptime_seconds Frontend uptime in seconds
# TYPE tunarasa_frontend_uptime_seconds counter
tunarasa_frontend_uptime_seconds ${Math.floor(process.uptime())}

# HELP tunarasa_frontend_memory_usage_bytes Memory usage in bytes
# TYPE tunarasa_frontend_memory_usage_bytes gauge
tunarasa_frontend_memory_usage_bytes ${process.memoryUsage().heapUsed}

# HELP tunarasa_frontend_requests_total Total number of requests
# TYPE tunarasa_frontend_requests_total counter
tunarasa_frontend_requests_total 1
`.trim()

    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error generating metrics:', error)
    return NextResponse.json({ error: 'Failed to generate metrics' }, { status: 500 })
  }
}
