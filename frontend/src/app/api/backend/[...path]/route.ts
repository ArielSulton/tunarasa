import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// Timeout helper function
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Backend request timeout')), timeoutMs)),
  ])
}

// Proxy all requests to backend via Docker internal network
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleBackendRequest(request, await params, 'GET')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleBackendRequest(request, await params, 'POST')
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleBackendRequest(request, await params, 'PUT')
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleBackendRequest(request, await params, 'DELETE')
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handleBackendRequest(request, await params, 'PATCH')
}

async function handleBackendRequest(request: NextRequest, params: { path: string[] }, method: string) {
  try {
    // Get path from URL
    const backendPath = params.path.join('/')

    // Backend URL via Docker internal network
    const backendUrl =
      process.env.NODE_ENV === 'production'
        ? 'http://backend:8000' // Docker service name
        : 'http://localhost:8000' // Development

    const targetUrl = `${backendUrl}/${backendPath}`

    // Get search params from original request
    const url = new URL(request.url)
    const searchParams = url.searchParams.toString()
    const finalUrl = searchParams ? `${targetUrl}?${searchParams}` : targetUrl

    console.log(`🔄 [Backend Proxy] ${method} ${finalUrl}`)

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Forward relevant headers (exclude host, origin, etc.)
        ...(request.headers.get('authorization') && {
          Authorization: request.headers.get('authorization')!,
        }),
        ...(request.headers.get('x-api-key') && {
          'X-API-Key': request.headers.get('x-api-key')!,
        }),
      },
    }

    // Add body for non-GET requests
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        const body = await request.text()
        if (body) {
          requestOptions.body = body
        }
      } catch (error) {
        console.warn('⚠️ [Backend Proxy] Could not read request body:', error)
      }
    }

    // Make request to backend with timeout
    const response = await withTimeout(
      fetch(finalUrl, requestOptions),
      25000, // 25 second timeout
    )

    console.log(`✅ [Backend Proxy] Response: ${response.status}`)

    // Get response body
    const responseBody = await response.text()

    // Create response with same status and headers
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/json',
        // Add CORS headers for frontend
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  } catch (error) {
    console.error('❌ [Backend Proxy] Error:', error)

    return NextResponse.json(
      {
        error: 'Backend request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    )
  }
}
