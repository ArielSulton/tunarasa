'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mic, MicOff, Send, User, Bot, Volume2 } from 'lucide-react'
import { getRagApiUrl } from '@/lib/utils/backend'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  confidence?: number
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

export default function KomunikasiSpeechToText() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)
  const [isSupported, setIsSupported] = useState(true)

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition()
        recognitionInstance.continuous = true
        recognitionInstance.interimResults = true
        recognitionInstance.lang = 'id-ID' // Indonesian language

        recognitionInstance.onstart = () => {
          setIsListening(true)
        }

        recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = ''
          let interimTranscript = ''

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              finalTranscript += transcript
            } else {
              interimTranscript += transcript
            }
          }

          setTranscript(finalTranscript + interimTranscript)
        }

        recognitionInstance.onend = () => {
          setIsListening(false)
        }

        recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error)
          setIsListening(false)
        }

        setRecognition(recognitionInstance)
      } else {
        setIsSupported(false)
      }
    }
  }, [])

  // Start listening
  const startListening = useCallback(() => {
    if (recognition) {
      setTranscript('')
      recognition.start()
    }
  }, [recognition])

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop()
    }
  }, [recognition])

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
    setTranscript('')

    try {
      // Call backend RAG Q&A API
      const response = await fetch(getRagApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: content.trim(),
          session_id: `speech-session-${Date.now()}`,
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

  // Send transcript as message
  const sendTranscript = useCallback(() => {
    if (transcript.trim()) {
      void sendMessage(transcript)
      stopListening()
    }
  }, [transcript, sendMessage, stopListening])

  // Speak text using TTS
  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'id-ID'
      utterance.rate = 0.8
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
    }
  }, [])

  if (!isSupported) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="mx-auto max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Browser Tidak Didukung</h2>
            <p className="text-gray-600">
              Fitur Speech-to-Text tidak didukung di browser Anda. Silakan gunakan Chrome, Firefox, atau Safari terbaru.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-r from-green-50 to-green-100 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">
              Komunikasi dengan <span className="text-green-600">Suara</span>
            </h1>
            <p className="text-gray-600">Bicara langsung dan dapatkan respons dalam bentuk teks dan suara</p>
          </div>
        </div>
      </section>

      {/* Main Interface */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Speech Input Panel */}
          <Card className="border-2 border-green-200">
            <CardHeader className="bg-green-50">
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Volume2 className="h-5 w-5" />
                Input Suara
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6 text-center">
                {/* Microphone Button */}
                <div className="relative">
                  <Button
                    onClick={isListening ? stopListening : startListening}
                    disabled={isProcessing}
                    className={`h-24 w-24 rounded-full text-xl font-bold text-white transition-all ${
                      isListening ? 'animate-pulse bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {isListening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
                  </Button>
                  {isListening && (
                    <div className="absolute inset-0 animate-ping rounded-full border-4 border-red-300"></div>
                  )}
                </div>

                {/* Status Text */}
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-700">
                    {isListening ? 'Mendengarkan...' : 'Klik untuk mulai berbicara'}
                  </p>
                  {isListening && <p className="text-sm text-gray-500">Klik tombol merah untuk berhenti</p>}
                </div>

                {/* Transcript Display */}
                {transcript && (
                  <div className="min-h-[100px] rounded-lg bg-gray-50 p-4">
                    <p className="text-lg text-gray-800">{transcript}</p>
                    <div className="mt-4 flex justify-end space-x-2">
                      <Button onClick={() => setTranscript('')} variant="outline" size="sm">
                        Hapus
                      </Button>
                      <Button
                        onClick={sendTranscript}
                        disabled={!transcript.trim() || isProcessing}
                        className="bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Kirim
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chat Interface */}
          <Card className="border-2 border-green-200">
            <CardHeader className="bg-green-50">
              <CardTitle className="flex items-center gap-2 text-green-800">Percakapan</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex h-[400px] flex-col">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.length === 0 ? (
                      <div className="py-8 text-center text-gray-500">
                        <Mic className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                        <p>Mulai percakapan dengan berbicara ke mikrofon</p>
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
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white">
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
                                message.type === 'user' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              <p className="text-sm">{message.content}</p>
                              <div className="mt-1 flex items-center justify-between text-xs opacity-70">
                                <span>{message.timestamp.toLocaleTimeString()}</span>
                                {message.type === 'assistant' && (
                                  <Button
                                    onClick={() => speakText(message.content)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-1 text-xs hover:bg-transparent"
                                  >
                                    <Volume2 className="h-3 w-3" />
                                  </Button>
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

          {/* Instructions */}
          <Card>
            <CardContent className="p-6">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Cara Menggunakan</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>1. Klik tombol mikrofon untuk mulai berbicara</p>
                <p>2. Ucapkan pertanyaan Anda dengan jelas</p>
                <p>3. Klik tombol merah untuk berhenti merekam</p>
                <p>4. Tinjau teks yang dihasilkan dan klik &quot;Kirim&quot;</p>
                <p>5. Dengarkan respons dengan mengklik tombol speaker</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
