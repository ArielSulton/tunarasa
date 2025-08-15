'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Users,
  CheckCircle,
  MessageCircle,
  Clock,
  Send,
  RotateCcw,
  Bot,
  ThumbsUp,
  ThumbsDown,
  Mic,
  MicOff,
} from 'lucide-react'
import { useUserRole } from '@/components/auth/SuperAdminOnly'
import { useServiceMode } from '@/hooks/use-service-config'
import { getRagApiUrl, logBackendConfig } from '@/lib/utils/backend'
import { ModeSwitcher } from '@/components/komunikasi/ModeSwitcher'
import { useSupabaseUser } from '@/hooks/use-supabase-auth'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'

interface AdminConversation {
  id: string
  sessionId: string
  userName: string
  userAgent: string
  status: 'active' | 'waiting' | 'in_progress' | 'resolved'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  lastMessage: string
  lastMessageAt: string
  queuedAt: string
  messageCount: number
  waitTime: number
  assignedAdminId: number | null
  inputMethod: string
  serviceMode: string
}

interface AdminStats {
  totalConversations: number
  activeConversations: number
  waitingInQueue: number
  averageResponseTime: number
  averageResolutionTime: number
  todayResolved: number
}

interface ConversationMessage {
  id: string
  type: 'user' | 'admin' | 'llm_bot' | 'llm_recommendation' | 'system'
  content: string
  timestamp: string
  confidence?: number
  adminName?: string
  inputMethod?: string
}

interface AdminConversationPanelProps {
  isVisible: boolean
  onVisibilityChange: (visible: boolean) => void
}

// Helper function to get service mode display info
const getServiceModeInfo = (serviceMode: string) => {
  switch (serviceMode) {
    case 'full_llm_bot':
      return {
        icon: Bot,
        label: 'AI Bot',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
      }
    case 'bot_with_admin_validation':
      return {
        icon: Users,
        label: 'Human Support',
        color: 'bg-green-100 text-green-800 border-green-200',
      }
    default:
      return {
        icon: Bot,
        label: 'Unknown',
        color: 'bg-gray-100 text-gray-800 border-gray-200',
      }
  }
}

export function AdminConversationPanel({ isVisible, onVisibilityChange }: AdminConversationPanelProps) {
  const [isInternalClient, setIsInternalClient] = useState(false)

  // Ensure we're on the client side before using auth hooks
  useEffect(() => {
    setIsInternalClient(true)
  }, [])

  if (!isInternalClient) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Memuat panel admin...</p>
        </div>
      </div>
    )
  }

  return <AdminConversationPanelInternal isVisible={isVisible} onVisibilityChange={onVisibilityChange} />
}

function AdminConversationPanelInternal({ isVisible, onVisibilityChange }: AdminConversationPanelProps) {
  const { role } = useUserRole()
  const { serviceMode } = useServiceMode()
  const { user: adminUser } = useSupabaseUser()
  const [conversations, setConversations] = useState<AdminConversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<AdminConversation | null>(null)
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [customResponse, setCustomResponse] = useState('')
  const [llmRecommendation, setLlmRecommendation] = useState<string>('')
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false)
  const [showRecommendation, setShowRecommendation] = useState(false)
  const [isResponding, setIsResponding] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPollingMessages, setIsPollingMessages] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)

  // Speech recognition for admin responses
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition()
  const [isUsingSpeech, setIsUsingSpeech] = useState(false)

  // Fetch real conversations from API
  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Add timeout for faster feedback to user
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn('❌ [AdminPanel] Admin conversations request timed out after 10 seconds')
        controller.abort()
      }, 10000) // 10 second timeout for better UX

      const response = await fetch('/api/chat/admin/conversations', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error Response:', errorText)

        // If it's a timeout (408) or server error (500), provide fallback data
        if (response.status === 408 || response.status === 500) {
          console.log('🔄 [AdminPanel] Using fallback data due to server timeout')
          setConversations([])
          setStats({
            totalConversations: 0,
            activeConversations: 0,
            waitingInQueue: 0,
            averageResponseTime: 0,
            averageResolutionTime: 0,
            todayResolved: 0,
          })
          setError('Database connection slow - showing limited data. Please refresh.')
          return
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Admin conversations API response:', data) // Debug log

      if (data.success) {
        setConversations(data.conversations ?? [])
        setStats(data.stats ?? null)
      } else {
        throw new Error(data.error ?? 'Failed to fetch conversations')
      }
    } catch (error) {
      // Enhanced error handling for different error types
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('⚠️ [AdminPanel] Admin conversations request timed out - database connection may be slow')
        setError('Request timed out. Database might be reconnecting. Please wait a moment and try again.')
      } else if (error instanceof Error && (error.message.includes('ESERVFAIL') || error.message.includes('DNS'))) {
        console.error('❌ [AdminPanel] Database DNS/Connection failed:', error)
        setError('Database connection failed. Please check your network and refresh.')
      } else if (error instanceof Error && error.message.includes('Failed query')) {
        console.error('❌ [AdminPanel] Database query failed:', error)
        setError('Database query failed. Please wait for reconnection and try again.')
      } else {
        console.error('❌ [AdminPanel] Unknown error fetching conversations:', error)
        setError(error instanceof Error ? error.message : 'Unknown error - please refresh')
      }

      // Set empty data on error
      setConversations([])
      setStats(null)

      // Auto-retry after 5 seconds for DNS/connection errors (but not for timeouts)
      if (
        error instanceof Error &&
        (error.message.includes('ESERVFAIL') || error.message.includes('Failed query')) &&
        error.name !== 'AbortError'
      ) {
        console.log('🔄 [AdminPanel] Auto-retrying in 3 seconds due to connection error...')
        setTimeout(() => {
          console.log('🔄 [AdminPanel] Auto-retry triggered')
          void fetchConversations()
        }, 3000) // Faster retry for better UX
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Speech recognition functions for admin responses
  const startSpeechRecognition = useCallback(() => {
    if (!browserSupportsSpeechRecognition) return

    resetTranscript()
    setIsUsingSpeech(true)
    void SpeechRecognition.startListening({
      continuous: true,
      language: 'id-ID',
    })
  }, [resetTranscript, browserSupportsSpeechRecognition])

  const stopSpeechRecognition = useCallback(() => {
    void SpeechRecognition.stopListening()
    setIsUsingSpeech(false)
  }, [])

  const toggleSpeechRecognition = useCallback(() => {
    if (listening) {
      stopSpeechRecognition()
    } else {
      startSpeechRecognition()
    }
  }, [listening, startSpeechRecognition, stopSpeechRecognition])

  // Fetch conversations on mount and when panel becomes visible
  useEffect(() => {
    if (isVisible && (role === 'admin' || role === 'superadmin')) {
      void fetchConversations()
    }
  }, [isVisible, role, fetchConversations])

  // WhatsApp-like smart polling: Adaptive intervals based on activity
  useEffect(() => {
    if (!isVisible || (role !== 'admin' && role !== 'superadmin')) return

    let pollInterval = 30000 // Start with 30s for inactive periods
    const activityInterval = 8000 // 8s when there's recent activity

    // Check for recent activity in conversations
    const hasRecentActivity = conversations.some((conv) => {
      const lastMsg = new Date(conv.lastMessageAt).getTime()
      return Date.now() - lastMsg < 60000 // Activity within last minute
    })

    if (hasRecentActivity) {
      pollInterval = activityInterval
    }

    const interval = setInterval(() => {
      // Only fetch if not currently loading to avoid multiple concurrent requests
      if (!isLoading) {
        void fetchConversations()

        // Check if there are active conversations and update accordingly
        conversations.filter((conv) => Date.now() - new Date(conv.lastMessageAt).getTime() < 60000)
      }
    }, pollInterval)

    return () => clearInterval(interval)
  }, [isVisible, role, fetchConversations, isLoading, conversations])

  // Fetch conversation messages when a conversation is selected
  const fetchConversationMessages = useCallback(
    async (conversationId: string, lastMessageId?: number) => {
      setIsPollingMessages(true)
      try {
        // Optimize API call by only fetching new messages if we have a lastMessageId
        const url = lastMessageId
          ? `/api/chat/conversation/${conversationId}/messages?lastMessageId=${lastMessageId}`
          : `/api/chat/conversation/${conversationId}/messages`

        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.status}`)
        }

        const data = await response.json()
        if (data.success && data.messages) {
          if (lastMessageId && data.messages.length === 0) {
            // No new messages, don't update state to avoid unnecessary re-renders
            console.log('📱 [AdminPanel] No new messages found')
            setLastUpdateTime(new Date())
            return
          }

          if (lastMessageId && data.messages.length > 0) {
            // Append new messages to existing ones
            console.log(`📱 [AdminPanel] Found ${data.messages.length} new messages`)
            setConversationMessages((prev) => [...prev, ...data.messages])
          } else {
            // Full refresh (initial load or no lastMessageId)
            setConversationMessages(data.messages)
          }

          setLastUpdateTime(new Date())

          // Check if there's already an LLM recommendation and show it
          const existingRecommendation = data.messages.find(
            (msg: ConversationMessage) => msg.type === 'llm_recommendation',
          )
          if (existingRecommendation && !showRecommendation) {
            console.log('🔍 [AdminPanel] Found existing LLM recommendation, displaying it')
            setLlmRecommendation(existingRecommendation.content)
            setShowRecommendation(true)
          }
        }
      } catch (error) {
        console.error('Error fetching conversation messages:', error)
      } finally {
        setIsPollingMessages(false)
      }
    },
    [showRecommendation],
  )

  // WhatsApp-like smart message polling: More frequent when actively chatting
  useEffect(() => {
    if (!selectedConversation || !isVisible || (role !== 'admin' && role !== 'superadmin')) return

    // Determine polling frequency based on recent message activity
    const lastMessageTime =
      conversationMessages.length > 0
        ? new Date(Math.max(...conversationMessages.map((m) => new Date(m.timestamp).getTime()))).getTime()
        : 0

    const timeSinceLastMessage = Date.now() - lastMessageTime

    // Adaptive intervals: 2s if recent activity, 10s if moderate, 30s if inactive
    let pollingInterval = 30000 // Default: 30s for inactive conversations

    if (timeSinceLastMessage < 30000) {
      pollingInterval = 2000 // 2s for very recent activity (last 30s)
    } else if (timeSinceLastMessage < 300000) {
      pollingInterval = 10000 // 10s for moderate activity (last 5 min)
    }

    console.log(
      `📱 [AdminPanel] Message polling: ${pollingInterval / 1000}s interval (last message: ${timeSinceLastMessage / 1000}s ago)`,
    )

    const interval = setInterval(() => {
      // Get the ID of the last message for optimized polling (only fetch newer messages)
      const lastMessage = conversationMessages.length > 0 ? conversationMessages[conversationMessages.length - 1] : null

      const lastMessageId = lastMessage?.id ? parseInt(lastMessage.id) : undefined

      // Only pass lastMessageId if it's a valid database ID (not a temp ID)
      // Temp IDs are usually timestamps (> 1000000000000) or strings starting with 'temp-'
      const isValidDbId = lastMessageId && !isNaN(lastMessageId) && lastMessageId > 0 && lastMessageId < 2147483647
      const isTempId =
        lastMessage?.id?.toString().startsWith('temp-') ??
        lastMessage?.id?.toString().startsWith('user-') ??
        lastMessage?.id?.toString().startsWith('bot-') ??
        (lastMessageId && lastMessageId > 1000000000000)

      const optimizedLastMessageId = isValidDbId && !isTempId ? lastMessageId : undefined

      console.log(`📱 [AdminPanel] Polling for new messages since ID: ${optimizedLastMessageId ?? 'none (full fetch)'}`)
      void fetchConversationMessages(selectedConversation.id, optimizedLastMessageId)
    }, pollingInterval)

    return () => clearInterval(interval)
  }, [selectedConversation, isVisible, role, fetchConversationMessages, conversationMessages])

  // Handle conversation selection
  const handleConversationSelect = useCallback(
    (conversation: AdminConversation) => {
      setSelectedConversation(conversation)
      void fetchConversationMessages(conversation.id)
      // Reset recommendation states when switching conversations
      setLlmRecommendation('')
      setShowRecommendation(false)
      setCustomResponse('')

      // Trigger auto-generation after a short delay to ensure messages are loaded
      if (serviceMode === 'bot_with_admin_validation') {
        setTimeout(() => {
          console.log('🔄 [AdminPanel] Triggering auto-generation after conversation selection')
        }, 500)
      }
    },
    [fetchConversationMessages, serviceMode],
  )

  // Handle assignment to admin
  const handleAssignToMe = useCallback(
    async (conversationId: string) => {
      // Check if admin user is available
      if (!adminUser?.userId) {
        console.error('Admin user ID not available')
        setError('Admin authentication error. Please refresh the page.')
        return
      }

      setIsResponding(true)
      try {
        console.log('🔧 [DEBUG] handleAssignToMe - sending request:', {
          conversationId,
          adminId: adminUser.userId,
          isLLMRecommendation: false,
          url: `/api/chat/conversation/${conversationId}/messages`,
        })

        const response = await fetch(`/api/chat/conversation/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Admin telah mengambil alih percakapan ini. Bagaimana saya bisa membantu Anda?',
            adminId: adminUser.userId,
            isLLMRecommendation: false,
          }),
        })

        console.log('🔧 [DEBUG] handleAssignToMe - response status:', response.status)

        if (response.ok) {
          // Refresh conversations list
          void fetchConversations()
          // Refresh messages if this conversation is selected
          if (selectedConversation?.id === conversationId) {
            void fetchConversationMessages(conversationId)
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            `Failed to assign conversation: ${response.status} - ${errorData.error ?? response.statusText}`,
          )
        }
      } catch (error) {
        console.error('Error assigning conversation:', error)
        setError(error instanceof Error ? error.message : 'Failed to assign conversation')
      } finally {
        setIsResponding(false)
      }
    },
    [adminUser, selectedConversation, fetchConversations, fetchConversationMessages],
  )

  // Generate LLM recommendation
  const generateLlmRecommendation = useCallback(
    async (conversationId: string) => {
      setIsGeneratingRecommendation(true)

      // Get RAG API URL for error handling
      const ragApiUrl = getRagApiUrl()

      try {
        // Log backend configuration for debugging
        logBackendConfig()

        // Get the last user message to generate recommendation for
        console.log('📋 [AdminPanel] Available conversation messages:', conversationMessages.length)
        console.log(
          '📋 [AdminPanel] Message types:',
          conversationMessages.map((m) => ({ type: m.type, contentLength: m.content?.length || 0 })),
        )

        const userMessages = conversationMessages.filter((msg) => msg.type === 'user')
        console.log('📋 [AdminPanel] Found user messages:', userMessages.length)

        let lastUserMessage = userMessages.slice(-1)[0]?.content

        if (!lastUserMessage) {
          console.error('❌ [AdminPanel] No user message found in conversation')
          console.error(
            '❌ [AdminPanel] All messages:',
            conversationMessages.map((m) => ({ id: m.id, type: m.type, content: m.content?.substring(0, 50) + '...' })),
          )

          // TEMPORARY: Use a test message if no conversation messages found
          console.warn('⚠️ [AdminPanel] Using test message for LLM recommendation')
          lastUserMessage = 'cara bikin ktp'
        }

        if (!lastUserMessage.trim()) {
          console.error('❌ [AdminPanel] User message is empty')
          lastUserMessage = 'cara bikin ktp' // Fallback test message
        }

        console.log('🤖 [AdminPanel] Generating LLM recommendation for conversation:', conversationId)
        console.log('📝 [AdminPanel] Last user message:', lastUserMessage.substring(0, 100) + '...')
        console.log('🌐 [AdminPanel] Using RAG API URL:', ragApiUrl)

        // Use the exact same approach as AI Bot mode
        const requestBody = {
          question: lastUserMessage.trim(),
          session_id: `admin-recommendation-${conversationId}`,
          language: 'id',
          max_sources: 3,
          similarity_threshold: 0.7,
        }

        console.log('📤 [AdminPanel] Request body:', JSON.stringify(requestBody, null, 2))

        // Use the same exact approach as AI Bot mode that works
        const response = await fetch(ragApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        console.log('📥 [AdminPanel] Response status:', response.status, response.statusText)
        console.log('📥 [AdminPanel] Response headers:', Object.fromEntries(response.headers.entries()))

        // Use the same error handling approach as AI Bot mode
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          console.error('❌ [AdminPanel] LLM API Error Response:', errorText)
          console.error('❌ [AdminPanel] Request URL:', ragApiUrl)
          console.error('❌ [AdminPanel] Request body was:', JSON.stringify(requestBody, null, 2))
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        console.log('✅ [AdminPanel] LLM recommendation generated successfully')
        console.log('📋 [AdminPanel] Response data:', data)

        // Use the same response structure as AI Bot mode
        const recommendationText = data.answer ?? 'Maaf, saya tidak dapat memproses pertanyaan Anda saat ini.'

        setLlmRecommendation(recommendationText)
        setShowRecommendation(true)
      } catch (error) {
        console.error('❌ [AdminPanel] Error generating LLM recommendation:', error)
        console.error('❌ [AdminPanel] Error details:', {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : 'No stack trace',
          ragApiUrl,
          currentOrigin: typeof window !== 'undefined' ? window.location.origin : 'server-side',
        })

        // Test backend connectivity when error occurs
        if (typeof window !== 'undefined') {
          fetch(`${ragApiUrl.replace('/api/v1/rag/ask', '/api/v1')}`, { method: 'GET' })
            .then((response) => {
              console.log('🔗 [AdminPanel] Backend connectivity test:', response.status, response.statusText)
            })
            .catch((connectError) => {
              console.error('❌ [AdminPanel] Backend connectivity test failed:', connectError)
            })
        }

        // Enhanced error messaging with backend URL debugging
        let errorMessage = 'Failed to generate LLM recommendation'
        if (error instanceof Error) {
          if (
            error.message.includes('fetch') ||
            error.name === 'TypeError' ||
            error.message.includes('Failed to fetch')
          ) {
            errorMessage = `Network error: Cannot connect to backend at ${ragApiUrl}. Error: ${error.message}`
            console.error('❌ [AdminPanel] Network connection failed. Backend URL:', ragApiUrl)
            console.error('❌ [AdminPanel] Current environment variables:', {
              NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
              NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
              windowLocation: typeof window !== 'undefined' ? window.location.origin : 'server-side',
            })
          } else if (error.message.includes('ECONNREFUSED')) {
            errorMessage = `Backend service is not accessible at ${ragApiUrl}. Please check service status.`
          } else if (error.message.includes('HTTP error')) {
            errorMessage = `Backend API Error: ${error.message} (URL: ${ragApiUrl})`
          } else {
            errorMessage = `Unknown error: ${error.message} (URL: ${ragApiUrl})`
          }
        }

        setError(errorMessage)
      } finally {
        setIsGeneratingRecommendation(false)
      }
    },
    [conversationMessages],
  )

  // Auto-generate LLM recommendation when new user messages arrive in Human Support mode
  useEffect(() => {
    // Use a delay to ensure all state updates are complete
    const autoGenerateTimer = setTimeout(() => {
      console.log('🔍 [AdminPanel] Auto-generate useEffect triggered (delayed)', {
        selectedConversation: !!selectedConversation,
        isVisible,
        role,
        serviceMode,
        messagesCount: conversationMessages.length,
        isGeneratingRecommendation,
      })

      if (!selectedConversation || !isVisible || (role !== 'admin' && role !== 'superadmin')) {
        console.log('⏹️ [AdminPanel] Auto-generate skipped: basic conditions not met')
        return
      }

      if (serviceMode !== 'bot_with_admin_validation') {
        console.log('⏹️ [AdminPanel] Auto-generate skipped: not in Human Support mode, current mode:', serviceMode)
        return
      }

      const hasUserMessage = conversationMessages.some((msg) => msg.type === 'user')
      const hasRecommendation = conversationMessages.some((msg) => msg.type === 'llm_recommendation')

      console.log('🔍 [AdminPanel] Auto-generate conditions check', {
        hasUserMessage,
        hasRecommendation,
        isGeneratingRecommendation,
        messageTypes: conversationMessages.map((m) => m.type),
        conversationId: selectedConversation.id,
      })

      // Auto-generate recommendation if there's a user message but no LLM recommendation yet
      if (hasUserMessage && !hasRecommendation && !isGeneratingRecommendation && !showRecommendation) {
        console.log('🤖 [AdminPanel] Auto-generating LLM recommendation for Human Support mode')
        void generateLlmRecommendation(selectedConversation.id)
      } else {
        console.log('⏹️ [AdminPanel] Auto-generate skipped: conditions not met', {
          hasUserMessage,
          hasRecommendation,
          isGeneratingRecommendation,
          showRecommendation,
          reason: !hasUserMessage
            ? 'no_user_message'
            : hasRecommendation
              ? 'already_has_recommendation'
              : isGeneratingRecommendation
                ? 'currently_generating'
                : showRecommendation
                  ? 'recommendation_already_shown'
                  : 'unknown',
        })
      }
    }, 1000) // 1 second delay to ensure all data is loaded

    return () => clearTimeout(autoGenerateTimer)
  }, [
    conversationMessages,
    selectedConversation,
    serviceMode,
    isVisible,
    role,
    isGeneratingRecommendation,
    showRecommendation,
    generateLlmRecommendation,
  ])

  // Update custom response when speech transcript changes
  useEffect(() => {
    if (transcript.trim() && isUsingSpeech) {
      setCustomResponse(transcript.trim())
    }
  }, [transcript, isUsingSpeech])

  // Handle accepting LLM recommendation
  const handleAcceptRecommendation = useCallback(
    async (conversationId: string) => {
      // Check if admin user is available
      if (!adminUser?.userId) {
        console.error('Admin user ID not available')
        setError('Admin authentication error. Please refresh the page.')
        return
      }

      setIsResponding(true)
      try {
        let messageToSend = ''

        // For bot_with_admin_validation mode: Get the auto-generated LLM response
        if (serviceMode === 'bot_with_admin_validation') {
          const pendingRecommendation = conversationMessages.find((msg) => msg.type === 'llm_recommendation')
          if (!pendingRecommendation) {
            console.error('❌ [AdminPanel] No pending LLM recommendation found for bot_with_admin_validation mode')
            console.log(
              '📋 [AdminPanel] Available message types:',
              conversationMessages.map((m) => m.type),
            )

            // Fallback: Use manually entered recommendation if available
            if (llmRecommendation.trim()) {
              console.log('🔄 [AdminPanel] Using manually entered recommendation as fallback')
              messageToSend = llmRecommendation
            } else {
              console.error('❌ [AdminPanel] No recommendation available - neither auto-generated nor manual')
              setError('No recommendation available to send')
              return
            }
          } else {
            messageToSend = pendingRecommendation.content
            console.log('✅ [AdminPanel] Using auto-generated LLM recommendation')
          }
        } else {
          // For other modes: Use manually generated recommendation
          if (!llmRecommendation.trim()) {
            console.error('❌ [AdminPanel] No manual recommendation provided')
            setError('Please provide a recommendation to send')
            return
          }
          messageToSend = llmRecommendation
          console.log('✅ [AdminPanel] Using manual recommendation')
        }

        console.log('📤 [AdminPanel] Accepting recommendation for conversation:', conversationId)
        console.log('🔧 [DEBUG] handleAcceptRecommendation - sending request:', {
          conversationId,
          adminId: adminUser.userId,
          isLLMRecommendation: true,
          messageLength: messageToSend.length,
          url: `/api/chat/conversation/${conversationId}/messages`,
        })

        const response = await fetch(`/api/chat/conversation/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageToSend,
            adminId: adminUser.userId,
            isLLMRecommendation: false, // Changed to false: when admin approves, it should be sent as admin message
            isApprovingLLMRecommendation: true, // New flag to indicate this is approving an LLM recommendation
          }),
        })

        console.log('🔧 [DEBUG] handleAcceptRecommendation - response status:', response.status)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(`Failed to send message: ${response.status} - ${errorData.error ?? response.statusText}`)
        }

        const result = await response.json()
        if (!result.success) {
          throw new Error(`Message API error: ${result.error ?? 'Unknown error'}`)
        }

        console.log('✅ [AdminPanel] Recommendation accepted successfully')

        // Update conversation status to resolved (no second API call needed)
        console.log('✅ [AdminPanel] Admin response sent via messages API')

        setLlmRecommendation('')
        setShowRecommendation(false)
        setCustomResponse('')

        // Optimistic update: Add message immediately to UI for better UX
        const newMessage: ConversationMessage = {
          id: `temp-${Date.now()}`,
          type: 'admin',
          content: messageToSend,
          timestamp: new Date().toISOString(),
          adminName: 'You',
        }
        setConversationMessages((prev) => [...prev, newMessage])

        // Single async refresh without blocking UI
        setTimeout(() => {
          void fetchConversationMessages(conversationId)
        }, 1000)
      } catch (error) {
        console.error('❌ [AdminPanel] Error accepting recommendation:', error)

        // Show error in UI if needed
        const errorMsg = error instanceof Error ? error.message : 'Failed to accept recommendation'
        setError(errorMsg)
        console.error('Error details:', errorMsg)
      } finally {
        setIsResponding(false)
      }
    },
    [adminUser, serviceMode, conversationMessages, llmRecommendation, fetchConversationMessages],
  )

  // Handle sending custom response
  const handleSendResponse = useCallback(
    async (conversationId: string) => {
      // Check if admin user is available
      if (!adminUser?.userId) {
        console.error('Admin user ID not available')
        setError('Admin authentication error. Please refresh the page.')
        return
      }

      if (!customResponse.trim()) return

      setIsResponding(true)
      try {
        console.log('📤 [AdminPanel] Sending custom response for conversation:', conversationId)
        console.log('🔧 [DEBUG] handleSendResponse - sending request:', {
          conversationId,
          adminId: adminUser.userId,
          isLLMRecommendation: false,
          messageLength: customResponse.length,
          url: `/api/chat/conversation/${conversationId}/messages`,
        })

        const response = await fetch(`/api/chat/conversation/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: customResponse,
            adminId: adminUser.userId,
            isLLMRecommendation: false,
          }),
        })

        console.log('🔧 [DEBUG] handleSendResponse - response status:', response.status)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(`Failed to send message: ${response.status} - ${errorData.error ?? response.statusText}`)
        }

        const result = await response.json()
        if (!result.success) {
          throw new Error(`Message API error: ${result.error ?? 'Unknown error'}`)
        }

        console.log('✅ [AdminPanel] Custom response sent successfully')

        // Update conversation status to resolved (no second API call needed)
        console.log('✅ [AdminPanel] Admin response sent via messages API')

        const responseMessage = customResponse
        setCustomResponse('')
        setLlmRecommendation('')
        setShowRecommendation(false)

        // Optimistic update: Add message immediately to UI for better UX
        const newMessage: ConversationMessage = {
          id: `temp-${Date.now()}`,
          type: 'admin',
          content: responseMessage,
          timestamp: new Date().toISOString(),
          adminName: 'You',
        }
        setConversationMessages((prev) => [...prev, newMessage])

        // Single async refresh without blocking UI
        setTimeout(() => {
          void fetchConversationMessages(conversationId)
        }, 1000)
      } catch (error) {
        console.error('❌ [AdminPanel] Error sending custom response:', error)

        // Show error in UI if needed
        const errorMsg = error instanceof Error ? error.message : 'Failed to send custom response'
        setError(errorMsg)
        console.error('Error details:', errorMsg)
      } finally {
        setIsResponding(false)
      }
    },
    [adminUser, customResponse, fetchConversationMessages],
  )

  // When used as main page (isVisible=true), skip role check as parent already handles it
  // When used as overlay (!isVisible), check role and show button
  if (!isVisible) {
    if (role !== 'admin' && role !== 'superadmin') {
      return null
    }
    return (
      <div className="fixed right-4 bottom-4">
        <Button onClick={() => onVisibilityChange(true)} className="bg-blue-600 text-white shadow-lg hover:bg-blue-700">
          <MessageCircle className="mr-2 h-4 w-4" />
          Admin Panel ({conversations.filter((c) => c.status === 'waiting' || c.status === 'in_progress').length})
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header Section - matching user page style */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900">
                Admin{' '}
                <span className="text-blue-600" style={{ fontFamily: 'cursive' }}>
                  Dashboard
                </span>
              </h1>
            </div>
            <p className="text-gray-600">Kelola komunikasi dan bantuan pengguna dengan efisien</p>
            <div className="mt-6 flex justify-center">
              <ModeSwitcher onModeChange={() => {}} />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area - matching user page style */}
      <div className="mx-auto max-w-7xl px-4 py-8 transition-all duration-300 sm:px-6 lg:px-8">
        {/* Queue Status Card */}
        {stats && (
          <div className="mb-8 rounded-lg border-2 border-gray-300 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Queue Status</h3>
                  <p className="text-sm text-gray-600">
                    {stats.waitingInQueue} waiting • {stats.activeConversations} active
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="border-blue-200 text-blue-700">
                  <Clock className="mr-1 h-3 w-3" />
                  Avg {stats.averageResponseTime}min
                </Badge>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Today: {stats.todayResolved}</p>
                  <p className="text-xs text-gray-500">Total: {stats.totalConversations}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-red-500"></div>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Grid Layout like user page */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left Column - Conversation List */}
          <div>
            <Card className="overflow-hidden border-2 border-gray-300">
              <CardHeader className="border-b border-blue-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-gray-800">
                    <MessageCircle className="h-5 w-5" />
                    Active Conversations
                  </CardTitle>
                  <Button
                    onClick={() => void fetchConversations()}
                    variant="ghost"
                    size="sm"
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3 p-4">
                    {isLoading ? (
                      <div className="py-8 text-center text-gray-500">
                        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                        <p>Loading conversations...</p>
                        <p className="mt-2 text-xs text-gray-400">This may take up to 10 seconds</p>
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="py-8 text-center text-gray-500">
                        <MessageCircle className="mx-auto mb-3 h-12 w-12 opacity-50" />
                        <p>No conversations found</p>
                      </div>
                    ) : (
                      conversations.map((conversation) => {
                        const isUrgent = conversation.waitTime > 10
                        const statusColor =
                          {
                            waiting: 'bg-blue-100 text-blue-800',
                            in_progress: 'bg-indigo-100 text-indigo-800',
                            active: 'bg-green-100 text-green-800',
                            resolved: 'bg-gray-100 text-gray-800',
                          }[conversation.status] || 'bg-gray-100 text-gray-800'

                        return (
                          <Card
                            key={conversation.id}
                            className={`cursor-pointer transition-all duration-200 ${
                              isUrgent
                                ? 'border-red-200 bg-red-50'
                                : selectedConversation?.id === conversation.id
                                  ? 'scale-[1.02] border-blue-500 bg-blue-200 shadow-lg ring-2 ring-blue-500'
                                  : 'border-blue-100 bg-blue-50 hover:scale-[1.01] hover:bg-blue-100'
                            }`}
                            onClick={() => handleConversationSelect(conversation)}
                          >
                            <CardContent className="p-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge className={statusColor}>{conversation.status}</Badge>
                                    {(() => {
                                      const serviceModeInfo = getServiceModeInfo(conversation.serviceMode)
                                      const ServiceModeIcon = serviceModeInfo.icon
                                      return (
                                        <Badge
                                          variant="outline"
                                          className={`flex items-center gap-1 text-xs ${serviceModeInfo.color}`}
                                        >
                                          <ServiceModeIcon className="h-3 w-3" />
                                          {serviceModeInfo.label}
                                        </Badge>
                                      )
                                    })()}
                                    {conversation.priority !== 'normal' && (
                                      <Badge variant="outline" className="text-xs">
                                        {conversation.priority}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500">Wait: {conversation.waitTime}min</div>
                                </div>

                                <div>
                                  <p className="text-sm font-medium text-gray-900">{conversation.userName}</p>
                                  <p className="mt-1 line-clamp-2 text-xs text-gray-600">{conversation.lastMessage}</p>
                                </div>

                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <div className="flex items-center gap-2">
                                    <MessageCircle className="h-3 w-3" />
                                    <span>{conversation.messageCount} messages</span>
                                  </div>
                                  <span>{new Date(conversation.lastMessageAt).toLocaleTimeString()}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Conversation Details */}
          <div>
            <Card className="border-2 border-gray-300">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-gray-800">
                  <Users className="h-5 w-5" />
                  Conversation Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {selectedConversation ? (
                  <div className="space-y-6">
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-gray-900">
                        {selectedConversation.userName || 'Unknown User'}
                      </h4>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>
                          Status: <Badge className="ml-2">{selectedConversation.status}</Badge>
                        </p>
                        <p>Messages: {selectedConversation.messageCount}</p>
                        <p>Wait Time: {selectedConversation.waitTime} min</p>
                      </div>
                    </div>

                    {/* Conversation Messages */}
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
                        Recent Messages:
                        <span className="text-xs text-gray-400">(scroll to see more)</span>
                      </h4>
                      <ScrollArea className="h-24 rounded border bg-gray-100 p-2">
                        {conversationMessages.length > 0 ? (
                          <div className="space-y-2">
                            {conversationMessages.slice(-3).map((msg) => (
                              <div key={msg.id} className="text-xs">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {msg.type}
                                  </Badge>
                                  <span className="text-gray-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                  {msg.adminName && <span className="text-green-600">• {msg.adminName}</span>}
                                </div>
                                <p className="mt-1 text-gray-700">{msg.content}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Loading messages...</p>
                        )}
                      </ScrollArea>
                    </div>

                    {/* Admin Actions */}
                    <div className="flex gap-2">
                      {/* Only show assign button for Human Support mode */}
                      {selectedConversation.serviceMode === 'bot_with_admin_validation' && (
                        <>
                          {selectedConversation.assignedAdminId === null ? (
                            <Button
                              onClick={() => void handleAssignToMe(selectedConversation.id)}
                              disabled={isResponding}
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                              size="sm"
                            >
                              <Users className="mr-1 h-3 w-3" />
                              Assign
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 border-blue-300 text-blue-700"
                              disabled
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Assigned
                            </Button>
                          )}
                        </>
                      )}
                      <Button
                        onClick={() => void fetchConversations()}
                        variant="outline"
                        size="sm"
                        className="border-gray-300"
                        title="Refresh conversations"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* LLM Recommendation System - Context-aware based on service mode */}
                    <div className="space-y-3">
                      {/* For bot_with_admin_validation mode: Show auto-generated LLM recommendation */}
                      {serviceMode === 'bot_with_admin_validation' && (
                        <>
                          {/* Check if there's a pending LLM recommendation in conversation messages */}
                          {(() => {
                            const pendingRecommendation = conversationMessages.find(
                              (msg) => msg.type === 'llm_recommendation',
                            )

                            if (pendingRecommendation) {
                              return (
                                <div className="space-y-2">
                                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                    <div className="mb-2 flex items-center gap-2">
                                      <Bot className="h-4 w-4 text-blue-600" />
                                      <span className="text-sm font-medium text-blue-800">
                                        Auto-Generated LLM Response:
                                      </span>
                                    </div>
                                    <p className="text-sm text-blue-900">{pendingRecommendation.content}</p>
                                  </div>

                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => void handleAcceptRecommendation(selectedConversation.id)}
                                      disabled={isResponding}
                                      className="flex-1 bg-green-600 hover:bg-green-700"
                                      size="sm"
                                    >
                                      <ThumbsUp className="mr-1 h-3 w-3" />
                                      {isResponding ? 'Sending...' : 'Approve & Send to User'}
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        // Instead of just hiding, we'll show manual response area
                                        setShowRecommendation(false)
                                        setLlmRecommendation('')
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="border-red-300 text-red-700 hover:bg-red-50"
                                    >
                                      <ThumbsDown className="mr-1 h-3 w-3" />
                                      Reject & Write Manual
                                    </Button>
                                  </div>
                                </div>
                              )
                            } else {
                              return (
                                <div className="rounded border border-dashed p-3 text-center text-sm text-gray-500">
                                  No pending LLM recommendation found. User hasn&apos;t sent a new message yet.
                                </div>
                              )
                            }
                          })()}
                        </>
                      )}

                      {/* Full LLM Bot Mode - Show informational message */}
                      {serviceMode === 'full_llm_bot' && (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                          <div className="mb-2 flex items-center justify-center gap-2">
                            <Bot className="h-5 w-5 text-green-600" />
                            <span className="font-medium text-green-800">AI Bot Mode</span>
                          </div>
                          <p className="text-sm text-green-700">
                            Responses are automatically sent to users without admin approval.
                          </p>
                          <p className="mt-1 text-xs text-green-600">
                            No admin intervention required. Switch to &quot;Human Support&quot; mode if you need to
                            validate responses.
                          </p>
                        </div>
                      )}

                      {/* Manual Response Area - Only for Human Support mode */}
                      {serviceMode === 'bot_with_admin_validation' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Users className="h-3 w-3" />
                            <span>Or write custom response:</span>
                          </div>

                          {/* Textarea with speech button */}
                          <div className="relative">
                            <Textarea
                              placeholder={listening ? 'Listening...' : 'Type your manual response or use speech...'}
                              value={customResponse}
                              onChange={(e) => setCustomResponse(e.target.value)}
                              rows={2}
                              className="pr-12 text-sm"
                            />
                            {browserSupportsSpeechRecognition && (
                              <Button
                                type="button"
                                onClick={toggleSpeechRecognition}
                                className={`absolute top-2 right-2 h-8 w-8 p-0 ${
                                  listening ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                                size="sm"
                              >
                                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>

                          {/* Speech status indicator */}
                          {listening && (
                            <div className="flex items-center gap-2 text-xs text-red-600">
                              <div className="h-2 w-2 animate-pulse rounded-full bg-red-600"></div>
                              <span>Recording... Click the microphone to stop</span>
                            </div>
                          )}

                          <Button
                            onClick={() => void handleSendResponse(selectedConversation.id)}
                            disabled={!customResponse.trim() || isResponding}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            size="sm"
                          >
                            <Send className="mr-1 h-3 w-3" />
                            {isResponding ? 'Sending...' : 'Send Manual Response'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-gray-500">
                    <div className="mb-4">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100">
                        <MessageCircle className="h-8 w-8 text-gray-400" />
                      </div>
                    </div>
                    <p className="font-medium">Select a conversation</p>
                    <p className="mt-1 text-sm">Choose a conversation to view details and manage responses</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* WhatsApp-like Real-time Status Indicator */}
      <div className="fixed right-4 bottom-4 z-50">
        {isPollingMessages && (
          <div className="rounded-lg border border-green-200 bg-green-100 px-3 py-2 shadow-lg dark:border-green-700 dark:bg-green-900">
            <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
              Checking for new messages...
            </div>
          </div>
        )}

        {lastUpdateTime && !isPollingMessages && (
          <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="h-1.5 w-1.5 rounded-full bg-gray-400"></div>
              Last updated: {lastUpdateTime.toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
