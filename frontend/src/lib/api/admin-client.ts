// Admin API Client for Dashboard and Analytics

export interface AdminSession {
  id: string
  session_id: string
  created_at: string
  user_agent?: string
  ip_address?: string
  session_duration_minutes?: number
  total_interactions: number
  successful_recognitions: number
  failed_recognitions: number
  questions_asked: number
  user_satisfaction_score?: number
  user_id: string
  start_time: string
  last_activity: string
  gesture_count: number
  conversation_count: number
  accuracy: number
  device: string
  location: string
  status: 'active' | 'inactive' | 'ended'
}

export interface GestureAnalytics {
  total_sessions: number
  total_interactions: number
  avg_session_duration: number
  success_rate: number
  top_gestures: Array<{ gesture: string; count: number }>
  daily_activity: Array<{ date: string; sessions: number; interactions: number }>
  letter: string
  count: number
  accuracy: number
  average_confidence: number
  improvements: string[]
  timeseries?: Array<{ date: string; value: number }>
}

export interface ConversationItem {
  id: string
  session_id: string
  question: string
  answer: string
  created_at: string
  response_time_ms: number
  accuracy_score?: number
  user_feedback?: 'positive' | 'negative'
  validation_status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string
  is_active: boolean
  avg_confidence?: number
  total_response_time?: number
  conversation_id: string
  user_info?: { user_id: string; full_name?: string }
  user_id?: string
  message_count: number
}

export interface ConversationDetails extends ConversationItem {
  context_documents?: string[]
  llm_model_used: string
  processing_steps: Array<{
    step: string
    duration_ms: number
    status: 'success' | 'error'
  }>
  conversation_id: string
  user_info?: { user_id: string; full_name?: string }
  messages?: Array<{
    id: string
    message_id: string
    content: string
    role: 'user' | 'assistant'
    timestamp: string
    is_from_user: boolean
    confidence?: number
    response_time?: number
    gesture_input?: string
  }>
  notes?: Array<{
    id: string
    note_id: string
    content: string
    author: string
    admin_user_id: string
    timestamp: string
    created_at: string
  }>
}

export interface LLMEvaluationSummary {
  total_evaluations: number
  avg_accuracy_score: number
  avg_response_time: number
  top_issues: Array<{
    issue: string
    frequency: number
    severity: 'low' | 'medium' | 'high'
  }>
  model_performance: {
    model_name: string
    avg_score: number
    total_queries: number
  }
  recommendations?: Array<{
    title: string
    confidence: number
    description: string
  }>
  period_hours: number
  total_qa_analyzed: number
  overall_quality_score: number
  key_metrics: {
    accuracy: number
    coherence: number
    relevance: number
    helpfulness: number
    avg_confidence?: number
  }
}

export interface CategoryQualityScores {
  quality_level: 'excellent' | 'good' | 'acceptable' | 'poor'
  average_score: number
  pass_rate: number
  total_queries: number
  total_evaluations: number
}

export interface LLMQualityReport {
  evaluation_id: string
  conversation_id: string
  metrics: {
    accuracy: number
    relevance: number
    coherence: number
    helpfulness: number
  }
  issues_found: Array<{
    type: 'hallucination' | 'irrelevant' | 'inaccurate' | 'unhelpful'
    description: string
    severity: 'low' | 'medium' | 'high'
  }>
  recommendations: Array<{
    description: string
    priority: 'low' | 'medium' | 'high'
  }>
  category_quality_scores: Record<string, CategoryQualityScores>
  created_at: string
  overall_quality_score: number
  overall_pass_rate: number
  total_categories_evaluated: number
}

class AdminApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api'
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Dashboard Analytics
  async getGestureAnalytics(
    params?: { timeframe?: string; format?: string } | '7d' | '30d' | '90d',
  ): Promise<{ success: boolean; data?: GestureAnalytics; error?: string }> {
    let endpoint = '/admin/analytics/gestures'

    if (typeof params === 'string') {
      endpoint += `?range=${params}`
    } else if (params) {
      const queryParams = new URLSearchParams()
      if (params.timeframe) queryParams.set('timeframe', params.timeframe)
      if (params.format) queryParams.set('format', params.format)
      endpoint += `?${queryParams.toString()}`
    }

    try {
      const data = await this.request<GestureAnalytics>(endpoint)
      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async getRecentSessions(limit: number = 10): Promise<AdminSession[]> {
    return this.request<AdminSession[]>(`/admin/sessions?limit=${limit}`)
  }

  async getSessionDetails(sessionId: string): Promise<AdminSession> {
    return this.request<AdminSession>(`/admin/sessions/${sessionId}`)
  }

  // Q&A Management
  async getConversations(params?: {
    limit?: number
    offset?: number
    page?: number
    status?: 'pending' | 'approved' | 'rejected' | string
    search?: string
    date_from?: string
  }): Promise<{
    success: boolean
    data: { conversations: ConversationItem[]; total: number; total_pages?: number }
    error?: string
  }> {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.set('limit', params.limit.toString())
    if (params?.offset) queryParams.set('offset', params.offset.toString())
    if (params?.page) queryParams.set('page', params.page.toString())
    if (params?.status) queryParams.set('status', params.status)
    if (params?.search) queryParams.set('search', params.search)
    if (params?.date_from) queryParams.set('date_from', params.date_from)

    try {
      const data = await this.request<{ conversations: ConversationItem[]; total: number; total_pages?: number }>(
        `/admin/conversations?${queryParams.toString()}`,
      )
      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        data: { conversations: [], total: 0, total_pages: 0 },
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async getConversationDetails(
    conversationId: string,
  ): Promise<{ success: boolean; data?: ConversationDetails; error?: string }> {
    try {
      const data = await this.request<ConversationDetails>(`/admin/conversations/${conversationId}`)
      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async updateConversationStatus(
    conversationId: string,
    status: 'approved' | 'rejected',
    notes?: string,
  ): Promise<void> {
    await this.request(`/admin/conversations/${conversationId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    })
  }

  // LLM Evaluation
  async getLLMEvaluationSummary(
    timeRange: '7d' | '30d' | '90d' = '30d',
  ): Promise<{ success: boolean; data?: LLMEvaluationSummary; error?: string }> {
    try {
      const data = await this.request<LLMEvaluationSummary>(`/admin/llm-evaluation/summary?range=${timeRange}`)
      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async getLLMQualityReports(params?: {
    limit?: number
    offset?: number
    minScore?: number
    issueTypes?: string[]
  }): Promise<{ reports: LLMQualityReport[]; total: number }> {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.set('limit', params.limit.toString())
    if (params?.offset) queryParams.set('offset', params.offset.toString())
    if (params?.minScore) queryParams.set('minScore', params.minScore.toString())
    if (params?.issueTypes) {
      params.issueTypes.forEach((type) => queryParams.append('issueTypes', type))
    }

    return this.request<{ reports: LLMQualityReport[]; total: number }>(
      `/admin/llm-evaluation/reports?${queryParams.toString()}`,
    )
  }

  async getLLMQualityReport(params: {
    period: '7d' | '30d' | '90d'
  }): Promise<{ success: boolean; data?: LLMQualityReport; error?: string }> {
    try {
      const data = await this.request<LLMQualityReport>(`/admin/llm-evaluation/report?period=${params.period}`)
      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Add missing method that takes no parameters
  async getLLMQualityReportSummary(): Promise<{ success: boolean; data?: LLMQualityReport; error?: string }> {
    return this.getLLMQualityReport({ period: '30d' })
  }

  async triggerLLMEvaluation(conversationId: string): Promise<{ evaluationId: string }> {
    return this.request<{ evaluationId: string }>(`/admin/llm-evaluation/trigger`, {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    })
  }

  // System Health
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'error'
    services: Array<{
      name: string
      status: 'up' | 'down' | 'degraded'
      latency?: number
      lastCheck: string
    }>
    metrics: {
      activeUsers: number
      avgResponseTime: number
      errorRate: number
    }
  }> {
    return this.request('/admin/health')
  }
}

export const adminApiClient = new AdminApiClient()
export default adminApiClient
