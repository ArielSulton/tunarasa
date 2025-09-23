'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GestureRecognition } from '@/components/gesture/gesture-recognition'
import { SpeechToText } from '@/components/speech/SpeechToText'
import { ConversationEnhancements } from '@/components/komunikasi/ConversationEnhancements'
import { useServiceConfig } from '@/hooks/use-service-config'
import { User, Bot, MessageCircle, Mic, HandMetal, RotateCcw, Clock, Users, AlertCircle } from 'lucide-react'
import { getRagApiUrl } from '@/lib/utils/backend'
import { ChatMessage, ConversationStatus } from '@/types'

interface BackendMessage {
  id: string
  type: 'user' | 'assistant' | 'admin' | 'system' | 'llm_recommendation'
  content: string
  timestamp: string
  adminName?: string
}

type CommunicationMode = 'sibi' | 'speech'

interface ChatInterfaceProps {
  institutionId: number
  institutionName: string
  institutionSlug: string
}

export function ChatInterface({ institutionId, institutionName, institutionSlug }: ChatInterfaceProps) {
  const { serviceMode, loading: serviceModeLoading } = useServiceConfig()
  const [mode, setMode] = useState<CommunicationMode>('sibi')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [correctedQuestion, setCorrectedQuestion] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>({
    id: '',
    status: 'active',
  })
  const [sessionId] = useState(() => `chat-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const [conversationEnded, setConversationEnded] = useState(false)
  const [inputSource, setInputSource] = useState<'text' | 'gesture' | 'speech'>('text')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatScrollAreaRef = useRef<HTMLDivElement>(null)

  const handleLetterDetected = useCallback((letter: string) => {
    console.log('Letter detected:', letter)
  }, [])

  const handleWordFormed = useCallback((word: string) => {
    setCurrentQuestion(word)
    setInputSource('gesture')
    console.log('Word formed:', word)
  }, [])

  const handleSpeechResult = useCallback((text: string) => {
    console.log('🗣️ handleSpeechResult called with:', text)
    setCurrentQuestion(text)
    setInputSource('speech')
    console.log('🗣️ currentQuestion updated to:', text)
  }, [])

  // Function to perform typo correction
  const correctTypo = useCallback(
    async (text: string): Promise<string> => {
      if (!text || text.trim().length === 0) return text

      try {
        const cleanedSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 255)

        const response = await fetch('/api/backend/api/v1/rag/ask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: text.trim(),
            session_id: cleanedSessionId,
            language: 'id',
            conversation_mode: 'casual',
            // Add typo correction flag to backend
            typo_correction_only: true,
            // Use the tracked input source
            input_source: inputSource,
          }),
        })

        if (!response.ok) {
          console.warn('Typo correction failed:', response.status)
          return text // Return original text if correction fails
        }

        const result = await response.json()
        const correctedText = result.question ?? text // Backend returns corrected question

        // Only return corrected text if it actually changed
        if (correctedText !== text && correctedText.length > 0) {
          console.log('✅ Typo corrected:', { original: text, corrected: correctedText })
          return correctedText
        }

        return text
      } catch (error) {
        console.error('Error in typo correction:', error)
        return text // Return original text if error occurs
      }
    },
    [sessionId, inputSource],
  )

  // Update currentQuestion with typo correction when text changes
  useEffect(() => {
    if (currentQuestion && currentQuestion.length > 2) {
      const timeoutId = setTimeout(() => {
        void (async () => {
          const corrected = await correctTypo(currentQuestion)
          if (corrected !== currentQuestion) {
            setCorrectedQuestion(corrected)
          } else {
            setCorrectedQuestion(null)
          }
        })()
      }, 1000) // Debounce typo correction

      return () => clearTimeout(timeoutId)
    } else {
      setCorrectedQuestion(null)
    }
  }, [currentQuestion, correctTypo])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      // Use corrected text if available, otherwise use original
      const finalContent = correctedQuestion ?? content.trim()

      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        type: 'user',
        content: finalContent, // Display corrected text in chat
        timestamp: new Date(),
        status: 'sending',
      }

      setMessages((prev) => [...prev, userMessage])
      setIsProcessing(true)

      // Reset conversation status to allow continued conversation
      if (conversationStatus.status === 'resolved') {
        console.log('🔄 [User] Resetting conversation status from resolved to waiting for new message')
        setConversationStatus((prev) => ({ ...prev, status: 'waiting' }))
      }

      try {
        if (serviceMode === 'full_llm_bot') {
          // Use institution-specific RAG endpoint
          const requestBody = {
            question: finalContent, // Send corrected text to backend
            session_id: sessionId,
            language: 'id',
            max_sources: 3,
            similarity_threshold: 0.7,
            // Pass institution information for RAG namespace filtering
            institution_id: institutionId,
            institution_slug: institutionSlug,
            // Use the tracked input source
            input_source: inputSource,
          }

          console.log('🏢 [ChatInterface] Sending RAG request:', {
            institution_id: institutionId,
            institution_slug: institutionSlug,
            endpoint: getRagApiUrl(),
            question: content.trim().substring(0, 50) + '...',
          })

          const ragUrl = getRagApiUrl()
          console.log('🔄 [Chat] Sending request to:', ragUrl)
          console.log('🔄 [Chat] Request body:', requestBody)

          const response = await fetch(ragUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          })

          if (!response.ok) {
            // Try to get detailed error from backend proxy
            let errorDetails = `HTTP error! status: ${response.status}`
            try {
              const errorData = await response.json()
              console.error('❌ [Chat] Backend error details:', errorData)
              errorDetails = errorData.details ?? errorData.error ?? errorDetails
            } catch (e) {
              console.error('❌ [Chat] Could not parse error response:', e)
            }
            throw new Error(errorDetails)
          }

          const data = await response.json()

          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: data.answer ?? 'Maaf, saya tidak dapat memproses pertanyaan Anda saat ini.',
            timestamp: new Date(),
          }

          setMessages((prev) => [...prev.slice(0, -1), { ...userMessage, status: 'delivered' }, assistantMessage])

          // Note: QA logging for full_llm_bot mode is handled automatically by the RAG backend endpoint
        } else if (serviceMode === 'bot_with_admin_validation') {
          // Use institution-specific admin validation endpoint
          const response = await fetch('/api/chat/send-message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: finalContent, // Send corrected text to backend
              sessionId,
              serviceMode: 'bot_with_admin_validation',
              inputMethod: mode === 'sibi' ? 'gesture' : 'speech',
              // Pass institution information for proper conversation tracking
              institution_id: institutionId,
              institution_slug: institutionSlug,
            }),
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const data = await response.json()

          setConversationStatus({
            id: data.conversationId,
            status: 'waiting',
          })

          setMessages((prev) => [...prev.slice(0, -1), { ...userMessage, status: 'delivered' }])

          const systemMessage: ChatMessage = {
            id: (Date.now() + 2).toString(),
            type: 'system',
            content:
              'Pesan Anda telah diterima. AI sedang memproses jawaban dan menunggu persetujuan admin sebelum dikirim kepada Anda.',
            timestamp: new Date(),
          }

          setMessages((prev) => [...prev, systemMessage])
        } else {
          throw new Error(`Unknown service mode: ${String(serviceMode)}`)
        }
      } catch (error) {
        console.error('Error sending message:', error)

        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'system',
          content: 'Maaf, saya mengalami masalah koneksi. Silakan coba lagi nanti.',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev.slice(0, -1), { ...userMessage, status: 'sent' }, errorMessage])
      } finally {
        setIsProcessing(false)
      }
    },
    [
      serviceMode,
      sessionId,
      mode,
      conversationStatus.status,
      institutionId,
      institutionSlug,
      correctedQuestion,
      inputSource,
    ],
  )

  const scrollToBottom = useCallback(() => {
    if (messages.length === 0) return

    try {
      if (chatScrollAreaRef.current) {
        const scrollContainer = chatScrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollContainer) {
          const isAtBottom =
            scrollContainer.scrollTop >= scrollContainer.scrollHeight - scrollContainer.clientHeight - 50
          if (!isAtBottom) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: 'smooth',
            })
          }
        }
      }
    } catch (error) {
      console.warn('Scroll error:', error)
    }
  }, [messages.length])

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [messages, scrollToBottom])

  const startConversation = useCallback(() => {
    if (currentQuestion.trim()) {
      void sendMessage(currentQuestion)
      setCurrentQuestion('')
      setCorrectedQuestion(null)
      setInputSource('text') // Reset to default after sending
    }
  }, [currentQuestion, sendMessage])

  const endConversation = useCallback(() => {
    if (messages.length > 0) {
      setConversationEnded(true)
    } else {
      setMessages([])
      setCurrentQuestion('')
      setConversationEnded(false)
    }
  }, [messages])

  const startNewConversation = useCallback(() => {
    setMessages([])
    setCurrentQuestion('')
    setConversationEnded(false)
    setConversationStatus({ id: '', status: 'active' })
    setInputSource('text')
  }, [])

  const resetDetectedInput = useCallback(() => {
    console.log('🗑️ Reset all detected input states for mode:', mode)
    setCurrentQuestion('')
    setCorrectedQuestion(null)
    setInputSource('text')

    // Force component remount to reset internal states
    setResetKey((prev) => prev + 1)
  }, [mode])

  // Polling for admin responses (similar to original implementation)
  useEffect(() => {
    if (serviceMode === 'bot_with_admin_validation' && conversationStatus.id && !conversationEnded) {
      const pollForUpdates = async () => {
        try {
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
          let lastMessageId: number | null = null
          if (lastMessage && !lastMessage.id.startsWith('temp-')) {
            const parsed = parseInt(lastMessage.id)
            if (
              !isNaN(parsed) &&
              parsed > 0 &&
              parsed < 2147483647 &&
              !lastMessage.id.startsWith('user-') &&
              !lastMessage.id.startsWith('bot-')
            ) {
              lastMessageId = parsed
            }
          }

          const url = lastMessageId
            ? `/api/chat/conversation/${conversationStatus.id}/messages?lastMessageId=${lastMessageId}`
            : `/api/chat/conversation/${conversationStatus.id}/messages`

          const response = await fetch(url)
          if (response.ok) {
            const data = await response.json()

            if (data.newMessages && data.newMessages.length > 0) {
              const formattedMessages: ChatMessage[] = data.newMessages
                .filter((msg: BackendMessage) => msg.type !== 'llm_recommendation')
                .map((msg: BackendMessage) => ({
                  id: msg.id,
                  type: msg.type === 'admin' ? 'admin' : msg.type,
                  content: msg.content,
                  timestamp: new Date(msg.timestamp),
                  adminName: msg.adminName,
                }))
              setMessages((prev) => [...prev, ...formattedMessages])
            }

            if (!lastMessageId && data.messages && data.messages.length > 0) {
              const formattedMessages: ChatMessage[] = (data.messages as BackendMessage[])
                .filter((msg) => msg.type !== 'llm_recommendation')
                .map((msg) => ({
                  id: msg.id,
                  type: msg.type === 'admin' ? 'admin' : msg.type,
                  content: msg.content,
                  timestamp: new Date(msg.timestamp),
                  adminName: msg.adminName,
                }))
              setMessages(formattedMessages)
            }

            if (data.status && data.status !== conversationStatus.status) {
              setConversationStatus((prev) => ({ ...prev, status: data.status }))
            }
          }
        } catch (error) {
          console.error('Error polling for updates:', error)
        }
      }

      const interval = setInterval(() => {
        void pollForUpdates()
      }, 3000)

      return () => clearInterval(interval)
    }
  }, [serviceMode, conversationStatus.id, conversationStatus.status, conversationEnded, messages])

  const getServiceModeDisplay = () => {
    if (serviceModeLoading) return { text: 'Memuat...', color: 'bg-gray-100 text-gray-800' }

    return serviceMode === 'full_llm_bot'
      ? { text: 'AI Bot', color: 'bg-blue-100 text-blue-800' }
      : { text: 'Dukungan Manusia', color: 'bg-green-100 text-green-800' }
  }

  const serviceModeDisplay = getServiceModeDisplay()

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div>
        <Card className="overflow-hidden border-2 border-gray-300">
          <CardHeader className="border-b border-blue-100">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                {mode === 'sibi' ? (
                  <>
                    <HandMetal className="h-5 w-5" />
                    Deteksi Bahasa Isyarat SIBI
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    Bahasa ke teks
                  </>
                )}
              </CardTitle>

              {/* Mode Selection Dropdown */}
              <Select value={mode} onValueChange={(value) => setMode(value as CommunicationMode)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sibi">
                    <div className="flex items-center gap-2">
                      <HandMetal className="h-4 w-4" />
                      Bahasa isyarat SIBI
                    </div>
                  </SelectItem>
                  <SelectItem value="speech">
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      Bahasa ke teks
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Communication Interface */}
              <div className="relative">
                <div className="h-64 w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-100">
                  {mode === 'sibi' ? (
                    <GestureRecognition
                      key={`gesture-${resetKey}`}
                      onLetterDetected={handleLetterDetected}
                      onWordFormed={handleWordFormed}
                      onSendText={(text: string) => {
                        setCurrentQuestion(text)
                        setInputSource('gesture')
                      }}
                      showAlternatives={true}
                      enableWordFormation={true}
                      maxWordLength={50}
                      className="compact h-full w-full"
                    />
                  ) : (
                    <SpeechToText
                      key={`speech-${resetKey}`}
                      onSpeechResult={handleSpeechResult}
                      language="id-ID"
                      continuous={true}
                    />
                  )}
                </div>
              </div>

              {/* Detected Question Display */}
              {currentQuestion && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm text-gray-600">Pertanyaan terdeteksi:</p>
                      <button
                        onClick={resetDetectedInput}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 transition-colors hover:bg-gray-300"
                        title="Hapus pertanyaan"
                      >
                        <RotateCcw className="h-3 w-3 text-gray-600" />
                      </button>
                    </div>
                    <p className="font-medium break-words text-gray-900">{currentQuestion}</p>
                  </div>

                  {/* Typo Correction Display */}
                  {correctedQuestion && correctedQuestion !== currentQuestion && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600">
                          <span className="text-xs text-white">✓</span>
                        </div>
                        <p className="text-sm font-medium text-green-700">Saran perbaikan teks:</p>
                      </div>
                      <p className="font-medium break-words text-green-800">{correctedQuestion}</p>
                      <p className="mt-2 text-xs text-green-600">
                        Saat dikirim, teks yang diperbaiki akan digunakan dalam percakapan
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Button */}
              <div className="space-y-2">
                <Button
                  onClick={startConversation}
                  disabled={!currentQuestion.trim() || isProcessing || conversationEnded}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  {serviceMode === 'full_llm_bot' ? 'Tanya AI Bot →' : 'Kirim ke Admin →'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="border-2 border-gray-300">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <MessageCircle className="h-5 w-5" />
                Percakapan
              </CardTitle>
              <Badge className={serviceModeDisplay.color}>
                {serviceModeLoading && (
                  <div className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"></div>
                )}
                {serviceModeDisplay.text}
              </Badge>
            </div>
            {serviceMode === 'bot_with_admin_validation' && conversationStatus.status === 'waiting' && (
              <Alert className="mt-3 border-orange-200 bg-orange-50">
                <Clock className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">Menunggu persetujuan admin...</AlertDescription>
              </Alert>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex h-[600px] flex-col">
              <ScrollArea
                ref={chatScrollAreaRef}
                className="flex-1 overflow-y-auto"
                style={{ height: '480px', maxHeight: '480px', minHeight: '480px' }}
              >
                <div className="space-y-4 p-4">
                  {messages.length === 0 ? (
                    <div className="py-12 text-center text-gray-500">
                      <div className="mb-4">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100">
                          <MessageCircle className="h-8 w-8 text-gray-400" />
                        </div>
                      </div>
                      <p className="font-medium">Mulai percakapan dengan {institutionName}</p>
                      <p className="mt-1 text-sm">Gunakan bahasa isyarat atau suara untuk bertanya</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.type === 'user'
                            ? 'justify-end'
                            : message.type === 'system'
                              ? 'justify-center'
                              : 'justify-start'
                        }`}
                      >
                        {message.type === 'system' ? (
                          // System messages (queue status, notifications)
                          <div className="max-w-[90%] rounded-lg border border-orange-200 bg-orange-50 px-4 py-2">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-orange-600" />
                              <p className="text-sm text-orange-800">{message.content}</p>
                            </div>
                            <div className="mt-1 text-xs text-orange-600">{message.timestamp.toLocaleTimeString()}</div>
                          </div>
                        ) : (
                          <div
                            className={`flex max-w-[80%] gap-2 ${
                              message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
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
                                message.type === 'user'
                                  ? 'bg-blue-600 text-white'
                                  : message.type === 'admin'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              <p className="text-sm break-words">{message.content}</p>
                              <div className="mt-1 flex items-center justify-between text-xs opacity-70">
                                <div className="flex items-center gap-2">
                                  <span>{message.timestamp.toLocaleTimeString()}</span>
                                  {message.adminName && <span className="italic">- {message.adminName}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  {message.status && message.type === 'user' && (
                                    <span className="capitalize">{message.status}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {/* QR Code and Summary - Show as last message in chat when conversation ended */}
                  {conversationEnded && messages.length > 0 && (
                    <div className="flex justify-center">
                      <div className="w-full max-w-[80%]">
                        <ConversationEnhancements sessionId={sessionId} messages={messages} inline={true} />
                      </div>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="flex justify-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-600 text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-lg bg-gray-100 px-4 py-2 text-gray-800">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
                          <div
                            className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                            style={{ animationDelay: '0.1s' }}
                          ></div>
                          <div
                            className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                            style={{ animationDelay: '0.2s' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} className="h-0" aria-hidden="true" />
                </div>
              </ScrollArea>
              <div className="border-t bg-white p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-2">
                    Mode:{' '}
                    {serviceModeLoading ? (
                      <div className="flex items-center gap-1">
                        <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"></div>
                        Loading...
                      </div>
                    ) : serviceMode === 'full_llm_bot' ? (
                      <>
                        <Bot className="h-3 w-3" /> AI Bot
                      </>
                    ) : (
                      <>
                        <Users className="h-3 w-3" /> Human Support
                      </>
                    )}
                  </span>
                  {conversationStatus.status !== 'active' && (
                    <Badge
                      className={
                        {
                          waiting: 'bg-orange-100 text-orange-800',
                          in_progress: 'bg-blue-100 text-blue-800',
                          resolved: 'bg-green-100 text-green-800',
                        }[conversationStatus.status] || 'bg-gray-100 text-gray-800'
                      }
                    >
                      {conversationStatus.status}
                    </Badge>
                  )}
                </div>
                <div className="mb-3 text-center text-sm text-gray-500">
                  <p>Gunakan bahasa isyarat atau suara untuk berkomunikasi</p>
                </div>
                {messages.length > 0 && (
                  <div className="space-y-2">
                    <Button
                      onClick={endConversation}
                      variant="outline"
                      className="w-full"
                      disabled={conversationStatus.status === 'in_progress'}
                    >
                      {conversationStatus.status === 'in_progress' ? 'Sedang diproses admin...' : 'Akhiri percakapan'}
                    </Button>
                    {conversationEnded && (
                      <Button
                        onClick={startNewConversation}
                        className="w-full bg-green-600 text-white hover:bg-green-700"
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Mulai Percakapan Baru
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
