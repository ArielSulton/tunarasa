/**
 * Network utility functions for handling connection issues
 */

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const response = await fetch('/api/health/database', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return response.ok
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

export async function waitForNetworkRecovery(maxAttempts = 3, delayMs = 5000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`🔄 Network recovery check attempt ${attempt}/${maxAttempts}`)

    const isConnected = await checkDatabaseConnection()

    if (isConnected) {
      console.log('✅ Network/database connection recovered')
      return true
    }

    if (attempt < maxAttempts) {
      console.log(`⏳ Waiting ${delayMs}ms before next attempt...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  console.log('❌ Network recovery failed after all attempts')
  return false
}

export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const networkErrors = ['ESERVFAIL', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'Failed query', 'DNS', 'Network']

  return networkErrors.some((errorType) => error.message.includes(errorType))
}

export function getNetworkErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown network error'

  if (error.message.includes('ESERVFAIL')) {
    return 'DNS resolution failed. Please check your network connection.'
  }

  if (error.message.includes('Failed query')) {
    return 'Database query failed. Connection may be unstable.'
  }

  if (error.message.includes('ETIMEDOUT') || error.name === 'AbortError') {
    return 'Request timed out. Database may be slow or reconnecting.'
  }

  return error.message
}
