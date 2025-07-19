/**
 * Gesture Recognition API Client
 * Handles gesture recognition and word completion API calls
 */

export interface GestureData {
  letter: string
  landmarks: number[][]
  hand_detected: boolean
}

export interface GestureRecognitionRequest {
  session_id: string
  gesture_data: GestureData
  confidence: number
  timestamp: string
}

export interface GestureRecognitionResponse {
  success: boolean
  data: {
    session_id: string
    recognized_letter: string
    confidence: number
    gesture_data: GestureData
    processed_at: string
  }
  message?: string
  timestamp: string
}

export interface WordCompletionRequest {
  session_id: string
  letters: string[]
  context?: string
}

export interface WordCompletionResponse {
  success: boolean
  data: {
    letters: string[]
    combined_letters: string
    completed_word: string
    suggestions: string[]
    confidence: number
    context?: string
  }
  timestamp: string
}

export interface SessionHistoryResponse {
  success: boolean
  data: {
    session_id: string
    history: Array<{
      message_id: number
      content: string
      is_user: boolean
      created_at: string
      conversation_id: number
    }>
    total_messages: number
  }
  timestamp: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class GestureAPIClient {
  private baseUrl: string

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') {
    this.baseUrl = baseUrl
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Recognize gesture from MediaPipe data
   */
  async recognizeGesture(request: GestureRecognitionRequest): Promise<ApiResponse<GestureRecognitionResponse['data']>> {
    return this.request<GestureRecognitionResponse['data']>('/api/v1/gesture/recognize', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Complete word from letter sequence
   */
  async completeWord(request: WordCompletionRequest): Promise<ApiResponse<WordCompletionResponse['data']>> {
    return this.request<WordCompletionResponse['data']>('/api/v1/gesture/complete-word', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Get session history
   */
  async getSessionHistory(sessionId: string, limit: number = 50): Promise<ApiResponse<SessionHistoryResponse['data']>> {
    return this.request<SessionHistoryResponse['data']>(`/api/v1/gesture/session/${sessionId}/history?limit=${limit}`)
  }

  /**
   * Generate session ID for anonymous users
   */
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Create gesture recognition request
   */
  createGestureRequest(sessionId: string, gestureData: GestureData, confidence: number): GestureRecognitionRequest {
    return {
      session_id: sessionId,
      gesture_data: gestureData,
      confidence,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Create word completion request
   */
  createWordCompletionRequest(sessionId: string, letters: string[], context?: string): WordCompletionRequest {
    return {
      session_id: sessionId,
      letters,
      context,
    }
  }
}

// Create and export a singleton instance
const gestureClient = new GestureAPIClient()
export default gestureClient

// Export the class for custom instances
export { GestureAPIClient }
