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
import { useServiceConfig } from '@/hooks/use-service-config'
import { ConversationEnhancements } from '@/components/komunikasi/ConversationEnhancements'
import { AdminConversationPanel } from '@/components/admin/AdminConversationPanel'
import { ModeSwitcher } from '@/components/komunikasi/ModeSwitcher'
import { useUserRole } from '@/components/auth/SuperAdminOnly'
import { User, Bot, MessageCircle, Mic, HandMetal, RotateCcw, Clock, Users, AlertCircle } from 'lucide-react'
import { getRagApiUrl } from '@/lib/utils/backend'

import { ChatMessage, ConversationStatus } from '@/types'

interface BackendMessage {
  id: string
  type: 'user' | 'assistant' | 'admin' | 'system' | 'llm_recommendation'
  content: string
  timestamp: string
  adminName?: string
  confidence?: number
}

type CommunicationMode = 'sibi' | 'speech'

function UserKomunikasiPage() {
  const { serviceMode, loading: serviceModeLoading, refreshConfig } = useServiceConfig()
  const [mode, setMode] = useState<CommunicationMode>('sibi')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [resetKey, setResetKey] = useState(0)
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>({
    id: '',
    status: 'active',
  })
  const [sessionId] = useState(() => `chat-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const [conversationEnded, setConversationEnded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatScrollAreaRef = useRef<HTMLDivElement>(null)

  const handleLetterDetected = useCallback((letter: string) => {
    console.log('Letter detected:', letter)
  }, [])

  const handleWordFormed = useCallback((word: string) => {
    setCurrentQuestion(word)
    console.log('Word formed:', word)
  }, [])

  const handleSpeechResult = useCallback((text: string) => {
    console.log('🗣️ handleSpeechResult called with:', text)
    setCurrentQuestion(text)
    console.log('🗣️ currentQuestion updated to:', text)
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        type: 'user',
        content: content.trim(),
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
          const response = await fetch(getRagApiUrl(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              question: content.trim(),
              session_id: sessionId,
              language: 'id',
              max_sources: 3,
              similarity_threshold: 0.7,
            }),
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const data = await response.json()

          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',

            content: data.answer ?? 'Maaf, saya tidak dapat memproses pertanyaan Anda saat ini.',
            timestamp: new Date(),

            confidence: data.confidence,
          }

          setMessages((prev) => [...prev.slice(0, -1), { ...userMessage, status: 'delivered' }, assistantMessage])
        } else if (serviceMode === 'bot_with_admin_validation') {
          const response = await fetch('/api/chat/send-message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: content.trim(),
              sessionId,
              serviceMode: 'bot_with_admin_validation',
              inputMethod: mode === 'sibi' ? 'gesture' : 'speech',
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
    [serviceMode, sessionId, mode, conversationStatus.status],
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
    }
  }, [currentQuestion, sendMessage])

  const endConversation = useCallback(() => {
    if (messages.length > 0) {
      setConversationEnded(true)
      // Auto-generate QR code when conversation is ended
      setTimeout(() => {
        const generateButton = document.querySelector('[data-generate-summary]') as HTMLButtonElement
        if (generateButton && !generateButton.disabled) {
          generateButton.click()
        }
      }, 100)
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
  }, [])

  const handleTypoCorrection = useCallback((original: string, corrected: string) => {
    if (corrected !== original) {
      setCurrentQuestion(corrected)
    }
  }, [])

  const resetDetectedInput = useCallback(() => {
    console.log('🗑️ Reset all detected input states for mode:', mode)
    setCurrentQuestion('')

    // Force component remount to reset internal states
    setResetKey((prev) => prev + 1)
  }, [mode])

  useEffect(() => {
    if (serviceMode === 'bot_with_admin_validation' && conversationStatus.id && !conversationEnded) {
      const pollForUpdates = async () => {
        try {
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
          let lastMessageId: number | null = null
          if (lastMessage && !lastMessage.id.startsWith('temp-')) {
            const parsed = parseInt(lastMessage.id)
            // Only use valid database IDs (not timestamps or temp IDs)
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
              console.log(
                '🔧 [DEBUG] User polling - raw new messages received:',
                data.newMessages.map((msg: BackendMessage) => ({
                  id: msg.id,
                  type: msg.type,
                  contentPreview: msg.content?.substring(0, 50) + '...',
                  adminName: msg.adminName,
                })),
              )

              const formattedMessages: ChatMessage[] = data.newMessages
                .filter((msg: BackendMessage) => {
                  const shouldInclude = msg.type !== 'llm_recommendation'
                  console.log(`🔧 [DEBUG] User polling - message ${msg.id} type=${msg.type} included=${shouldInclude}`)
                  return shouldInclude
                })
                .map((msg: BackendMessage) => ({
                  id: msg.id,
                  type: msg.type === 'admin' ? 'admin' : msg.type,
                  content: msg.content,
                  timestamp: new Date(msg.timestamp),
                  adminName: msg.adminName,
                  confidence: msg.confidence,
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
                  confidence: msg.confidence,
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
    if (serviceModeLoading) return { text: 'Loading...', color: 'bg-gray-100 text-gray-800' }

    return serviceMode === 'full_llm_bot'
      ? { text: 'AI Bot', color: 'bg-blue-100 text-blue-800' }
      : { text: 'Human Support', color: 'bg-green-100 text-green-800' }
  }

  const serviceModeDisplay = getServiceModeDisplay()

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-blue-50 to-blue-100">
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900">
                Berkomunikasi{' '}
                <span className="text-blue-600" style={{ fontFamily: 'cursive' }}>
                  tanpa
                </span>{' '}
                hambatan
              </h1>
              <Badge className={serviceModeDisplay.color}>
                {serviceModeLoading && (
                  <div className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"></div>
                )}
                {serviceModeDisplay.text}
              </Badge>
            </div>
            {serviceMode === 'bot_with_admin_validation' && conversationStatus.status === 'waiting' && (
              <Alert className="mx-auto max-w-md border-orange-200 bg-orange-50">
                <Clock className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-center text-orange-800">
                  Menunggu persetujuan admin...
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 transition-all duration-300 sm:px-6 lg:px-8">
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
                          onSendText={(text: string) => setCurrentQuestion(text)}
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
                  <ModeSwitcher
                    onModeChange={() => {
                      console.log('Service mode changed, refreshing config...')
                      void refreshConfig()
                    }}
                  />
                </div>
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
                          <p className="font-medium">Mulai percakapan Anda</p>
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
                                <div className="mt-1 text-xs text-orange-600">
                                  {message.timestamp.toLocaleTimeString()}
                                </div>
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
                                      {message.confidence && (
                                        <span>{Math.round(message.confidence * 100)}% confidence</span>
                                      )}
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
                      {conversationEnded && messages.length > 0 && (
                        <div className="flex justify-center py-4">
                          <div className="w-full max-w-sm">
                            <ConversationEnhancements
                              sessionId={sessionId}
                              messages={messages}
                              onTypoCorrection={handleTypoCorrection}
                              disabled={isProcessing || conversationEnded}
                              inline={true}
                            />
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
                          {conversationStatus.status === 'in_progress'
                            ? 'Sedang diproses admin...'
                            : 'Akhiri percakapan'}
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

          {messages.length > 0 && !conversationEnded && (
            <div className="lg:col-span-2">
              <ConversationEnhancements
                sessionId={sessionId}
                messages={messages}
                onTypoCorrection={handleTypoCorrection}
                disabled={isProcessing || conversationEnded}
                typoOnly={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Komunikasi() {
  const { role } = useUserRole()

  // Admin gets the admin panel as their main page
  if (role === 'admin' || role === 'superadmin') {
    return <AdminConversationPanel isVisible={true} onVisibilityChange={() => {}} />
  }

  // Regular users get the user interface
  return <UserKomunikasiPage />
}
