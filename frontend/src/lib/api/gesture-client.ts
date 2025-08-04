/**
 * Gesture Recognition API Client
 * Handles gesture recognition and word completion API calls with strict typing
 */

// Strict utility types for better type safety
type Brand<T, K> = T & { readonly __brand: K }
type SessionId = Brand<string, 'SessionId'>
type Timestamp = Brand<string, 'Timestamp'>
type ConfidenceScore = Brand<number, 'ConfidenceScore'>
type MediaPipeLandmark = Brand<number[][], 'MediaPipeLandmark'>

// Type guards for runtime validation
export const isValidSessionId = (value: string): value is SessionId => {
  return typeof value === 'string' && value.length > 0 && /^[a-zA-Z0-9_-]+$/.test(value)
}

export const isValidConfidence = (value: number): value is ConfidenceScore => {
  return typeof value === 'number' && value >= 0 && value <= 1 && !isNaN(value)
}

export const isValidTimestamp = (value: string): value is Timestamp => {
  return typeof value === 'string' && !isNaN(Date.parse(value))
}

export const isValidLandmarks = (value: unknown): value is MediaPipeLandmark => {
  return (
    Array.isArray(value) &&
    value.every(
      (point) =>
        Array.isArray(point) && point.length >= 2 && point.every((coord) => typeof coord === 'number' && !isNaN(coord)),
    )
  )
}

// Strict gesture data interface
export interface GestureData {
  readonly letter: string
  readonly landmarks: MediaPipeLandmark
  readonly hand_detected: boolean
}

// Request interfaces with strict validation
export interface GestureRecognitionRequest {
  readonly session_id: SessionId
  readonly gesture_data: GestureData
  readonly confidence: ConfidenceScore
  readonly timestamp: Timestamp
}

export interface WordCompletionRequest {
  readonly session_id: SessionId
  readonly letters: readonly string[]
  readonly context?: string
}

// Response interfaces with discriminated unions for success/error states
export interface GestureRecognitionSuccessResponse {
  readonly success: true
  readonly data: {
    readonly session_id: SessionId
    readonly recognized_letter: string
    readonly confidence: ConfidenceScore
    readonly gesture_data: GestureData
    readonly processed_at: Timestamp
  }
  readonly message?: string
  readonly timestamp: Timestamp
}

export interface GestureRecognitionErrorResponse {
  readonly success: false
  readonly error: {
    readonly code: 'INVALID_GESTURE' | 'RECOGNITION_FAILED' | 'NETWORK_ERROR' | 'VALIDATION_ERROR'
    readonly message: string
    readonly details?: Record<string, unknown>
  }
  readonly timestamp: Timestamp
}

export type GestureRecognitionResponse = GestureRecognitionSuccessResponse | GestureRecognitionErrorResponse

export interface WordCompletionSuccessResponse {
  readonly success: true
  readonly data: {
    readonly letters: readonly string[]
    readonly combined_letters: string
    readonly completed_word: string
    readonly suggestions: readonly string[]
    readonly confidence: ConfidenceScore
    readonly context?: string
  }
  readonly timestamp: Timestamp
}

export interface WordCompletionErrorResponse {
  readonly success: false
  readonly error: {
    readonly code: 'INVALID_LETTERS' | 'COMPLETION_FAILED' | 'NETWORK_ERROR'
    readonly message: string
    readonly details?: Record<string, unknown>
  }
  readonly timestamp: Timestamp
}

export type WordCompletionResponse = WordCompletionSuccessResponse | WordCompletionErrorResponse

export interface SessionHistoryItem {
  readonly message_id: number
  readonly content: string
  readonly is_user: boolean
  readonly created_at: Timestamp
  readonly conversation_id: number
}

export interface SessionHistorySuccessResponse {
  readonly success: true
  readonly data: {
    readonly session_id: SessionId
    readonly history: readonly SessionHistoryItem[]
    readonly total_messages: number
  }
  readonly timestamp: Timestamp
}

export interface SessionHistoryErrorResponse {
  readonly success: false
  readonly error: {
    readonly code: 'SESSION_NOT_FOUND' | 'NETWORK_ERROR' | 'UNAUTHORIZED'
    readonly message: string
    readonly details?: Record<string, unknown>
  }
  readonly timestamp: Timestamp
}

export type SessionHistoryResponse = SessionHistorySuccessResponse | SessionHistoryErrorResponse

// Enhanced API response types with discriminated unions
export interface ApiSuccessResponse<T> {
  readonly success: true
  readonly data: T
  readonly message?: string
}

export interface ApiErrorResponse {
  readonly success: false
  readonly error: {
    readonly code: string
    readonly message: string
    readonly details?: Record<string, unknown>
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// Error types for better error handling
export class GestureClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'GestureClientError'
  }
}

export class ValidationError extends GestureClientError {
  constructor(field: string, value: unknown, expectedType: string) {
    super(`Validation failed for field '${field}': expected ${expectedType}, got ${typeof value}`, 'VALIDATION_ERROR', {
      field,
      value,
      expectedType,
    })
    this.name = 'ValidationError'
  }
}

export class NetworkError extends GestureClientError {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message, 'NETWORK_ERROR', { statusCode })
    this.name = 'NetworkError'
  }
}

class GestureAPIClient {
  private readonly baseUrl: string
  private readonly timeout: number
  private readonly retryAttempts: number

  constructor(
    baseUrl: string = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
    timeout: number = 10000,
    retryAttempts: number = 3,
  ) {
    if (!baseUrl || typeof baseUrl !== 'string') {
      throw new ValidationError('baseUrl', baseUrl, 'non-empty string')
    }
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.timeout = timeout
    this.retryAttempts = retryAttempts
  }

  /**
   * Enhanced request method with strict typing and comprehensive error handling
   */
  private async request<T>(endpoint: string, options: RequestInit = {}, attempt: number = 1): Promise<ApiResponse<T>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        // Try to parse error response
        const errorData = await response.json().catch(() => ({}))

        const errorCode = this.mapHttpStatusToErrorCode(response.status)
        const errorMessage = errorData.detail ?? errorData.message ?? `HTTP ${response.status}: ${response.statusText}`

        return {
          success: false,
          error: {
            code: errorCode,
            message: errorMessage,
            details: {
              statusCode: response.status,
              statusText: response.statusText,
              ...errorData,
            },
          },
        }
      }

      const data = await response.json()

      // Validate response structure
      if (typeof data !== 'object' || data === null) {
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE',
            message: 'Server returned invalid response format',
            details: { responseType: typeof data },
          },
        }
      }

      return {
        success: true,
        data: data as T,
      }
    } catch (error) {
      clearTimeout(timeoutId)

      // Handle network errors with retry logic
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: {
              code: 'TIMEOUT_ERROR',
              message: `Request timeout after ${this.timeout}ms`,
              details: { timeout: this.timeout },
            },
          }
        }

        // Retry on network errors (but not on validation errors)
        if (attempt < this.retryAttempts && this.isRetryableError(error)) {
          await this.delay(Math.pow(2, attempt) * 1000) // Exponential backoff
          return this.request<T>(endpoint, options, attempt + 1)
        }

        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: error.message,
            details: {
              errorName: error.name,
              attempt,
              maxAttempts: this.retryAttempts,
            },
          },
        }
      }

      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
          details: { error: String(error) },
        },
      }
    }
  }

  private mapHttpStatusToErrorCode(status: number): string {
    switch (status) {
      case 400:
        return 'VALIDATION_ERROR'
      case 401:
        return 'UNAUTHORIZED'
      case 403:
        return 'FORBIDDEN'
      case 404:
        return 'NOT_FOUND'
      case 429:
        return 'RATE_LIMITED'
      case 500:
        return 'INTERNAL_SERVER_ERROR'
      case 502:
        return 'BAD_GATEWAY'
      case 503:
        return 'SERVICE_UNAVAILABLE'
      case 504:
        return 'GATEWAY_TIMEOUT'
      default:
        return 'HTTP_ERROR'
    }
  }

  private isRetryableError(error: Error): boolean {
    // Retry on network errors but not on client errors
    return (
      !error.message.includes('400') &&
      !error.message.includes('401') &&
      !error.message.includes('403') &&
      !error.message.includes('404')
    )
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Recognize gesture from MediaPipe data with strict validation
   */
  async recognizeGesture(
    request: GestureRecognitionRequest,
  ): Promise<ApiResponse<GestureRecognitionSuccessResponse['data']>> {
    // Validate request before sending
    this.validateGestureRequest(request)

    return this.request<GestureRecognitionSuccessResponse['data']>('/api/v1/gesture/recognize', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Complete word from letter sequence with validation
   */
  async completeWord(request: WordCompletionRequest): Promise<ApiResponse<WordCompletionSuccessResponse['data']>> {
    // Validate request before sending
    this.validateWordCompletionRequest(request)

    return this.request<WordCompletionSuccessResponse['data']>('/api/v1/gesture/complete-word', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Get session history with validation
   */
  async getSessionHistory(
    sessionId: string,
    limit: number = 50,
  ): Promise<ApiResponse<SessionHistorySuccessResponse['data']>> {
    if (!isValidSessionId(sessionId)) {
      throw new ValidationError('sessionId', sessionId, 'valid session ID')
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new ValidationError('limit', limit, 'integer between 1 and 1000')
    }

    return this.request<SessionHistorySuccessResponse['data']>(
      `/api/v1/gesture/session/${encodeURIComponent(sessionId)}/history?limit=${limit}`,
    )
  }

  /**
   * Generate cryptographically secure session ID for anonymous users
   */
  generateSessionId(): SessionId {
    const timestamp = Date.now().toString(36)
    const randomPart = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('')

    const sessionId = `session_${timestamp}_${randomPart}`

    if (!isValidSessionId(sessionId)) {
      throw new GestureClientError('Failed to generate valid session ID', 'GENERATION_ERROR')
    }

    return sessionId
  }

  /**
   * Create validated gesture recognition request
   */
  createGestureRequest(sessionId: string, gestureData: GestureData, confidence: number): GestureRecognitionRequest {
    if (!isValidSessionId(sessionId)) {
      throw new ValidationError('sessionId', sessionId, 'valid session ID')
    }

    if (!isValidConfidence(confidence)) {
      throw new ValidationError('confidence', confidence, 'number between 0 and 1')
    }

    this.validateGestureData(gestureData)

    const timestamp = new Date().toISOString() as Timestamp

    return {
      session_id: sessionId,
      gesture_data: gestureData,
      confidence,
      timestamp,
    }
  }

  /**
   * Create validated word completion request
   */
  createWordCompletionRequest(sessionId: string, letters: readonly string[], context?: string): WordCompletionRequest {
    if (!isValidSessionId(sessionId)) {
      throw new ValidationError('sessionId', sessionId, 'valid session ID')
    }

    if (!Array.isArray(letters) || letters.length === 0) {
      throw new ValidationError('letters', letters, 'non-empty array of strings')
    }

    if (letters.some((letter) => typeof letter !== 'string' || letter.length !== 1)) {
      throw new ValidationError('letters', letters, 'array of single characters')
    }

    if (context !== undefined && typeof context !== 'string') {
      throw new ValidationError('context', context, 'string or undefined')
    }

    return {
      session_id: sessionId,
      letters,
      context,
    }
  }

  /**
   * Validate gesture data structure
   */
  private validateGestureData(gestureData: GestureData): void {
    if (!gestureData || typeof gestureData !== 'object') {
      throw new ValidationError('gestureData', gestureData, 'object')
    }

    if (typeof gestureData.letter !== 'string' || gestureData.letter.length !== 1) {
      throw new ValidationError('gestureData.letter', gestureData.letter, 'single character string')
    }

    if (!isValidLandmarks(gestureData.landmarks)) {
      throw new ValidationError('gestureData.landmarks', gestureData.landmarks, 'array of coordinate arrays')
    }

    if (typeof gestureData.hand_detected !== 'boolean') {
      throw new ValidationError('gestureData.hand_detected', gestureData.hand_detected, 'boolean')
    }
  }

  /**
   * Validate gesture recognition request
   */
  private validateGestureRequest(request: GestureRecognitionRequest): void {
    if (!isValidSessionId(request.session_id)) {
      throw new ValidationError('session_id', request.session_id, 'valid session ID')
    }

    if (!isValidConfidence(request.confidence)) {
      throw new ValidationError('confidence', request.confidence, 'number between 0 and 1')
    }

    if (!isValidTimestamp(request.timestamp)) {
      throw new ValidationError('timestamp', request.timestamp, 'valid ISO timestamp')
    }

    this.validateGestureData(request.gesture_data)
  }

  /**
   * Validate word completion request
   */
  private validateWordCompletionRequest(request: WordCompletionRequest): void {
    if (!isValidSessionId(request.session_id)) {
      throw new ValidationError('session_id', request.session_id, 'valid session ID')
    }

    if (!Array.isArray(request.letters) || request.letters.length === 0) {
      throw new ValidationError('letters', request.letters, 'non-empty array')
    }

    if (request.letters.some((letter) => typeof letter !== 'string' || letter.length !== 1)) {
      throw new ValidationError('letters', request.letters, 'array of single characters')
    }
  }
}

// Create and export a singleton instance
const gestureClient = new GestureAPIClient()
export default gestureClient

// Export the class for custom instances
export { GestureAPIClient }
