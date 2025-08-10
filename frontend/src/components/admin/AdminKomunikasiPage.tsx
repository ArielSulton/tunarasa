'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AdminConversationPanel } from '@/components/admin/AdminConversationPanel'
import { ModeSwitcher } from '@/components/komunikasi/ModeSwitcher'
import { useServiceConfig } from '@/hooks/use-service-config'
import { Send, User, Bot, MessageCircle, Users, AlertCircle, Settings, BarChart3, Clock } from 'lucide-react'

import { ChatMessage } from '@/types'

export function AdminKomunikasiPage() {
  const { serviceMode, loading: serviceModeLoading, refreshConfig } = useServiceConfig()
  const [showAdminPanel, setShowAdminPanel] = useState(true) // Always show for admins
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatScrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto scroll for admin messages
  const scrollToBottom = useCallback(() => {
    if (messages.length === 0) return

    try {
      if (chatScrollAreaRef.current) {
        const scrollContainer = chatScrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth',
          })
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
  }, [messages.length, scrollToBottom])

  // Admin message sending - simplified for admin interface
  const sendAdminMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    const adminMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      type: 'admin',
      content: content.trim(),
      timestamp: new Date(),
      status: 'sending',
      adminName: 'You',
    }

    setMessages((prev) => [...prev, adminMessage])
    setIsProcessing(true)

    try {
      // For now, simulate a successful admin message
      // In the future, this would connect to the actual admin message API
      console.log('📤 [AdminKomunikasi] Sending admin message:', content)

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Update message status to delivered
      setMessages((prev) => [...prev.slice(0, -1), { ...adminMessage, status: 'delivered', id: `msg-${Date.now()}` }])

      console.log('✅ [AdminKomunikasi] Message sent successfully')
    } catch (error) {
      console.error('❌ [AdminKomunikasi] Error sending message:', error)

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: 'Gagal mengirim pesan. Silakan coba lagi.',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev.slice(0, -1), { ...adminMessage, status: 'sent' }, errorMessage])
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const sendTypedMessage = useCallback(() => {
    if (inputMessage.trim()) {
      void sendAdminMessage(inputMessage)
      setInputMessage('')
    }
  }, [inputMessage, sendAdminMessage])

  const getServiceModeDisplay = () => {
    if (serviceModeLoading) return { text: 'Loading...', color: 'bg-gray-100 text-gray-800' }
    return serviceMode === 'full_llm_bot'
      ? { text: 'AI Bot', color: 'bg-blue-100 text-blue-800' }
      : { text: 'Human Support', color: 'bg-green-100 text-green-800' }
  }

  const serviceModeDisplay = getServiceModeDisplay()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Admin Header */}
      <section className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="mt-1 text-sm text-gray-600">Kelola komunikasi dan bantuan pengguna dengan efisien</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Quick Stats */}
              <div className="hidden items-center gap-4 rounded-lg bg-gray-50 px-4 py-2 lg:flex">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Avg Response: 2.3m</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Active: 3</span>
                </div>
              </div>

              <Badge className={`${serviceModeDisplay.color} font-medium`}>
                {serviceModeLoading && (
                  <div className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"></div>
                )}
                {serviceModeDisplay.text}
              </Badge>

              <ModeSwitcher
                onModeChange={() => {
                  console.log('Service mode changed, refreshing config...')
                  void refreshConfig()
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Service Mode Status Alert */}
      {serviceMode === 'bot_with_admin_validation' && (
        <div className="border-b border-orange-200 bg-orange-50">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
            <Alert className="border-orange-200 bg-transparent">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Mode Human Support aktif - Semua respons AI memerlukan persetujuan admin sebelum dikirim ke pengguna.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {/* Main Admin Interface */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Left Panel - Admin Conversation Management */}
          <div className="lg:col-span-3">
            <AdminConversationPanel isVisible={showAdminPanel} onVisibilityChange={setShowAdminPanel} />
          </div>

          {/* Right Panel - Quick Actions & Direct Chat */}
          <div className="space-y-6">
            {/* Quick Actions Card */}
            <Card className="border-2 border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                  <Settings className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => void refreshConfig()}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Refresh Stats
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setShowAdminPanel(!showAdminPanel)}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {showAdminPanel ? 'Hide' : 'Show'} Panel
                </Button>
              </CardContent>
            </Card>

            {/* Direct Admin Chat */}
            <Card className="border-2 border-orange-200">
              <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-orange-100">
                <CardTitle className="flex items-center gap-2 text-orange-900">
                  <MessageCircle className="h-5 w-5" />
                  Chat Langsung
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0">
                <div className="flex h-[400px] flex-col">
                  {/* Messages Area */}
                  <ScrollArea
                    ref={chatScrollAreaRef}
                    className="flex-1 overflow-y-auto"
                    style={{ height: '320px', maxHeight: '320px', minHeight: '320px' }}
                  >
                    <div className="space-y-3 p-4">
                      {messages.length === 0 ? (
                        <div className="py-12 text-center text-gray-500">
                          <div className="mb-4">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-r from-orange-100 to-orange-200">
                              <Users className="h-8 w-8 text-orange-600" />
                            </div>
                          </div>
                          <p className="font-medium text-gray-700">Siap membantu pengguna</p>
                          <p className="mt-1 text-sm text-gray-500">Gunakan chat ini untuk komunikasi langsung</p>
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex gap-3 ${message.type === 'admin' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`flex max-w-[85%] gap-2 ${
                                message.type === 'admin' ? 'flex-row-reverse' : 'flex-row'
                              }`}
                            >
                              <div className="mt-1 flex-shrink-0">
                                <div
                                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                                    message.type === 'admin'
                                      ? 'bg-orange-600 text-white'
                                      : message.type === 'system'
                                        ? 'bg-gray-500 text-white'
                                        : 'bg-blue-600 text-white'
                                  }`}
                                >
                                  {message.type === 'admin' ? (
                                    <Users className="h-4 w-4" />
                                  ) : message.type === 'system' ? (
                                    <AlertCircle className="h-4 w-4" />
                                  ) : (
                                    <User className="h-4 w-4" />
                                  )}
                                </div>
                              </div>

                              <div
                                className={`rounded-xl px-4 py-2 shadow-sm ${
                                  message.type === 'admin'
                                    ? 'bg-orange-600 text-white'
                                    : message.type === 'system'
                                      ? 'bg-gray-100 text-gray-800'
                                      : 'border border-gray-200 bg-white text-gray-800'
                                }`}
                              >
                                <p className="text-sm leading-relaxed break-words">{message.content}</p>
                                <div className="mt-2 flex items-center justify-between text-xs opacity-70">
                                  <span>{message.timestamp.toLocaleTimeString()}</span>
                                  {message.status && message.type === 'admin' && (
                                    <div className="flex items-center gap-1">
                                      <div
                                        className={`h-1.5 w-1.5 rounded-full ${
                                          message.status === 'delivered'
                                            ? 'bg-green-300'
                                            : message.status === 'sent'
                                              ? 'bg-yellow-300'
                                              : 'bg-gray-300'
                                        }`}
                                      ></div>
                                      <span className="capitalize">{message.status}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}

                      {isProcessing && (
                        <div className="flex justify-start gap-3">
                          <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-gray-500 text-white">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
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

                  {/* Input Area */}
                  <div className="border-t bg-white p-4">
                    <div className="flex gap-3">
                      <Input
                        placeholder="Ketik pesan untuk pengguna..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendTypedMessage()}
                        className="flex-1 border-orange-200 text-sm focus:border-orange-400"
                        disabled={serviceModeLoading}
                      />
                      <Button
                        onClick={sendTypedMessage}
                        disabled={!inputMessage.trim() || isProcessing || serviceModeLoading}
                        className="bg-orange-600 shadow-md hover:bg-orange-700"
                        size="sm"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
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
