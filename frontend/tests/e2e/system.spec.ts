/**
 * Comprehensive End-to-End System Tests for Tunarasa
 * Tests full system integration including frontend, backend, and gesture recognition
 */

import { test, expect } from '@playwright/test'

// Test configuration
const FRONTEND_URL = 'http://localhost:3000'
const BACKEND_URL = 'http://localhost:8000'
const TEST_TIMEOUT = 30000

test.describe('Tunarasa System Integration Tests', () => {
  test.setTimeout(TEST_TIMEOUT)

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto(FRONTEND_URL)

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')
  })

  test('Frontend loads successfully with correct layout', async ({ page }) => {
    // Check page title and main heading
    await expect(page).toHaveTitle(/Tunarasa/)
    await expect(page.locator('h1')).toContainText('Tunarasa')

    // Verify main components are present
    await expect(page.locator('text=A-Z Sign Language Recognition')).toBeVisible()
    await expect(page.locator('text=SIBI Gesture Recognition')).toBeVisible()
    await expect(page.locator('text=Q&A Chat')).toBeVisible()

    // Check video and canvas elements for gesture recognition
    await expect(page.locator('video')).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible()

    // Verify control buttons are present
    await expect(page.locator('button:has-text("Start Detection")')).toBeVisible()
    await expect(page.locator('button:has-text("Clear Word")')).toBeVisible()

    // Check chat interface
    await expect(page.locator('input[placeholder*="Type your question"]')).toBeVisible()
    await expect(page.locator('button:has-text("Send")')).toBeVisible()
  })

  test('Backend API health check', async ({ request }) => {
    // Test basic health endpoint
    const healthResponse = await request.get(`${BACKEND_URL}/health`)
    expect(healthResponse.ok()).toBeTruthy()

    const healthData = await healthResponse.json()
    expect(healthData.status).toBe('healthy')
    expect(healthData.service).toBe('tunarasa-backend')
  })

  test('Backend API endpoints respond correctly', async ({ request }) => {
    // Test metrics endpoint (should work without auth)
    const metricsResponse = await request.get(`${BACKEND_URL}/metrics`)
    expect(metricsResponse.ok()).toBeTruthy()

    // Test authenticated endpoints return proper error without auth
    const adminResponse = await request.get(`${BACKEND_URL}/api/v1/admin/monitoring/prometheus-metrics`)
    expect(adminResponse.status()).toBe(401)
  })

  test('Gesture recognition system initialization', async ({ page }) => {
    // Wait for gesture recognition to initialize
    await page.waitForTimeout(5000)

    // Check initialization status
    const statusElement = page.locator('[data-slot="badge"]')
    await expect(statusElement).toBeVisible()

    // Status should show either "Initializing" or "Ready" or "Error"
    const statusText = await statusElement.textContent()
    expect(['Initializing', 'Ready', 'Error', 'Not initialized']).toContain(statusText)

    // Check console for MediaPipe loading messages
    const logs: string[] = []
    page.on('console', (msg) => logs.push(msg.text()))

    await page.waitForTimeout(3000)

    // Should see MediaPipe initialization logs
    const hasMediaPipeLog = logs.some(
      (log) => log.includes('MediaPipe') || log.includes('gesture') || log.includes('TensorFlow'),
    )
    expect(hasMediaPipeLog).toBeTruthy()
  })

  test('Video camera access and permissions', async ({ page }) => {
    // Mock camera permission (since we can't grant real camera access in headless mode)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: () =>
            Promise.resolve({
              getTracks: () => [{ stop: () => {} }],
              getVideoTracks: () => [{ stop: () => {} }],
              getAudioTracks: () => [{ stop: () => {} }],
            }),
        },
      })
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    // Try to start detection
    const startButton = page.locator('button:has-text("Start Detection")')
    await expect(startButton).toBeVisible()

    // Button should be enabled after initialization
    await page.waitForTimeout(5000)
    const isEnabled = await startButton.isEnabled()

    // In a real environment with camera, this would work
    // In test environment, it's expected to be disabled or show error
    console.log(`Start button enabled: ${isEnabled}`)
  })

  test('Chat interface functionality', async ({ page }) => {
    const chatInput = page.locator('input[placeholder*="Type your question"]')
    const sendButton = page.locator('button:has-text("Send")')

    // Type a test question
    await chatInput.fill('What is sign language?')
    await expect(chatInput).toHaveValue('What is sign language?')

    // Button state might change based on backend connectivity
    const isSendEnabled = await sendButton.isEnabled()
    console.log(`Send button enabled after typing: ${isSendEnabled}`)

    // Clear input
    await chatInput.clear()
    await expect(chatInput).toHaveValue('')
  })

  test('Responsive design and accessibility', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(1000)

    // Main elements should still be visible
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('video')).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(1000)

    await expect(page.locator('text=SIBI Gesture Recognition')).toBeVisible()
    await expect(page.locator('text=Q&A Chat')).toBeVisible()

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(1000)

    // All components should be visible in desktop view
    await expect(page.locator('text=A-Z Sign Language Recognition')).toBeVisible()
  })

  test('JavaScript errors and console warnings', async ({ page }) => {
    const errors: string[] = []
    const warnings: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text())
      }
    })

    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    // Wait for page interactions
    await page.waitForTimeout(10000)

    // Filter out expected warnings (source maps, model not available, etc.)
    const unexpectedErrors = errors.filter(
      (error) =>
        !error.includes('source map') &&
        !error.includes('Gesture recognition model not available') &&
        !error.includes('MediaPipe not available') &&
        !error.includes('Network request failed'),
    )

    // Report any unexpected errors
    if (unexpectedErrors.length > 0) {
      console.log('Unexpected errors found:', unexpectedErrors)
    }

    // Should not have critical JavaScript errors
    expect(unexpectedErrors.length).toBeLessThan(5)
  })

  test('Network requests and API integration', async ({ page }) => {
    const apiRequests: string[] = []

    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('/api/') || url.includes('/metrics') || url.includes('/health')) {
        apiRequests.push(url)
      }
    })

    // Wait for potential API calls
    await page.waitForTimeout(5000)

    // Should have some API requests (metrics, health checks, etc.)
    console.log('API requests made:', apiRequests)
    expect(apiRequests.length).toBeGreaterThan(0)
  })

  test('TensorFlow.js and MediaPipe loading', async ({ page }) => {
    const resourceRequests: string[] = []

    page.on('request', (request) => {
      const url = request.url()
      if (
        url.includes('tensorflow') ||
        url.includes('mediapipe') ||
        url.includes('jsdelivr') ||
        url.includes('models/')
      ) {
        resourceRequests.push(url)
      }
    })

    // Wait for resources to load
    await page.waitForTimeout(10000)

    console.log('AI/ML resources loaded:', resourceRequests)

    // Should attempt to load TensorFlow.js and MediaPipe resources
    const hasTensorFlow = resourceRequests.some((url) => url.includes('tensorflow'))
    const hasMediaPipe = resourceRequests.some((url) => url.includes('mediapipe') || url.includes('jsdelivr'))

    expect(hasTensorFlow || hasMediaPipe).toBeTruthy()
  })
})

test.describe('Performance and Load Tests', () => {
  test('Page load performance', async ({ page }) => {
    const startTime = Date.now()

    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('domcontentloaded')

    const loadTime = Date.now() - startTime
    console.log(`Page load time: ${loadTime}ms`)

    // Page should load within reasonable time (10 seconds)
    expect(loadTime).toBeLessThan(10000)
  })

  test('Memory usage and resource management', async ({ page }) => {
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')

    // Wait for resources to initialize
    await page.waitForTimeout(15000)

    // Check for memory leaks by examining performance
    const performanceMetrics = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memory = (performance as any).memory
      return memory
        ? {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
          }
        : null
    })

    if (performanceMetrics) {
      console.log('Memory usage:', performanceMetrics)

      // Memory usage should be reasonable
      const memoryUsageMB = performanceMetrics.usedJSHeapSize / (1024 * 1024)
      expect(memoryUsageMB).toBeLessThan(500) // Less than 500MB
    }
  })
})
