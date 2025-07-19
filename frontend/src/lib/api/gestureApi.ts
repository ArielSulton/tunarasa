/**
 * API client for gesture text processing
 */

interface GestureTextRequest {
  text: string
  session_id?: string
  language?: string
  gesture_confidence?: number
}

interface GestureTextResponse {
  success: boolean
  question: string
  answer: string
  confidence: number
  sources: Array<{
    document_id: string
    chunk_id: string
    content: string
    similarity_score: number
    filename: string
    title: string
  }>
  processing_time: number
  message?: string
  timestamp: string
}

interface GestureHealthResponse {
  success: boolean
  service: string
  status: string
  message: string
  timestamp: string
}

class GestureApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  }

  /**
   * Send gesture text for processing and get RAG response
   */
  async processGestureText(request: GestureTextRequest): Promise<GestureTextResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/gesture/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: request.text,
          session_id: request.session_id || `gesture_${Date.now()}`,
          language: request.language || 'id',
          gesture_confidence: request.gesture_confidence,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: GestureTextResponse = await response.json()
      return data
    } catch (error) {
      console.error('Error processing gesture text:', error)
      throw new Error('Failed to process gesture text')
    }
  }

  /**
   * Check gesture service health
   */
  async checkHealth(): Promise<GestureHealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/gesture/health`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: GestureHealthResponse = await response.json()
      return data
    } catch (error) {
      console.error('Error checking gesture service health:', error)
      throw new Error('Gesture service health check failed')
    }
  }

  /**
   * Process gesture text with retry logic
   */
  async processGestureTextWithRetry(request: GestureTextRequest, maxRetries: number = 3): Promise<GestureTextResponse> {
    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.processGestureText(request)
      } catch (error) {
        lastError = error as Error

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, attempt - 1) * 1000
          await new Promise((resolve) => setTimeout(resolve, delay))
          console.log(`Retrying gesture text processing (attempt ${attempt + 1}/${maxRetries})`)
        }
      }
    }

    throw lastError!
  }
}

// Export singleton instance
export const gestureApi = new GestureApiClient()

// Export types
export type { GestureTextRequest, GestureTextResponse, GestureHealthResponse }
