/**
 * Gesture Chat Component
 * Integrates gesture recognition with Q&A chat interface
 */

'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { MessageCircle, Hand, Keyboard, Send, Bot, User, Clock, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { GestureRecognition } from './gesture-recognition'
import { gestureApi, GestureTextResponse } from '@/lib/api/gestureApi'
import { GestureRecognitionResult } from '@/lib/ai/services/gesture-recognition'

interface Message {
  id: string
  content: string
  type: 'user' | 'bot'
  timestamp: Date
  confidence?: number
  sources?: Array<{
    title: string
    content: string
    similarity_score: number
  }>
  processingTime?: number
  isGestureInput?: boolean
}

interface GestureChatProps {
  className?: string
  language?: 'sibi' | 'bisindo'
  responseLanguage?: 'id' | 'en'
}

export function GestureChat({ className = '', language = 'sibi', responseLanguage = 'id' }: GestureChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [inputMode, setInputMode] = useState<'gesture' | 'keyboard'>('gesture')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentGesture, setCurrentGesture] = useState<GestureRecognitionResult | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when switching to keyboard mode
  useEffect(() => {
    if (inputMode === 'keyboard' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [inputMode])

  // Send text message to backend
  const sendMessage = useCallback(
    async (text: string, gestureConfidence?: number) => {
      if (!text.trim()) return

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        content: text,
        type: 'user',
        timestamp: new Date(),
        confidence: gestureConfidence,
        isGestureInput: gestureConfidence !== undefined,
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)
      setError(null)

      try {
        const response: GestureTextResponse = await gestureApi.processGestureText({
          text,
          language: responseLanguage,
          gesture_confidence: gestureConfidence,
        })

        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          content: response.answer,
          type: 'bot',
          timestamp: new Date(),
          confidence: response.confidence,
          sources: response.sources?.map((source) => ({
            title: source.title || source.filename,
            content: source.content,
            similarity_score: source.similarity_score,
          })),
          processingTime: response.processing_time,
        }

        setMessages((prev) => [...prev, botMessage])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message')

        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          content: 'Maaf, terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi.',
          type: 'bot',
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
      }
    },
    [responseLanguage],
  )

  // Handle gesture text input
  const handleGestureText = useCallback(
    (text: string, confidence: number) => {
      sendMessage(text, confidence)
    },
    [sendMessage],
  )

  // Handle keyboard text input
  const handleKeyboardSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      if (inputText.trim()) {
        sendMessage(inputText.trim())
        setInputText('')
      }
    },
    [inputText, sendMessage],
  )

  // Handle gesture updates for display
  const handleGestureUpdate = useCallback((gesture: GestureRecognitionResult) => {
    setCurrentGesture(gesture)
  }, [])

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Header */}
      <Card className="flex-shrink-0">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Sign Language Chat
              <Badge variant="outline" className="ml-2">
                {language.toUpperCase()}
              </Badge>
            </div>

            {/* Input Mode Toggle */}
            <div className="bg-muted flex gap-1 rounded-lg p-1">
              <Button
                variant={inputMode === 'gesture' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setInputMode('gesture')}
                className="h-8"
              >
                <Hand className="mr-1 h-4 w-4" />
                Gesture
              </Button>
              <Button
                variant={inputMode === 'keyboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setInputMode('keyboard')}
                className="h-8"
              >
                <Keyboard className="mr-1 h-4 w-4" />
                Keyboard
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Chat Messages */}
        <Card className="flex flex-1 flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Conversation</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            {/* Messages */}
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-muted-foreground py-8 text-center">
                    <MessageCircle className="text-muted-foreground/50 mx-auto mb-4 h-12 w-12" />
                    <p>Mulai percakapan dengan bahasa isyarat atau ketik pesan Anda</p>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                        message.type === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {message.type === 'user' ? (
                        message.isGestureInput ? (
                          <Hand className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>

                    {/* Message Content */}
                    <div className={`max-w-[80%] flex-1 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                      <div
                        className={`inline-block rounded-lg px-4 py-2 ${
                          message.type === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>

                        {/* Message Metadata */}
                        <div className="mt-2 flex items-center gap-2 text-xs opacity-70">
                          <Clock className="h-3 w-3" />
                          <span>{message.timestamp.toLocaleTimeString()}</span>

                          {message.confidence && (
                            <>
                              <Separator orientation="vertical" className="h-3" />
                              <span>Confidence: {Math.round(message.confidence * 100)}%</span>
                            </>
                          )}

                          {message.processingTime && (
                            <>
                              <Separator orientation="vertical" className="h-3" />
                              <span>{message.processingTime.toFixed(0)}ms</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-muted-foreground flex items-center gap-1 text-xs">
                            <FileText className="h-3 w-3" />
                            Sources:
                          </div>
                          {message.sources.slice(0, 2).map((source, index) => (
                            <div key={index} className="bg-muted/50 rounded p-2 text-xs">
                              <div className="font-medium">{source.title}</div>
                              <div className="text-muted-foreground truncate">
                                {source.content.substring(0, 100)}...
                              </div>
                              <div className="mt-1 text-xs">
                                Similarity: {Math.round(source.similarity_score * 100)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Processing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Keyboard Input */}
            {inputMode === 'keyboard' && (
              <form onSubmit={handleKeyboardSubmit} className="mt-4 flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ketik pesan Anda..."
                  disabled={isLoading}
                />
                <Button type="submit" disabled={!inputText.trim() || isLoading} className="flex-shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Gesture Recognition Panel */}
        {inputMode === 'gesture' && (
          <div className="w-96 flex-shrink-0">
            <GestureRecognition
              onSendText={handleGestureText}
              onGestureUpdate={handleGestureUpdate}
              language={language}
            />
          </div>
        )}
      </div>

      {/* Current Gesture Display (when in keyboard mode) */}
      {inputMode === 'keyboard' && currentGesture && (
        <Card className="mt-4 flex-shrink-0">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Hand className="h-4 w-4" />
                <span>Last Gesture:</span>
              </div>
              <Badge variant="outline">
                {currentGesture.letter} ({Math.round(currentGesture.confidence * 100)}%)
              </Badge>
              <span className="text-muted-foreground">{currentGesture.processingTime.toFixed(0)}ms</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
