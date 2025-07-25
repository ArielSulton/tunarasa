'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { AdminOnly } from '@/components/auth/auth-components'
import {
  Send,
  User,
  Bot,
  Settings,
  BarChart3,
  Users,
  MessageSquare,
  Clock,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  confidence?: number
  sessionId?: string
}

interface SessionStats {
  totalSessions: number
  activeSessions: number
  averageResponseTime: number
  successRate: number
  popularQuestions: string[]
}

export default function AdminKomunikasi() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedSession, setSelectedSession] = useState<string>('broadcast')
  const [stats, setStats] = useState<SessionStats>({
    totalSessions: 0,
    activeSessions: 0,
    averageResponseTime: 0,
    successRate: 0,
    popularQuestions: [],
  })

  const loadAdminStats = useCallback(async () => {
    try {
      // Mock data - in real implementation, fetch from API
      setStats({
        totalSessions: 156,
        activeSessions: 23,
        averageResponseTime: 1.2,
        successRate: 94.5,
        popularQuestions: [
          'Cara membuat KTP baru',
          'Syarat akta kelahiran',
          'Prosedur kartu keluarga',
          'Dokumen nikah',
          'Perpanjangan SIM',
        ],
      })
    } catch (error) {
      console.error('Error loading admin stats:', error)
    }
  }, [])

  // Load admin statistics
  useEffect(() => {
    loadAdminStats()
  }, [loadAdminStats])

  // Send admin message
  const sendMessage = useCallback(
    async (content: string, isSystemMessage = false) => {
      if (!content.trim()) return

      const messageType = isSystemMessage ? 'system' : 'user'
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: messageType,
        content: content.trim(),
        timestamp: new Date(),
        sessionId: selectedSession,
      }

      setMessages((prev) => [...prev, userMessage])
      setIsProcessing(true)

      try {
        if (isSystemMessage) {
          // System announcement - broadcast to all active sessions
          const systemResponse: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'system',
            content: 'Pengumuman sistem telah dikirim ke semua sesi aktif.',
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, systemResponse])
        } else {
          // Regular admin query
          const response = await fetch('http://localhost:8000/api/v1/rag/ask', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              question: content.trim(),
              session_id: `admin-session-${Date.now()}`,
              language: 'id',
              max_sources: 5,
              similarity_threshold: 0.6,
            }),
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const data = await response.json()

          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: data.answer || 'Maaf, tidak dapat memproses permintaan admin.',
            timestamp: new Date(),
            confidence: data.confidence,
          }

          setMessages((prev) => [...prev, assistantMessage])
        }
      } catch (error) {
        console.error('Error sending admin message:', error)

        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: 'Error: Tidak dapat terhubung ke sistem. Periksa koneksi admin.',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsProcessing(false)
      }
    },
    [selectedSession],
  )

  // Send regular message
  const sendRegularMessage = useCallback(() => {
    if (inputMessage.trim()) {
      sendMessage(inputMessage, false)
      setInputMessage('')
    }
  }, [inputMessage, sendMessage])

  // Send system announcement
  const sendSystemAnnouncement = useCallback(() => {
    if (inputMessage.trim()) {
      sendMessage(`📢 PENGUMUMAN ADMIN: ${inputMessage}`, true)
      setInputMessage('')
    }
  }, [inputMessage, sendMessage])

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
              <p className="text-gray-600">Monitoring dan kontrol sistem komunikasi Tunarasa</p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            {/* Left Panel - Statistics */}
            <div className="space-y-6 xl:col-span-1">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Users className="mx-auto mb-2 h-8 w-8 text-blue-600" />
                    <div className="text-2xl font-bold text-gray-900">{stats.activeSessions}</div>
                    <p className="text-sm text-gray-600">Sesi Aktif</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <MessageSquare className="mx-auto mb-2 h-8 w-8 text-green-600" />
                    <div className="text-2xl font-bold text-gray-900">{stats.totalSessions}</div>
                    <p className="text-sm text-gray-600">Total Sesi</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="mx-auto mb-2 h-8 w-8 text-orange-600" />
                    <div className="text-2xl font-bold text-gray-900">{stats.averageResponseTime}s</div>
                    <p className="text-sm text-gray-600">Rata-rata Respons</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="mx-auto mb-2 h-8 w-8 text-purple-600" />
                    <div className="text-2xl font-bold text-gray-900">{stats.successRate}%</div>
                    <p className="text-sm text-gray-600">Tingkat Keberhasilan</p>
                  </CardContent>
                </Card>
              </div>

              {/* Popular Questions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5" />
                    Pertanyaan Populer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stats.popularQuestions.map((question, index) => (
                    <div key={index} className="flex items-center justify-between rounded bg-gray-50 p-2">
                      <span className="text-sm">{question}</span>
                      <Badge variant="secondary">{5 - index}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Session Control */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="h-5 w-5" />
                    Kontrol Sesi
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label htmlFor="session-select" className="mb-2 block text-sm font-medium text-gray-700">
                      Target Sesi
                    </label>
                    <select
                      id="session-select"
                      value={selectedSession}
                      onChange={(e) => setSelectedSession(e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2"
                    >
                      <option value="broadcast">Broadcast (Semua Sesi)</option>
                      <option value="sibi">Sesi SIBI</option>
                      <option value="speech">Sesi Speech-to-Text</option>
                      <option value="chat">Sesi Chat</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Chat Interface */}
            <div className="xl:col-span-2">
              <Card className="border-2 border-purple-200">
                <CardHeader className="bg-purple-50">
                  <CardTitle className="flex items-center gap-2 text-purple-800">
                    <MessageSquare className="h-5 w-5" />
                    Konsol Administrator
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex h-[500px] flex-col">
                    {/* Messages Area */}
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {messages.length === 0 ? (
                          <div className="py-8 text-center text-gray-500">
                            <Settings className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                            <p>Panel admin siap. Kirim pesan atau pengumuman sistem.</p>
                          </div>
                        ) : (
                          messages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`flex max-w-[80%] gap-2 ${
                                  message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                                }`}
                              >
                                <div className="flex-shrink-0">
                                  {message.type === 'user' ? (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-white">
                                      <User className="h-4 w-4" />
                                    </div>
                                  ) : message.type === 'system' ? (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-white">
                                      <AlertCircle className="h-4 w-4" />
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
                                      ? 'bg-purple-600 text-white'
                                      : message.type === 'system'
                                        ? 'border border-orange-200 bg-orange-100 text-orange-800'
                                        : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  <p className="text-sm">{message.content}</p>
                                  <div className="mt-1 flex items-center justify-between text-xs opacity-70">
                                    <span>{message.timestamp.toLocaleTimeString()}</span>
                                    {message.confidence && (
                                      <span className="ml-2">{Math.round(message.confidence * 100)}% confidence</span>
                                    )}
                                  </div>
                                </div>
                              </div>
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

                    <div className="space-y-3 border-t p-4">
                      {/* Input Area */}
                      <Textarea
                        placeholder="Ketik pesan admin atau pengumuman sistem..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendRegularMessage()
                          }
                        }}
                        className="min-h-[80px] resize-none"
                      />

                      {/* Action Buttons */}
                      <div className="flex justify-between">
                        <div className="text-sm text-gray-500">
                          Target: <span className="font-medium">{selectedSession}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={sendSystemAnnouncement}
                            disabled={!inputMessage.trim() || isProcessing}
                            variant="outline"
                            className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                          >
                            <AlertCircle className="mr-2 h-4 w-4" />
                            Pengumuman
                          </Button>
                          <Button
                            onClick={sendRegularMessage}
                            disabled={!inputMessage.trim() || isProcessing}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Kirim
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AdminOnly>
  )
}
