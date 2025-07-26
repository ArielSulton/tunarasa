'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, User, Bot, MessageCircle } from 'lucide-react'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  confidence?: number
}

export default function KomunikasiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Send message to chat
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsProcessing(true)

    try {
      // Call backend RAG Q&A API
      const response = await fetch('http://localhost:8000/api/v1/rag/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: content.trim(),
          session_id: `chat-session-${Date.now()}`,
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
        content: data.answer || 'Maaf, saya tidak dapat memproses pertanyaan Anda saat ini.',
        timestamp: new Date(),
        confidence: data.confidence,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Maaf, saya mengalami masalah koneksi. Silakan coba lagi nanti.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsProcessing(false)
    }
  }, [])

  // Send typed message
  const sendTypedMessage = useCallback(() => {
    if (inputMessage.trim()) {
      sendMessage(inputMessage)
      setInputMessage('')
    }
  }, [inputMessage, sendMessage])

  const quickQuestions = [
    'Bagaimana cara membuat KTP baru?',
    'Syarat membuat akta kelahiran?',
    'Prosedur pembuatan kartu keluarga?',
    'Cara mengurus surat nikah?',
    'Persyaratan perpanjangan SIM?',
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-r from-purple-50 to-purple-100 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">
              Chat <span className="text-purple-600">Langsung</span>
            </h1>
            <p className="text-gray-600">Tanyakan apapun tentang layanan publik melalui chat teks</p>
          </div>
        </div>
      </section>

      {/* Main Interface */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <Card className="border-2 border-purple-200">
              <CardHeader className="bg-purple-50">
                <CardTitle className="flex items-center gap-2 text-purple-800">
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
                          <MessageCircle className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                          <p>Mulai percakapan dengan mengetik pertanyaan Anda</p>
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
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-600 text-white">
                                    <Bot className="h-4 w-4" />
                                  </div>
                                )}
                              </div>

                              <div
                                className={`rounded-lg px-4 py-2 ${
                                  message.type === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-800'
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

                  {/* Input Area */}
                  <div className="border-t p-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ketik pertanyaan Anda di sini..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendTypedMessage()}
                        className="flex-1"
                      />
                      <Button
                        onClick={sendTypedMessage}
                        disabled={!inputMessage.trim() || isProcessing}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Quick Questions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pertanyaan Cepat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto w-full justify-start p-3 text-left hover:bg-purple-50"
                    onClick={() => sendMessage(question)}
                  >
                    <span className="text-sm">{question}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tips Bertanya</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-600">
                <p>• Gunakan bahasa yang jelas dan spesifik</p>
                <p>• Sebutkan jenis dokumen yang ingin Anda urus</p>
                <p>• Tanyakan tentang syarat dan prosedur</p>
                <p>• Jika perlu, tanyakan tentang lokasi pelayanan</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
