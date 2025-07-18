/**
 * Admin API Client
 * Handles all administrative API calls to the backend
 */

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

class AdminApiClient {
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
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<ApiResponse<AdminDashboardStats>> {
    return this.request<AdminDashboardStats>('/api/v1/admin/dashboard')
  }

  /**
   * Get active sessions
   */
  async getSessions(): Promise<ApiResponse<{ sessions: AdminSession[] }>> {
    return this.request<{ sessions: AdminSession[] }>('/api/v1/admin/sessions')
  }

  /**
   * Get gesture analytics
   */
  async getGestureAnalytics(): Promise<ApiResponse<{ gesture_analytics: GestureAnalytics[] }>> {
    return this.request<{ gesture_analytics: GestureAnalytics[] }>('/api/v1/admin/analytics')
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<ApiResponse<SystemMetrics>> {
    return this.request<SystemMetrics>('/api/v1/admin/metrics')
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<ApiResponse<{ status: string; services: Record<string, unknown> }>> {
    return this.request<{ status: string; services: Record<string, unknown> }>('/api/v1/health')
  }

  /**
   * Update system settings
   */
  async updateSettings(settings: Record<string, unknown>): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/api/v1/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
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
}

// Create singleton instance
export const adminApiClient = new AdminApiClient()

// Export default client
export default adminApiClient
