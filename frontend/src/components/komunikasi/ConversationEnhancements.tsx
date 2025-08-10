'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Download, CheckCircle, AlertTriangle, Loader2, Zap } from 'lucide-react'

import { ChatMessage } from '@/types'

interface ConversationEnhancementsProps {
  sessionId: string
  messages: ChatMessage[]
  onTypoCorrection?: (originalText: string, correctedText: string) => void
  disabled?: boolean
  inline?: boolean // When true, shows only QR & summary inline in chat
  typoOnly?: boolean // When true, shows only typo correction
}

interface SummaryData {
  conversation_id: number
  summary_content: string
  qr_code?: {
    qr_code_base64: string
    access_token: string
    download_url: string
    expires_at: string
  }
  download_url?: string
}

export function ConversationEnhancements({
  sessionId,
  messages,
  onTypoCorrection,
  disabled = false,
  inline = false,
  typoOnly = false,
}: ConversationEnhancementsProps) {
  // Helper function to clean session ID for backend validation
  const cleanSessionId = useCallback((id: string): string => {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 255)
  }, [])
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [typoCorrection, setTypoCorrection] = useState<{
    original: string
    corrected: string
    confidence: number
  } | null>(null)
  const [isCorrecting, setIsCorrecting] = useState(false)
  const [lastInputText, setLastInputText] = useState('')

  // Generate conversation summary with QR code
  const generateSummary = useCallback(async () => {
    if (!sessionId || messages.length === 0) return

    setIsGeneratingSummary(true)
    setSummaryError(null)

    try {
      // Step 1: Save conversation messages to database first
      console.log('Saving conversation to database...', { sessionId, messageCount: messages.length })

      const saveResponse = await fetch('/api/chat/save-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          messages: messages.map((msg) => ({
            id: msg.id,
            type: msg.type,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            confidence: msg.confidence,
            adminName: msg.adminName,
          })),
        }),
      })

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text()
        console.error('Failed to save conversation:', saveResponse.status, errorText)
        throw new Error(`Failed to save conversation to database (${saveResponse.status})`)
      }

      const saveResult = await saveResponse.json()
      const conversationId = saveResult.conversationId
      console.log('Conversation saved successfully:', { conversationId })

      // Step 2: Generate summary using the database conversation ID
      const requestPayload = {
        conversation_id: conversationId,
        user_id: 1, // Anonymous user
        format_type: 'text' as const,
        include_qr: true,
      }

      console.log('Generating summary for saved conversation:', requestPayload)

      // Use environment variable for backend URL
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
      const response = await fetch(`${backendUrl}/api/v1/summary/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Summary generation error:', response.status, errorText)
        throw new Error(`Failed to generate summary (${response.status}): ${errorText}`)
      }

      const result = await response.json()
      const summaryData = result.data ?? result

      // Debug QR code data
      console.log('Raw summary response:', result)
      console.log('QR code data:', summaryData.qr_code)
      if (summaryData.qr_code?.qr_code_base64) {
        console.log('QR base64 length:', summaryData.qr_code.qr_code_base64.length)
      }

      setSummaryData(summaryData)
      console.log('Summary generated successfully:', summaryData)
    } catch (error) {
      console.error('Error generating summary:', error)
      setSummaryError(
        error instanceof Error
          ? `Failed to generate summary: ${error.message}`
          : 'Failed to generate conversation summary. Please try again.',
      )
    } finally {
      setIsGeneratingSummary(false)
    }
  }, [sessionId, messages])

  // Download PDF summary
  const downloadPDF = useCallback(async () => {
    if (!summaryData?.qr_code?.access_token) {
      console.error('No access token available for PDF download')
      return
    }

    try {
      console.log('Downloading PDF with access token:', summaryData.qr_code.access_token)

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
      const response = await fetch(`${backendUrl}/api/v1/summary/${summaryData.qr_code.access_token}?format=text`, {
        method: 'GET',
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('PDF download error:', response.status, errorText)
        throw new Error(`Failed to download summary (${response.status})`)
      }

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `conversation-summary-${cleanSessionId(sessionId)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      console.log('PDF downloaded successfully')
    } catch (error) {
      console.error('Error downloading PDF:', error)
      // Show user-friendly error message
      setSummaryError('Failed to download PDF. Please try again or check your connection.')
    }
  }, [summaryData, sessionId, cleanSessionId])

  // Correct typo in detected text (unused for now)
  const _correctTypo = useCallback(
    async (inputText: string) => {
      if (!inputText || inputText === lastInputText) return

      // Validate input length (1-500 characters required by backend)
      const trimmedText = inputText.trim()
      if (trimmedText.length === 0 || trimmedText.length > 500) return

      setIsCorrecting(true)
      setLastInputText(inputText)

      try {
        // Clean session ID to match backend pattern ^[a-zA-Z0-9_-]+$ and max 255 chars
        const cleanedSessionId = cleanSessionId(sessionId)

        // Use RAG endpoint for typo correction with dedicated correction function
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
        const response = await fetch(`${backendUrl}/api/v1/rag/ask`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: trimmedText,
            session_id: cleanedSessionId,
            language: 'id', // Must be 'id' or 'en' as per backend validation
            conversation_mode: 'casual',
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Backend validation error:', response.status, errorText)
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()

        // Extract corrected question from RAG response
        const correctedText = result.question ?? trimmedText // RAG returns corrected question
        const confidence = result.confidence ?? 0.7

        // Only show correction if text actually changed
        if (correctedText !== trimmedText && correctedText.length > 0) {
          setTypoCorrection({
            original: trimmedText,
            corrected: correctedText,
            confidence,
          })
          onTypoCorrection?.(trimmedText, correctedText)
        } else {
          // Clear any previous corrections if text is same
          setTypoCorrection(null)
        }
      } catch (error) {
        console.error('Error correcting typo:', error)
        // Don't show error to user for typo correction failures
        setTypoCorrection(null)
      } finally {
        setIsCorrecting(false)
      }
    },
    [sessionId, lastInputText, onTypoCorrection, cleanSessionId],
  )

  // When typoOnly is true, show only typo correction
  if (typoOnly) {
    return (
      <div className="space-y-4">
        {/* Typo Correction Display */}
        {typoCorrection && (
          <Alert className="border-blue-200 bg-blue-50">
            <Zap className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <div className="font-medium">Saran perbaikan teks:</div>
              <div className="mt-2 text-sm">
                <span className="rounded bg-white px-2 py-1 font-mono text-green-700">{typoCorrection.corrected}</span>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Manual Typo Correction */}
        {isCorrecting && (
          <Alert className="border-blue-200 bg-blue-50">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <AlertDescription className="text-blue-800">Menganalisis teks untuk perbaikan...</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  // When inline is true, show only QR & summary in a compact format for inline chat display
  if (inline) {
    return (
      <div className="space-y-3">
        {/* Inline Conversation Summary */}
        {messages.length > 0 && (
          <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium text-green-800">Ringkasan Percakapan</p>
              </div>

              {!summaryData ? (
                <div className="space-y-3 text-center">
                  <Button
                    onClick={() => void generateSummary()}
                    disabled={disabled || isGeneratingSummary || messages.length === 0}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                    data-generate-summary
                  >
                    {isGeneratingSummary ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Membuat...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-3 w-3" />
                        Buat QR & Ringkasan
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <div className="text-xs text-green-700">✅ Ringkasan berhasil dibuat!</div>

                  {/* QR Code Display - Compact */}
                  {summaryData.qr_code && (
                    <div className="space-y-2">
                      <div className="flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:image/png;base64,${summaryData.qr_code.qr_code_base64}`}
                          alt="Summary QR Code"
                          className="h-20 w-20 rounded border shadow"
                        />
                      </div>
                      <p className="text-xs text-green-700">Pindai QR untuk akses ringkasan</p>
                    </div>
                  )}

                  {/* Download Actions - Compact */}
                  <Button
                    onClick={() => void downloadPDF()}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!summaryData.qr_code}
                    size="sm"
                  >
                    <Download className="mr-2 h-3 w-3" />
                    Unduh PDF
                  </Button>
                </div>
              )}

              {summaryError && <div className="rounded bg-red-100 p-2 text-xs text-red-700">⚠️ {summaryError}</div>}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Default: Full view with both typo correction and summary
  return (
    <div className="space-y-4">
      {/* Typo Correction Display */}
      {typoCorrection && (
        <Alert className="border-blue-200 bg-blue-50">
          <Zap className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <div className="font-medium">Saran perbaikan teks:</div>
            <div className="mt-2 text-sm">
              <span className="rounded bg-white px-2 py-1 font-mono text-green-700">{typoCorrection.corrected}</span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Conversation Summary Section */}
      {messages.length > 0 && (
        <Card className="border-green-200">
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  <h3 className="font-medium">Ringkasan Percakapan</h3>
                </div>
                <Badge variant="outline" className="border-green-300 text-green-700">
                  {messages.length} pesan
                </Badge>
              </div>

              {!summaryData ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Buat ringkasan percakapan yang dapat diunduh dengan akses QR code.
                  </p>
                  <Button
                    onClick={() => void generateSummary()}
                    disabled={disabled || isGeneratingSummary || messages.length === 0}
                    className="w-full bg-green-600 hover:bg-green-700"
                    data-generate-summary
                  >
                    {isGeneratingSummary ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Membuat Ringkasan...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Buat Ringkasan & QR
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Ringkasan berhasil dibuat! Pindai QR atau unduh PDF.
                    </AlertDescription>
                  </Alert>

                  {/* QR Code Display */}
                  {summaryData.qr_code && (
                    <div className="space-y-3 text-center">
                      <div className="flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:image/png;base64,${summaryData.qr_code.qr_code_base64}`}
                          alt="Summary QR Code"
                          className="h-32 w-32 rounded-lg border shadow"
                        />
                      </div>
                      <p className="text-sm font-medium">Pindai untuk mengakses ringkasan</p>
                    </div>
                  )}

                  {/* Download Actions */}
                  <div className="space-y-2">
                    <Button
                      onClick={() => void downloadPDF()}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={!summaryData.qr_code}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Unduh PDF
                    </Button>
                  </div>
                </div>
              )}

              {summaryError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{summaryError}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Typo Correction */}
      {isCorrecting && (
        <Alert className="border-blue-200 bg-blue-50">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <AlertDescription className="text-blue-800">Menganalisis teks untuk perbaikan...</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
