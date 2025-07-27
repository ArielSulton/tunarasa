'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import GestureRecognition from '@/components/gesture/gesture-recognition'
import { /* MessageCircle, Send, */ User, Bot, Hand } from 'lucide-react'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  confidence?: number
}

const quickQuestions = [
  'Bagaimana Cara Membuat Akta Kelahiran Baru?',
  'Pengajuan Penerbitan Akta Kelahiran Dilakukan Dengan Menyerahkan Fotokopi Surat Keterangan Kelahiran Dan Rumah Sakit Atau Fasilitas Kesehatan, Serta Fotokopi KK. Pengajuan Dilakukan Melalui Aplikasi JSS .',
]

export default function KomunikasiSIBI() {
  const [currentWord, setCurrentWord] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // Handle letter detection from gesture recognition
  const handleLetterDetected = useCallback((letter: string, confidence: number) => {
    console.log(`Detected letter: ${letter} (${Math.round(confidence * 100)}% confidence)`)
  }, [])

  // Handle word formation from gesture recognition
  const handleWordFormed = useCallback((word: string) => {
    setCurrentWord(word)
    console.log(`Word formed: ${word}`)
  }, [])

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
          session_id: `sibi-session-${Date.now()}`,
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

  // Send gesture-formed word as question
  const sendGestureWord = useCallback(() => {
    if (currentWord.trim()) {
      void sendMessage(currentWord)
      setCurrentWord('')
    }
  }, [currentWord, sendMessage])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-r from-blue-50 to-blue-100 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">
              Berkomunikasi{' '}
              <span className="text-blue-600" style={{ fontFamily: 'cursive' }}>
                tanpa
              </span>{' '}
              hambatan
            </h1>
            <p className="text-gray-600">Gunakan bahasa isyarat SIBI untuk berkomunikasi dengan sistem</p>
          </div>
        </div>
      </section>

      {/* Main Interface */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          {/* Left Panel - Gesture Recognition */}
          <div className="space-y-6">
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  Deteksi Bahasa Isyarat SIBI
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <GestureRecognition
                  onLetterDetected={handleLetterDetected}
                  onWordFormed={handleWordFormed}
                  showAlternatives={true}
                  enableWordFormation={true}
                  maxWordLength={50}
                />
              </CardContent>
            </Card>

            {/* Current Word Display */}
            {currentWord && (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4 text-center">
                    <div className="text-lg font-medium text-gray-700">Kata yang terbentuk:</div>
                    <Badge variant="secondary" className="bg-blue-100 px-6 py-3 font-mono text-xl text-blue-800">
                      {currentWord}...
                    </Badge>
                    <Button onClick={sendGestureWord} className="w-full bg-blue-600 text-white hover:bg-blue-700">
                      Mulai percakapan →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Panel - Chat Interface */}
          <div className="space-y-6">
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                  Percakapan
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex h-[400px] flex-col">
                  {/* Messages Area */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.length === 0 ? (
                        <div className="py-8 text-center text-gray-500">
                          <Hand className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                          <p>Mulai percakapan dengan menggunakan bahasa isyarat SIBI</p>
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
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white">
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
                                  message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
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
                </div>
              </CardContent>
            </Card>

            {/* Quick Questions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contoh Pertanyaan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickQuestions.map((question, index) => (
                  <div
                    key={index}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      index === 0
                        ? 'border-blue-200 bg-blue-50 text-blue-800'
                        : 'border-gray-200 bg-gray-50 text-sm text-gray-700'
                    }`}
                    onClick={() => void sendMessage(question)}
                  >
                    {question}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Action */}
        <div className="mt-8 text-center">
          <Button onClick={() => window.location.reload()} variant="outline" className="px-8">
            Akhiri percakapan
          </Button>
        </div>
      </div>
    </div>
  )
}
