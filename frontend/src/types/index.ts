export interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'admin' | 'system' | 'llm_recommendation'
  content: string
  timestamp: Date
  confidence?: number
  adminName?: string
  status?: 'sending' | 'sent' | 'delivered' | 'read'
}

export interface ConversationStatus {
  id: string
  status: 'active' | 'waiting' | 'in_progress' | 'resolved'
  assignedAdmin?: string
  queuePosition?: number
  estimatedWaitTime?: number
}
