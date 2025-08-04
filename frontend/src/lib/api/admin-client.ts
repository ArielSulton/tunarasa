/**
 * Admin API Client
 * Handles all administrative API calls to the backend with Clerk authentication
 */

// Client-side admin API client - token should be passed from component using useAuth

export interface AdminDashboardStats {
  total_sessions: number
  total_conversations: number
  total_gestures: number
  active_sessions: number
  average_accuracy: number
  average_response_time: number
  system_health: 'healthy' | 'warning' | 'error'
  uptime: number
}

export interface AdminSession {
  id: string
  user_id: string
  start_time: string
  last_activity: string
  gesture_count: number
  conversation_count: number
  accuracy: number
  device: string
  location: string
  status: 'active' | 'idle' | 'ended'
}

export interface GestureAnalytics {
  letter: string
  count: number
  accuracy: number
  average_confidence: number
  improvements: number
}

export interface SystemMetrics {
  cpu_usage: number
  memory_usage: number
  storage_usage: number
  network_usage: number
  response_time: number
  error_rate: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface LLMEvaluationSummary {
  period_hours: number
  total_qa_analyzed: number
  overall_quality_score: number
  recommendations: LLMRecommendation[]
  key_metrics: {
    avg_response_time: number
    avg_confidence: number
    quality_distribution: {
      excellent: number
      good: number
      needs_improvement: number
    }
  }
  generated_at: string
}

export interface LLMRecommendation {
  type: string
  title: string
  description: string
  priority: string
  confidence: number
  evidence: string[]
  suggested_actions: string[]
  expected_improvement: number
  category_affected: string
  examples: Array<Record<string, unknown>>
  implementation_effort: string
}

export interface LLMQualityReport {
  report_generated_at: string
  overall_quality_score: number
  overall_pass_rate: number
  category_quality_scores: Record<string, QualityScore>
  recommendations: LLMRecommendation[]
  total_categories_evaluated: number
}

export interface QualityScore {
  average_score: number
  pass_rate: number
  quality_level: string
  total_evaluations: number
}

export interface LLMAnalysisResult {
  success: boolean
  total_analyzed: number
  recommendations: LLMRecommendation[]
  summary: {
    high_priority: number
    medium_priority: number
    low_priority: number
  }
}

export interface RecommendationDetails {
  recommendation: LLMRecommendation
  related_metrics: Record<string, unknown>
  implementation_guide: {
    steps: string[]
    effort: string
    expected_impact: number
  }
}

export interface ConversationMessage {
  message_id: string
  content: string
  is_from_user: boolean
  timestamp: string
  confidence?: number
  response_time?: number
  gesture_input?: string
}

export interface ConversationItem {
  conversation_id: string
  user_id: string
  is_active: boolean
  created_at: string
  updated_at: string
  message_count: number
  last_message?: string
  avg_confidence?: number
  total_response_time?: number
  user_info?: {
    user_id: string
    full_name: string
    role: string
  }
}

export interface ConversationListResponse {
  conversations: ConversationItem[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface ConversationDetails {
  conversation_id: string
  user_info?: {
    user_id: string
    full_name: string
    role: string
  }
  is_active: boolean
  created_at: string
  updated_at: string
  messages: ConversationMessage[]
  notes: Array<{
    note_id: string
    content: string
    created_at: string
    admin_user_id: string
  }>
  stats: {
    total_messages: number
    avg_confidence: number
    total_response_time: number
    avg_response_time: number
  }
}

export interface ConversationEvaluation {
  conversation_id: string
  evaluation_results: {
    overall_score: number
    category_scores: Record<string, number>
    recommendations: string[]
    evaluation_details: Record<string, unknown>
  }
  evaluated_at: string
  status: string
}

class AdminApiClient {
  private readonly baseUrl: string

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000') {
    this.baseUrl = baseUrl
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, token?: string): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...((options.headers as Record<string, string>) || {}),
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.detail ?? `HTTP ${response.status}: ${response.statusText}`,
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
   * Get dashboard statistics
   */
  async getDashboardStats(token?: string): Promise<ApiResponse<AdminDashboardStats>> {
    return this.request<AdminDashboardStats>('/api/v1/admin/dashboard/stats', {}, token)
  }

  /**
   * Get active sessions
   */
  async getSessions(token?: string): Promise<ApiResponse<{ sessions: AdminSession[] }>> {
    return this.request<{ sessions: AdminSession[] }>('/api/v1/admin/users', {}, token)
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(token?: string): Promise<ApiResponse<SystemMetrics>> {
    return this.request<SystemMetrics>('/api/v1/admin/dashboard/metrics', {}, token)
  }

  /**
   * Get health status
   */
  async getHealthStatus(token?: string): Promise<ApiResponse<{ status: string; services: Record<string, unknown> }>> {
    return this.request<{ status: string; services: Record<string, unknown> }>('/api/v1/admin/system/health', {}, token)
  }

  /**
   * Update system settings
   */
  async updateSettings(settings: Record<string, unknown>, token?: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(
      '/api/v1/admin/settings',
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      },
      token,
    )
  }

  /**
   * Get current system settings
   */
  async getSettings(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request<Record<string, unknown>>('/api/v1/admin/settings')
  }

  /**
   * Get user sessions with pagination
   */
  async getSessionsPaginated(
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<ApiResponse<{ sessions: AdminSession[]; total: number; page: number; limit: number }>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    })

    if (search) {
      params.append('search', search)
    }

    return this.request<{ sessions: AdminSession[]; total: number; page: number; limit: number }>(
      `/api/v1/admin/sessions?${params.toString()}`,
    )
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/api/v1/admin/sessions/${sessionId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Get detailed session information
   */
  async getSessionDetails(sessionId: string): Promise<
    ApiResponse<
      AdminSession & {
        gestures: unknown[]
        conversations: unknown[]
        performance_metrics: unknown
      }
    >
  > {
    return this.request<
      AdminSession & {
        gestures: unknown[]
        conversations: unknown[]
        performance_metrics: unknown
      }
    >(`/api/v1/admin/sessions/${sessionId}`)
  }

  /**
   * Export dashboard data
   */
  async exportData(format: 'csv' | 'json' = 'csv'): Promise<ApiResponse<{ download_url: string }>> {
    return this.request<{ download_url: string }>(`/api/v1/admin/export?format=${format}`)
  }

  /**
   * Get system logs
   */
  async getSystemLogs(
    level: 'info' | 'warning' | 'error' = 'info',
    limit: number = 100,
  ): Promise<ApiResponse<{ logs: Array<{ timestamp: string; level: string; message: string }> }>> {
    return this.request<{ logs: Array<{ timestamp: string; level: string; message: string }> }>(
      `/api/v1/admin/logs?level=${level}&limit=${limit}`,
    )
  }

  /**
   * Restart system services
   */
  async restartServices(): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/api/v1/admin/restart', {
      method: 'POST',
    })
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/api/v1/admin/cache', {
      method: 'DELETE',
    })
  }

  /**
   * Get real-time metrics (for live updates)
   */
  async getRealtimeMetrics(): Promise<
    ApiResponse<{
      active_sessions: number
      current_load: number
      response_time: number
      error_rate: number
      timestamp: string
    }>
  > {
    return this.request<{
      active_sessions: number
      current_load: number
      response_time: number
      error_rate: number
      timestamp: string
    }>('/api/v1/admin/realtime')
  }

  /**
   * Get LLM evaluation summary with recommendations
   */
  async getLLMEvaluationSummary(params: { period: string }): Promise<ApiResponse<LLMEvaluationSummary>> {
    const queryParams = new URLSearchParams(params)
    return this.request<LLMEvaluationSummary>(`/api/v1/admin/llm/evaluation-summary?${queryParams.toString()}`)
  }

  /**
   * Get LLM quality report
   */
  async getLLMQualityReport(): Promise<ApiResponse<LLMQualityReport>> {
    return this.request<LLMQualityReport>('/api/v1/admin/llm/quality-report')
  }

  /**
   * Analyze batch of Q&A data for recommendations
   */
  async analyzeLLMBatch(qaData: {
    questions: string[]
    answers: string[]
    contexts?: string[]
    confidences?: number[]
    response_times?: number[]
    session_ids?: string[]
  }): Promise<ApiResponse<LLMAnalysisResult>> {
    return this.request<LLMAnalysisResult>('/api/v1/admin/llm/analyze-batch', {
      method: 'POST',
      body: JSON.stringify(qaData),
    })
  }

  /**
   * Get detailed recommendation information
   */
  async getRecommendationDetails(recommendationId: string): Promise<ApiResponse<RecommendationDetails>> {
    return this.request<RecommendationDetails>(`/api/v1/admin/llm/recommendations/${recommendationId}`)
  }

  /**
   * Get gesture analytics with optional parameters
   */
  async getGestureAnalytics(
    params?: {
      timeframe?: string
      format?: string
    },
    token?: string,
  ): Promise<ApiResponse<{ gesture_analytics?: GestureAnalytics[]; timeseries?: Array<Record<string, unknown>> }>> {
    if (params) {
      const queryParams = new URLSearchParams()
      if (params.timeframe) queryParams.append('timeframe', params.timeframe)
      if (params.format) queryParams.append('format', params.format)
      return this.request<{ gesture_analytics?: GestureAnalytics[]; timeseries?: Array<Record<string, unknown>> }>(
        `/api/v1/admin/analytics?${queryParams.toString()}`,
        {},
        token,
      )
    }
    return this.request<{ gesture_analytics?: GestureAnalytics[]; timeseries?: Array<Record<string, unknown>> }>(
      '/api/v1/admin/analytics',
      {},
      token,
    )
  }

  /**
   * Get all conversations with pagination and filters
   */
  async getConversations(params?: {
    page?: number
    limit?: number
    search?: string
    status?: string
    date_from?: string
    date_to?: string
  }): Promise<ApiResponse<ConversationListResponse>> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.date_from) queryParams.append('date_from', params.date_from)
    if (params?.date_to) queryParams.append('date_to', params.date_to)

    return this.request<ConversationListResponse>(`/api/v1/admin/conversations?${queryParams.toString()}`)
  }

  /**
   * Get conversation details with messages
   */
  async getConversationDetails(conversationId: string): Promise<ApiResponse<ConversationDetails>> {
    return this.request<ConversationDetails>(`/api/v1/admin/conversations/${conversationId}`)
  }

  /**
   * Get conversation evaluation results
   */
  async getConversationEvaluation(conversationId: string): Promise<ApiResponse<ConversationEvaluation>> {
    return this.request<ConversationEvaluation>(`/api/v1/admin/monitoring/conversation/${conversationId}`)
  }
}

// Create singleton instance
export const adminApiClient = new AdminApiClient()

// Export default client
export default adminApiClient
