'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import GestureRecognition from '@/components/gesture/gesture-recognition'
import { Hand, MessageCircle, Send, User, Bot } from 'lucide-react'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  confidence?: number
}

export default function Home() {
  const [currentWord, setCurrentWord] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState<string>('')
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

  // Send message to chat (either gesture-formed word or typed message)
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
          session_id: `web-session-${Date.now()}`, // Generate unique session ID
          language: 'id', // Indonesian language
          max_sources: 3,
          similarity_threshold: 0.7
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer || 'Sorry, I could not process your question at this time.',
        timestamp: new Date(),
        confidence: data.confidence,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Show error message to user
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I am having trouble connecting to the AI service. Please try again later.',
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
      sendMessage(currentWord)
      setCurrentWord('')
    }
  }, [currentWord, sendMessage])

  // Send typed message
  const sendTypedMessage = useCallback(() => {
    if (inputMessage.trim()) {
      sendMessage(inputMessage)
      setInputMessage('')
    }
  }, [inputMessage, sendMessage])

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Hand className="h-8 w-8 text-blue-600" />
              Tunarasa - A-Z Sign Language Recognition
            </CardTitle>
            <p className="text-gray-600">
              Real-time hand gesture recognition for A-Z sign language with AI-powered Q&A assistance
            </p>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Gesture Recognition Panel */}
          <div className="space-y-4">
            <GestureRecognition
              onLetterDetected={handleLetterDetected}
              onWordFormed={handleWordFormed}
              showAlternatives={true}
              enableWordFormation={true}
              maxWordLength={50}
            />

            {/* Gesture Word Actions */}
            {currentWord && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Word</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="px-4 py-2 font-mono text-xl">
                      {currentWord}
                    </Badge>
                    <span className="text-sm text-gray-500">{currentWord.length} letters</span>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={sendGestureWord} className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Ask Question
                    </Button>
                    <Button variant="outline" onClick={() => setCurrentWord('')}>
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Chat Panel */}
          <Card className="flex h-[600px] flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Q&A Chat
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col p-0">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">
                      <MessageCircle className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                      <p>Start a conversation by signing letters or typing a question</p>
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
                              message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            <div className="mt-1 flex items-center justify-between text-xs opacity-70">
                              <span>{message.timestamp.toLocaleTimeString()}</span>
                              {message.confidence && (
                                <span className="ml-2">
                                  {Math.round(message.confidence * 100)}% confidence
                                </span>
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
                      <div className="rounded-lg bg-gray-200 px-4 py-2 text-gray-800">
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

              <Separator />

              {/* Input */}
              <div className="p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your question here..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendTypedMessage()}
                  />
                  <Button onClick={sendTypedMessage} disabled={!inputMessage.trim() || isProcessing}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-sm text-gray-500">
              <p>Tunarasa - Empowering communication through sign language recognition</p>
              <p>Built with Next.js, MediaPipe, TensorFlow.js, and FastAPI</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
