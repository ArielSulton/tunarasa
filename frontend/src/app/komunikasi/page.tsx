'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GestureRecognition } from '@/components/gesture/gesture-recognition'
import { SpeechToText } from '@/components/speech/SpeechToText'
import { useServiceMode } from '@/lib/hooks/use-service-config'
import { Send, User, Bot, MessageCircle, Mic, HandMetal, RotateCcw, Clock, Users, AlertCircle } from 'lucide-react'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'admin' | 'system'
  content: string
  timestamp: Date
  confidence?: number
  adminName?: string
  status?: 'sending' | 'sent' | 'delivered' | 'read'
}

interface ConversationStatus {
  id: string
  status: 'active' | 'waiting' | 'in_progress' | 'resolved'
  assignedAdmin?: string
  queuePosition?: number
  estimatedWaitTime?: number
}

type CommunicationMode = 'sibi' | 'speech'

export default function Komunikasi() {
  const { serviceMode, loading: serviceModeLoading } = useServiceMode()
  const [mode, setMode] = useState<CommunicationMode>('sibi')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [resetKey, setResetKey] = useState(0)
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>({
    id: '',
    status: 'active',
  })
  const [sessionId] = useState(() => `chat-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

  // Handle gesture recognition
  const handleLetterDetected = useCallback((letter: string) => {
    console.log('Letter detected:', letter)
  }, [])

  const handleWordFormed = useCallback((word: string) => {
    setCurrentQuestion(word)
    console.log('Word formed:', word)
  }, [])

  // Handle speech-to-text
  const handleSpeechResult = useCallback((text: string) => {
    console.log('🗣️ handleSpeechResult called with:', text)
    setCurrentQuestion(text)
    console.log('🗣️ currentQuestion updated to:', text)
  }, [])

  // Send message to chat (dual-mode support)
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: content.trim(),
        timestamp: new Date(),
        status: 'sending',
      }

      setMessages((prev) => [...prev, userMessage])
      setIsProcessing(true)

      try {
        if (serviceMode === 'full_llm_bot') {
          // Full LLM Bot Mode - Direct LLM response
          const response = await fetch('http://localhost:8000/api/v1/rag/ask', {
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

          setMessages((prev) => [
            ...prev.slice(0, -1), // Remove sending message
            { ...userMessage, status: 'delivered' }, // Update user message status
            assistantMessage,
          ])
        } else {
          // Human CS Support Mode - Route to admin queue
          const response = await fetch('/api/chat/send-message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: content.trim(),
              sessionId,
              serviceMode: 'human_cs_support',
              inputMethod: mode === 'sibi' ? 'gesture' : 'speech',
            }),
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const data = await response.json()

          // Update conversation status
          setConversationStatus({
            id: data.conversationId,
            status: data.status,
            queuePosition: data.queuePosition,
            estimatedWaitTime: data.estimatedWaitTime,
          })

          // Update message status
          setMessages((prev) => [...prev.slice(0, -1), { ...userMessage, status: 'delivered' }])

          // Add system message about queue status
          const systemMessage: ChatMessage = {
            id: (Date.now() + 2).toString(),
            type: 'system',
            content:
              data.queuePosition > 0
                ? `Pesan Anda telah diterima dan berada di posisi ${data.queuePosition} dalam antrian. Estimasi waktu tunggu: ${data.estimatedWaitTime} menit.`
                : 'Pesan Anda telah diterima dan sedang diproses oleh admin.',
            timestamp: new Date(),
          }

          setMessages((prev) => [...prev, systemMessage])
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
    [serviceMode, sessionId, mode],
  )

  // Start conversation with detected input
  const startConversation = useCallback(() => {
    if (currentQuestion.trim()) {
      void sendMessage(currentQuestion)
      setCurrentQuestion('')
    }
  }, [currentQuestion, sendMessage])

  // Send typed message
  const sendTypedMessage = useCallback(() => {
    if (inputMessage.trim()) {
      void sendMessage(inputMessage)
      setInputMessage('')
    }
  }, [inputMessage, sendMessage])

  const endConversation = useCallback(() => {
    setMessages([])
    setCurrentQuestion('')
    setInputMessage('')
  }, [])

  // Reset detected input and internal states
  const resetDetectedInput = useCallback(() => {
    console.log('🗑️ Reset all detected input states for mode:', mode)
    setCurrentQuestion('')

    // Force component remount to reset internal states
    setResetKey((prev) => prev + 1)
  }, [mode])

  // Poll for updates when in human CS support mode
  useEffect(() => {
    if (serviceMode === 'human_cs_support' && conversationStatus.id && conversationStatus.status !== 'resolved') {
      const pollForUpdates = async () => {
        try {
          const response = await fetch(`/api/chat/conversation/${conversationStatus.id}/messages`)
          if (response.ok) {
            const data = await response.json()
            if (data.newMessages && data.newMessages.length > 0) {
              setMessages((prev) => [...prev, ...data.newMessages])
            }
            if (data.status !== conversationStatus.status) {
              setConversationStatus((prev) => ({ ...prev, status: data.status }))
            }
          }
        } catch (error) {
          console.error('Error polling for updates:', error)
        }
      }

      const interval = setInterval(() => {
        void pollForUpdates()
      }, 3000) // Poll every 3 seconds

      return () => clearInterval(interval)
    }
  }, [serviceMode, conversationStatus.id, conversationStatus.status])

  const getServiceModeDisplay = () => {
    if (serviceModeLoading) return { text: 'Loading...', color: 'bg-gray-100 text-gray-800' }

    return serviceMode === 'full_llm_bot'
      ? { text: 'AI Bot', color: 'bg-blue-100 text-blue-800' }
      : { text: 'Human Support', color: 'bg-green-100 text-green-800' }
  }

  const serviceModeDisplay = getServiceModeDisplay()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header */}
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
              <Badge className={serviceModeDisplay.color}>{serviceModeDisplay.text}</Badge>
            </div>
            {serviceMode === 'human_cs_support' && conversationStatus.status === 'waiting' && (
              <Alert className="mx-auto max-w-md border-orange-200 bg-orange-50">
                <Clock className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-center text-orange-800">
                  {conversationStatus.queuePosition ? (
                    <>
                      Posisi antrian: {conversationStatus.queuePosition} | Estimasi:{' '}
                      {conversationStatus.estimatedWaitTime} menit
                    </>
                  ) : (
                    'Menunggu respons dari admin...'
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </section>

      {/* Main Interface */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left Panel - Communication Input */}
          <div className="">
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
                      <p className="font-medium text-gray-900">{currentQuestion}</p>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="space-y-2">
                    <Button
                      onClick={startConversation}
                      disabled={!currentQuestion.trim() || isProcessing || conversationStatus.status === 'resolved'}
                      className="w-full bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {serviceMode === 'full_llm_bot' ? 'Tanya AI Bot →' : 'Kirim ke Admin →'}
                    </Button>

                    {/* Debug button for speech-to-text */}
                    {mode === 'speech' && (
                      <Button
                        onClick={() => handleSpeechResult('Test speech input')}
                        variant="outline"
                        className="w-full text-xs"
                      >
                        🔧 Test Speech Callback
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Chat Conversation */}
          <div className="">
            <Card className="border-2 border-gray-300">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-gray-800">
                  <MessageCircle className="h-5 w-5" />
                  Percakapan
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0">
                <div className="flex h-[500px] flex-col">
                  {/* Messages Area */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.length === 0 ? (
                        <div className="py-8 text-center text-gray-500">
                          <div className="mb-4">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-gray-200">
                              <span className="text-2xl">💭</span>
                            </div>
                          </div>
                          <p className="mb-2 font-medium">Akses Catatan Percakapan Anda</p>
                          <div className="mt-4 rounded-lg bg-gray-100 p-4">
                            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-600">
                              <span className="text-xl text-white">📄</span>
                            </div>
                          </div>
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
                                  <p className="text-sm">{message.content}</p>
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
                    </div>
                  </ScrollArea>

                  {/* Input Area - for manual text input */}
                  <div className="border-t p-4">
                    {/* Service mode indicator */}
                    <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-2">
                        Mode:{' '}
                        {serviceMode === 'full_llm_bot' ? (
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

                    <div className="mb-3 flex gap-2">
                      <Input
                        placeholder={
                          serviceMode === 'full_llm_bot'
                            ? 'Atau ketik pertanyaan manual...'
                            : 'Ketik pesan untuk admin...'
                        }
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendTypedMessage()}
                        className="flex-1"
                        disabled={conversationStatus.status === 'resolved'}
                      />
                      <Button
                        onClick={sendTypedMessage}
                        disabled={!inputMessage.trim() || isProcessing || conversationStatus.status === 'resolved'}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>

                    {messages.length > 0 && (
                      <Button
                        onClick={endConversation}
                        variant="outline"
                        className="w-full"
                        disabled={conversationStatus.status === 'in_progress'}
                      >
                        {conversationStatus.status === 'in_progress' ? 'Sedang diproses admin...' : 'Akhiri percakapan'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
