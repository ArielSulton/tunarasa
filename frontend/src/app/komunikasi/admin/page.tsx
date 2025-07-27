'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminOnly } from '@/components/auth/auth-components'
import { ServiceModeToggle } from '@/components/admin/ServiceModeToggle'
import { SpeechToText } from '@/components/speech/SpeechToText'
import { useServiceMode } from '@/lib/hooks/use-service-config'
import {
  Send,
  User,
  Bot,
  Settings,
  Users,
  MessageSquare,
  Clock,
  Mic,
  MicOff,
  Lightbulb,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  Timer,
} from 'lucide-react'

interface ChatMessage {
  id: string
  type: 'user' | 'admin' | 'llm_recommendation' | 'system'
  content: string
  timestamp: Date
  confidence?: number
  adminName?: string
  inputMethod?: string
}

interface Conversation {
  id: string
  userId: string
  userName: string
  status: 'waiting' | 'in_progress' | 'resolved'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  lastMessage: string
  lastMessageAt: Date
  queuedAt: Date
  messageCount: number
  waitTime: number
}

interface SessionStats {
  totalConversations: number
  activeConversations: number
  waitingInQueue: number
  averageResponseTime: number
  averageResolutionTime: number
  todayResolved: number
}

interface LLMRecommendation {
  id: string
  content: string
  confidence: number
  context: string
}

export default function AdminKomunikasi() {
  const { serviceMode } = useServiceMode()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [usingSpeech, setUsingSpeech] = useState(false)
  const [llmRecommendations, setLlmRecommendations] = useState<LLMRecommendation[]>([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  const [stats, setStats] = useState<SessionStats>({
    totalConversations: 0,
    activeConversations: 0,
    waitingInQueue: 0,
    averageResponseTime: 0,
    averageResolutionTime: 0,
    todayResolved: 0,
  })

  // Load conversations in queue
  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/admin/conversations')
      const data = await response.json()

      if (data.success) {
        setConversations(data.conversations)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    }
  }, [])

  // Load messages for selected conversation
  const loadConversationMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/chat/conversation/${conversationId}/messages`)
      const data = await response.json()

      if (data.success) {
        setMessages(data.messages ?? [])
      }
    } catch (error) {
      console.error('Error loading conversation messages:', error)
    }
  }, [])

  // Get LLM recommendations for user message
  const getLLMRecommendations = useCallback(async (userMessage: string) => {
    setLoadingRecommendations(true)
    try {
      const response = await fetch('http://localhost:8000/api/v1/rag/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage,
          session_id: `admin-recommendation-${Date.now()}`,
          language: 'id',
          max_sources: 3,
          similarity_threshold: 0.7,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setLlmRecommendations([
          {
            id: Date.now().toString(),
            content: data.answer,
            confidence: data.confidence ?? 0.8,
            context: data.context ?? '',
          },
        ])
      }
    } catch (error) {
      console.error('Error getting LLM recommendations:', error)
    } finally {
      setLoadingRecommendations(false)
    }
  }, [])

  // Load data on mount and when service mode changes
  useEffect(() => {
    if (serviceMode === 'human_cs_support') {
      void loadConversations()
      const interval = setInterval(() => {
        void loadConversations()
      }, 10000) // Refresh every 10 seconds
      return () => clearInterval(interval)
    }
  }, [serviceMode, loadConversations])

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      void loadConversationMessages(selectedConversation.id)
    }
  }, [selectedConversation, loadConversationMessages])

  // Get LLM recommendations for latest user message
  useEffect(() => {
    if (selectedConversation && messages.length > 0) {
      const latestUserMessage = messages
        .slice()
        .reverse()
        .find((m) => m.type === 'user')
      if (latestUserMessage && !llmRecommendations.length) {
        void getLLMRecommendations(latestUserMessage.content)
      }
    }
  }, [selectedConversation, messages, llmRecommendations.length, getLLMRecommendations])

  // Handle conversation selection
  const selectConversation = useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation)
    setLlmRecommendations([]) // Clear previous recommendations
  }, [])

  // Send admin response
  const sendAdminResponse = useCallback(
    async (content: string) => {
      if (!content.trim() || !selectedConversation) return

      setIsProcessing(true)

      try {
        const response = await fetch(`/api/chat/conversation/${selectedConversation.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: content.trim(),
            adminId: 1, // In real app, get from current user
          }),
        })

        if (response.ok) {
          const data = await response.json()

          // Add message to local state
          const adminMessage: ChatMessage = {
            id: data.messageId.toString(),
            type: 'admin',
            content: content.trim(),
            timestamp: new Date(),
            adminName: data.adminName,
          }

          setMessages((prev) => [...prev, adminMessage])
          setInputMessage('')

          // Refresh conversation list
          void loadConversations()
        }
      } catch (error) {
        console.error('Error sending admin response:', error)
      } finally {
        setIsProcessing(false)
      }
    },
    [selectedConversation, loadConversations],
  )

  // Apply LLM recommendation
  const applyLLMRecommendation = (recommendation: LLMRecommendation) => {
    setInputMessage(recommendation.content)
  }

  // Handle speech input
  const handleSpeechResult = useCallback((text: string) => {
    setInputMessage(text)
    setUsingSpeech(false)
  }, [])

  // Send message handlers
  const handleSendMessage = useCallback(() => {
    if (inputMessage.trim()) {
      void sendAdminResponse(inputMessage)
    }
  }, [inputMessage, sendAdminResponse])

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSendMessage()
      }
    },
    [handleSendMessage],
  )

  // Resolve conversation
  const resolveConversation = useCallback(async () => {
    if (!selectedConversation) return

    try {
      const response = await fetch(`/api/chat/conversation/${selectedConversation.id}/resolve`, {
        method: 'POST',
      })

      if (response.ok) {
        setSelectedConversation(null)
        setMessages([])
        void loadConversations()
      }
    } catch (error) {
      console.error('Error resolving conversation:', error)
    }
  }, [selectedConversation, loadConversations])

  return (
    <AdminOnly>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <section className="bg-gradient-to-r from-purple-50 to-purple-100 py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="mb-2 text-3xl font-bold text-gray-900">
                Panel <span className="text-purple-600">Administrator</span>
              </h1>
              <p className="text-gray-600">
                {serviceMode === 'human_cs_support'
                  ? 'Customer Support Dashboard - Manage user conversations'
                  : 'System Monitoring Dashboard'}
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {serviceMode !== 'human_cs_support' ? (
            <div className="space-y-8">
              <ServiceModeToggle />
              <div className="py-12 text-center text-gray-500">
                <Settings className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <p className="text-lg">Switch to Human CS Support mode to manage user conversations.</p>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="conversations" className="space-y-6">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="conversations">Conversations</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
                <Button variant="outline" onClick={() => void loadConversations()} className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>

              <TabsContent value="settings">
                <ServiceModeToggle />
              </TabsContent>

              <TabsContent value="conversations">
                <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
                  {/* Left Panel - Statistics & Conversations */}
                  <div className="space-y-6 xl:col-span-1">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Clock className="mx-auto mb-2 h-6 w-6 text-orange-600" />
                          <div className="text-xl font-bold text-gray-900">{stats.waitingInQueue}</div>
                          <p className="text-xs text-gray-600">Menunggu</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4 text-center">
                          <MessageSquare className="mx-auto mb-2 h-6 w-6 text-blue-600" />
                          <div className="text-xl font-bold text-gray-900">{stats.activeConversations}</div>
                          <p className="text-xs text-gray-600">Aktif</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4 text-center">
                          <CheckCircle className="mx-auto mb-2 h-6 w-6 text-green-600" />
                          <div className="text-xl font-bold text-gray-900">{stats.todayResolved}</div>
                          <p className="text-xs text-gray-600">Selesai Hari Ini</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4 text-center">
                          <Timer className="mx-auto mb-2 h-6 w-6 text-purple-600" />
                          <div className="text-xl font-bold text-gray-900">{stats.averageResponseTime}m</div>
                          <p className="text-xs text-gray-600">Avg Response</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Conversation Queue */}
                    <Card className="h-[500px]">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Users className="h-5 w-5" />
                          Conversation Queue ({conversations.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="h-[420px]">
                          <div className="space-y-2 p-4">
                            {conversations.length === 0 ? (
                              <div className="py-8 text-center text-gray-500">
                                <MessageSquare className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                                <p className="text-sm">No conversations in queue</p>
                              </div>
                            ) : (
                              conversations.map((conversation) => (
                                <Card
                                  key={conversation.id}
                                  className={`cursor-pointer transition-all hover:bg-gray-50 ${
                                    selectedConversation?.id === conversation.id
                                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                      : 'border-gray-200'
                                  }`}
                                  onClick={() => selectConversation(conversation)}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="mb-1 flex items-center gap-2">
                                          <span className="text-sm font-medium text-gray-900">
                                            {conversation.userName || 'User'}
                                          </span>
                                          <Badge
                                            className={
                                              {
                                                waiting: 'bg-orange-100 text-orange-800',
                                                in_progress: 'bg-blue-100 text-blue-800',
                                                resolved: 'bg-green-100 text-green-800',
                                              }[conversation.status]
                                            }
                                          >
                                            {conversation.status}
                                          </Badge>
                                          {conversation.priority !== 'normal' && (
                                            <Badge variant="outline" className="text-xs">
                                              {conversation.priority}
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="line-clamp-2 text-xs text-gray-600">{conversation.lastMessage}</p>
                                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                                          <span>{conversation.messageCount} messages</span>
                                          <span>{Math.round(conversation.waitTime)}m ago</span>
                                        </div>
                                      </div>
                                      <ArrowRight className="h-4 w-4 text-gray-400" />
                                    </div>
                                  </CardContent>
                                </Card>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Panel - Chat Interface */}
                  <div className="xl:col-span-2">
                    {!selectedConversation ? (
                      <Card className="flex h-[600px] items-center justify-center">
                        <div className="text-center text-gray-500">
                          <MessageSquare className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                          <p className="mb-2 text-lg font-medium">Select a conversation</p>
                          <p className="text-sm">Choose a conversation from the queue to start responding</p>
                        </div>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {/* Conversation Header */}
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-medium text-gray-900">
                                  Conversation with {selectedConversation.userName || 'User'}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  Started {Math.round(selectedConversation.waitTime)} minutes ago
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={
                                    {
                                      waiting: 'bg-orange-100 text-orange-800',
                                      in_progress: 'bg-blue-100 text-blue-800',
                                      resolved: 'bg-green-100 text-green-800',
                                    }[selectedConversation.status]
                                  }
                                >
                                  {selectedConversation.status}
                                </Badge>
                                {selectedConversation.status !== 'resolved' && (
                                  <Button
                                    onClick={() => void resolveConversation()}
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Resolve
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                          {/* Chat Messages */}
                          <div className="lg:col-span-2">
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <MessageSquare className="h-5 w-5" />
                                  Messages
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-0">
                                <ScrollArea className="h-[400px] p-4">
                                  <div className="space-y-4">
                                    {messages.map((message) => (
                                      <div
                                        key={message.id}
                                        className={`flex gap-3 ${
                                          message.type === 'admin' ? 'justify-end' : 'justify-start'
                                        }`}
                                      >
                                        <div
                                          className={`flex max-w-[80%] gap-2 ${
                                            message.type === 'admin' ? 'flex-row-reverse' : 'flex-row'
                                          }`}
                                        >
                                          <div className="flex-shrink-0">
                                            {message.type === 'user' ? (
                                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white">
                                                <User className="h-4 w-4" />
                                              </div>
                                            ) : message.type === 'admin' ? (
                                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white">
                                                <Users className="h-4 w-4" />
                                              </div>
                                            ) : (
                                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-600 text-white">
                                                <Bot className="h-4 w-4" />
                                              </div>
                                            )}
                                          </div>

                                          <div
                                            className={`rounded-lg px-4 py-2 ${
                                              message.type === 'admin'
                                                ? 'bg-green-600 text-white'
                                                : message.type === 'llm_recommendation'
                                                  ? 'border border-yellow-200 bg-yellow-50 text-yellow-800'
                                                  : 'bg-gray-100 text-gray-800'
                                            }`}
                                          >
                                            <p className="text-sm">{message.content}</p>
                                            <div className="mt-1 flex items-center justify-between text-xs opacity-70">
                                              <span>{message.timestamp.toLocaleTimeString()}</span>
                                              <div className="flex items-center gap-2">
                                                {message.adminName && <span>- {message.adminName}</span>}
                                                {message.inputMethod && (
                                                  <span className="capitalize">({message.inputMethod})</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </CardContent>
                            </Card>
                          </div>

                          {/* LLM Recommendations */}
                          <div>
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-sm">
                                  <Lightbulb className="h-4 w-4" />
                                  AI Suggestions
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {loadingRecommendations ? (
                                  <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    Loading suggestions...
                                  </div>
                                ) : llmRecommendations.length === 0 ? (
                                  <p className="text-sm text-gray-500">No suggestions available</p>
                                ) : (
                                  llmRecommendations.map((rec) => (
                                    <div key={rec.id} className="space-y-2">
                                      <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
                                        <p className="text-sm text-gray-800">{rec.content}</p>
                                        <div className="mt-2 flex items-center justify-between">
                                          <span className="text-xs text-gray-600">
                                            Confidence: {Math.round(rec.confidence * 100)}%
                                          </span>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => applyLLMRecommendation(rec)}
                                            className="text-xs"
                                          >
                                            Use
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        </div>

                        {/* Response Input */}
                        <Card>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Your Response</span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setUsingSpeech(!usingSpeech)}
                                    className={usingSpeech ? 'bg-blue-50 text-blue-700' : ''}
                                  >
                                    {usingSpeech ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </div>

                              {usingSpeech ? (
                                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4">
                                  <SpeechToText
                                    onSpeechResult={handleSpeechResult}
                                    language="id-ID"
                                    continuous={false}
                                  />
                                </div>
                              ) : (
                                <Textarea
                                  placeholder="Type your response to the user..."
                                  value={inputMessage}
                                  onChange={(e) => setInputMessage(e.target.value)}
                                  onKeyPress={handleKeyPress}
                                  className="min-h-[100px] resize-none"
                                  disabled={selectedConversation.status === 'resolved'}
                                />
                              )}

                              <div className="flex justify-end">
                                <Button
                                  onClick={handleSendMessage}
                                  disabled={
                                    !inputMessage.trim() || isProcessing || selectedConversation.status === 'resolved'
                                  }
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Send className="mr-2 h-4 w-4" />
                                  {isProcessing ? 'Sending...' : 'Send Response'}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </AdminOnly>
  )
}
