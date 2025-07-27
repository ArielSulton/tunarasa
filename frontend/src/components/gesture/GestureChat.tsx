/**
 * Gesture Chat Component
 * Integrates gesture recognition with Q&A chat interface
 * Enhanced with performance optimizations and error boundaries
 */

'use client'

import React, { useState, useRef, useEffect, memo } from 'react'
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
import ErrorBoundary from '@/components/ui/error-boundary'
import {
  useDebounce,
  usePerformanceMonitor,
  useStableCallback,
  useMemoizedValue,
  useComponentLifecycle,
  useVirtualList,
} from '@/lib/utils/performance'

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

// Memoized message component for better performance
const MessageItem = memo<{
  message: Message
  isUser: boolean
}>(({ message, isUser }) => {
  const messageContent = useMemoizedValue(
    () => (
      <div
        className={`inline-block rounded-lg px-4 py-2 ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
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
    ),
    [message, isUser],
  )

  const sources = useMemoizedValue(() => {
    if (!message.sources || message.sources.length === 0) return null

    return (
      <div className="mt-2 space-y-1">
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <FileText className="h-3 w-3" />
          Sources:
        </div>
        {message.sources.slice(0, 2).map((source, index) => (
          <div key={index} className="bg-muted/50 rounded p-2 text-xs">
            <div className="font-medium">{source.title}</div>
            <div className="text-muted-foreground truncate">{source.content.substring(0, 100)}...</div>
            <div className="mt-1 text-xs">Similarity: {Math.round(source.similarity_score * 100)}%</div>
          </div>
        ))}
      </div>
    )
  }, [message.sources])

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {isUser ? (
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
      <div className={`max-w-[80%] flex-1 ${isUser ? 'text-right' : 'text-left'}`}>
        {messageContent}
        {sources}
      </div>
    </div>
  )
})

MessageItem.displayName = 'MessageItem'

// Main component with performance optimizations
const GestureChatComponent = memo<GestureChatProps>(
  ({ className = '', language = 'sibi', responseLanguage = 'id' }) => {
    // Performance monitoring
    usePerformanceMonitor('GestureChat')
    useComponentLifecycle('GestureChat')

    // State management
    const [messages, setMessages] = useState<Message[]>([])
    const [inputText, setInputText] = useState('')
    const [inputMode, setInputMode] = useState<'gesture' | 'keyboard'>('gesture')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [currentGesture, setCurrentGesture] = useState<GestureRecognitionResult | null>(null)

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const scrollAreaRef = useRef<HTMLDivElement>(null)

    // Debounced input for better performance
    const _debouncedInputText = useDebounce(inputText, 300)

    // Virtual scrolling for large message lists
    const { visibleItems, totalHeight, setScrollTop } = useVirtualList(
      messages,
      60, // estimated item height
      400, // container height
      5, // overscan
    )

    // Memoized values for performance
    const hasMessages = useMemoizedValue(() => messages.length > 0, [messages.length])
    const canSubmit = useMemoizedValue(() => inputText.trim().length > 0, [inputText])

    // Auto-scroll to bottom when new messages arrive (throttled)
    useEffect(() => {
      const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }

      // Throttle auto-scroll to prevent performance issues
      const timeoutId = setTimeout(scrollToBottom, 100)
      return () => clearTimeout(timeoutId)
    }, [messages.length])

    // Focus input when switching to keyboard mode
    useEffect(() => {
      if (inputMode === 'keyboard' && inputRef.current) {
        const focusTimeout = setTimeout(() => {
          inputRef.current?.focus()
        }, 100)
        return () => clearTimeout(focusTimeout)
      }
    }, [inputMode])

    // Optimized send message function with error handling
    const sendMessage = useStableCallback(
      async (...args: unknown[]) => {
        const [text, gestureConfidence] = args as [string, number | undefined]
        if (typeof text !== 'string') return

        const userMessage: Message = {
          id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
            id: `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
          const errorMsg = err instanceof Error ? err.message : 'Failed to send message'
          setError(errorMsg)

          const errorMessage: Message = {
            id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

    // Optimized gesture text handler
    const handleGestureText = useStableCallback(
      (...args: unknown[]) => {
        const [text, confidence] = args as [string, number]
        void sendMessage(text, confidence)
      },
      [sendMessage],
    )

    // Optimized keyboard submit handler
    const handleKeyboardSubmit = useStableCallback(
      (...args: unknown[]) => {
        const [e] = args as [React.FormEvent]
        e?.preventDefault()
        if (canSubmit && !isLoading) {
          void sendMessage(inputText.trim())
          setInputText('')
        }
      },
      [inputText, sendMessage, canSubmit, isLoading],
    )

    // Optimized gesture update handler
    const handleGestureUpdate = useStableCallback((...args: unknown[]) => {
      const [gesture] = args as [GestureRecognitionResult]
      setCurrentGesture(gesture)
    }, [])

    // Memoized input mode toggle buttons
    const inputModeButtons = useMemoizedValue(
      () => (
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
      ),
      [inputMode],
    )

    // Memoized empty state
    const emptyState = useMemoizedValue(
      () => (
        <div className="text-muted-foreground py-8 text-center">
          <MessageCircle className="text-muted-foreground/50 mx-auto mb-4 h-12 w-12" />
          <p>Mulai percakapan dengan bahasa isyarat atau ketik pesan Anda</p>
        </div>
      ),
      [],
    )

    // Memoized loading indicator
    const loadingIndicator = useMemoizedValue(
      () => (
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Processing...</span>
        </div>
      ),
      [],
    )

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
              {inputModeButtons}
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
              <ScrollArea
                ref={scrollAreaRef}
                className="flex-1 pr-4"
                onScrollCapture={(e) => {
                  const scrollTop = (e.target as HTMLElement).scrollTop
                  setScrollTop(scrollTop)
                }}
              >
                <div className="space-y-4" style={{ height: messages.length > 50 ? totalHeight : 'auto' }}>
                  {!hasMessages && emptyState}

                  {/* Render messages with virtualization for large lists */}
                  {messages.length > 50
                    ? visibleItems.map(({ item: message, index: _index }) => (
                        <MessageItem key={message.id} message={message} isUser={message.type === 'user'} />
                      ))
                    : messages.map((message) => (
                        <MessageItem key={message.id} message={message} isUser={message.type === 'user'} />
                      ))}

                  {/* Loading indicator */}
                  {isLoading && loadingIndicator}

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
                    autoComplete="off"
                  />
                  <Button type="submit" disabled={!canSubmit || isLoading} className="flex-shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Gesture Recognition Panel */}
          {inputMode === 'gesture' && (
            <ErrorBoundary
              componentName="GestureRecognition"
              level="feature"
              showErrorDetails={process.env.NODE_ENV === 'development'}
            >
              <div className="w-96 flex-shrink-0">
                <GestureRecognition
                  onSendText={handleGestureText}
                  onGestureUpdate={handleGestureUpdate}
                  language={language}
                />
              </div>
            </ErrorBoundary>
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
  },
)

GestureChatComponent.displayName = 'GestureChat'

// Export component wrapped with error boundary
export function GestureChat(props: GestureChatProps) {
  return (
    <ErrorBoundary
      componentName="GestureChat"
      level="page"
      showErrorDetails={process.env.NODE_ENV === 'development'}
      resetKeys={[props.language as string, props.responseLanguage as string]}
    >
      <GestureChatComponent {...props} />
    </ErrorBoundary>
  )
}
