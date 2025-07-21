/**
 * Global setup for Playwright tests
 * Ensures backend services are available before running tests
 */

async function globalSetup() {
  console.log('🚀 Starting global test setup...')

  // Check if backend is available
  const backendUrl = 'http://localhost:8000'
  const maxRetries = 30
  const retryDelay = 2000

  console.log('⏳ Waiting for backend services to be ready...')

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${backendUrl}/health`)
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Backend service is ready:', data)
        break
      }
    } catch {
      if (i === maxRetries - 1) {
        console.error('❌ Backend service not available after maximum retries')
        console.error('Make sure Docker services are running: docker-compose -f compose.dev.yaml up')
        process.exit(1)
      }
      console.log(`⏳ Attempt ${i + 1}/${maxRetries} - Backend not ready, retrying in ${retryDelay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }
  }

  // Check if frontend is available (handled by Playwright webServer config)
  console.log('✅ Global setup completed successfully')
}

export default globalSetup
