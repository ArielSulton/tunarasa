/**
 * Backend URL utility functions for consistent API endpoint resolution
 * Handles different environments (Docker, local development, production)
 */

/**
 * Get the backend URL from environment variables with fallback
 * In Docker: uses NEXT_PUBLIC_BACKEND_URL (e.g., http://backend:8000)
 * In local dev: falls back to http://localhost:8000
 */
export function getBackendUrl(): string {
  // Use internal Next.js API proxy for all backend communication
  // This avoids CORS issues and uses Docker internal network

  if (typeof window === 'undefined') {
    // Server-side: Direct Docker internal network
    return process.env.BACKEND_URL ?? 'http://backend:8000'
  } else {
    // Client-side: Use Next.js API proxy
    const currentOrigin = window.location.origin
    return `${currentOrigin}/api/backend`
  }
}

/**
 * Get the RAG API endpoint for LLM chat functionality
 */
export function getRagApiUrl(): string {
  return `${getBackendUrl()}/api/v1/rag/ask`
}

/**
 * Get gesture recognition API endpoint
 */
export function getGestureApiUrl(): string {
  return `${getBackendUrl()}/api/v1/gesture`
}

/**
 * Create a fetch request with proper backend URL resolution and error handling
 */
export async function backendFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = `${getBackendUrl()}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`

  console.log(`🌐 [Backend] Fetching: ${url}`)

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })

    if (!response.ok) {
      console.error(`❌ [Backend] HTTP Error ${response.status}: ${response.statusText}`)
      console.error(`❌ [Backend] URL: ${url}`)
    }

    return response
  } catch (error) {
    console.error(`❌ [Backend] Network Error:`, error)
    console.error(`❌ [Backend] Failed URL: ${url}`)
    throw error
  }
}

/**
 * Test backend connectivity
 */
export async function testBackendConnectivity(): Promise<{ connected: boolean; url: string; error?: string }> {
  const backendUrl = getBackendUrl()
  const testUrl = `${backendUrl}/api/health` // Health check endpoint

  try {
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    return {
      connected: response.ok,
      url: testUrl,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
    }
  } catch (error) {
    return {
      connected: false,
      url: testUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Debug function to log current backend configuration
 */
export function logBackendConfig(): void {
  const config = {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    BACKEND_URL: process.env.BACKEND_URL,
    resolvedBackendUrl: getBackendUrl(),
    ragApiUrl: getRagApiUrl(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server-side',
    environment: typeof window !== 'undefined' ? 'client' : 'server',
  }

  console.log('🔧 [Backend] Configuration:', config)

  // Test connectivity
  if (typeof window !== 'undefined') {
    console.log('🔗 [Backend] Testing connectivity to:', getBackendUrl())
    testBackendConnectivity()
      .then((result) => {
        if (result.connected) {
          console.log('✅ [Backend] Connection successful to:', result.url)
        } else {
          console.error('❌ [Backend] Connection failed to:', result.url, '- Error:', result.error)
        }
      })
      .catch((error) => {
        console.error('❌ [Backend] Connectivity test failed:', error)
      })
  }
}
