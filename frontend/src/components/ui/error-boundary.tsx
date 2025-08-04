/**
 * Enhanced React Error Boundary with comprehensive error handling
 * Provides graceful error recovery and detailed error reporting
 */

'use client'

/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/require-await */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, RefreshCw, Bug, ChevronDown, Home, HelpCircle, Copy, CheckCircle } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
  retryCount: number
  showDetails: boolean
  copied: boolean
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  maxRetries?: number
  showErrorDetails?: boolean
  level?: 'page' | 'component' | 'feature'
  componentName?: string
  resetOnPropsChange?: boolean
  resetKeys?: Array<string | number>
}

// interface ErrorBoundaryContext {
//   componentStack: string[]
//   errorBoundaries: string[]
// }

// Enhanced error classification
type ErrorCategory =
  | 'network'
  | 'validation'
  | 'permission'
  | 'gesture_recognition'
  | 'ai_service'
  | 'runtime'
  | 'unknown'

interface ClassifiedError {
  category: ErrorCategory
  severity: 'low' | 'medium' | 'high' | 'critical'
  userMessage: string
  technicalMessage: string
  suggestedAction: string
  recoverable: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeouts: NodeJS.Timeout[] = []
  private errorReportingQueue: Array<{
    error: Error
    errorInfo: ErrorInfo
    timestamp: Date
    userAgent: string
    url: string
  }> = []

  constructor(props: ErrorBoundaryProps) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      showDetails: false,
      copied: false,
    }

    // Bind methods
    this.handleRetry = this.handleRetry.bind(this)
    this.handleReset = this.handleReset.bind(this)
    this.classifyError = this.classifyError.bind(this)
    this.reportError = this.reportError.bind(this)
    this.copyErrorDetails = this.copyErrorDetails.bind(this)
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
      hasError: true,
      error,
      errorId,
      showDetails: false,
      copied: false,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error info
    this.setState({ errorInfo })

    // Report error
    void this.reportError(error, errorInfo)

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 React Error Boundary Caught Error')
      console.error('Error:', error)
      console.error('Component Stack:', errorInfo.componentStack)
      console.error('Error Boundary:', this.props.componentName || 'Unknown')
      console.groupEnd()
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props
    const { hasError, error } = this.state

    // Reset error state if resetKeys changed
    if (hasError && error && resetOnPropsChange && resetKeys) {
      const prevResetKeys = prevProps.resetKeys || []
      const hasResetKeyChanged = resetKeys.some((key, index) => key !== prevResetKeys[index])

      if (hasResetKeyChanged) {
        this.handleReset()
      }
    }
  }

  componentWillUnmount() {
    // Clear any pending timeouts
    this.retryTimeouts.forEach((timeout) => clearTimeout(timeout))
  }

  private classifyError(error: Error): ClassifiedError {
    const errorMessage = error.message.toLowerCase()
    const errorStack = error.stack?.toLowerCase() || ''

    // Network errors
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('connection')) {
      return {
        category: 'network',
        severity: 'medium',
        userMessage: 'Koneksi internet bermasalah. Periksa koneksi Anda dan coba lagi.',
        technicalMessage: error.message,
        suggestedAction: 'Periksa koneksi internet dan coba lagi',
        recoverable: true,
      }
    }

    // Gesture recognition errors
    if (errorMessage.includes('gesture') || errorMessage.includes('mediapipe') || errorMessage.includes('camera')) {
      return {
        category: 'gesture_recognition',
        severity: 'high',
        userMessage: 'Pengenalan isyarat mengalami masalah. Periksa kamera dan pencahayaan.',
        technicalMessage: error.message,
        suggestedAction: 'Izinkan akses kamera dan pastikan pencahayaan cukup',
        recoverable: true,
      }
    }

    // AI service errors
    if (
      errorMessage.includes('llm') ||
      errorMessage.includes('ai') ||
      errorMessage.includes('groq') ||
      errorMessage.includes('pinecone')
    ) {
      return {
        category: 'ai_service',
        severity: 'high',
        userMessage: 'Layanan AI sedang mengalami gangguan. Coba lagi dalam beberapa saat.',
        technicalMessage: error.message,
        suggestedAction: 'Tunggu beberapa saat dan coba lagi',
        recoverable: true,
      }
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
      return {
        category: 'validation',
        severity: 'low',
        userMessage: 'Data yang dimasukkan tidak valid. Periksa dan coba lagi.',
        technicalMessage: error.message,
        suggestedAction: 'Periksa input dan pastikan format sudah benar',
        recoverable: true,
      }
    }

    // Permission errors
    if (
      errorMessage.includes('permission') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden')
    ) {
      return {
        category: 'permission',
        severity: 'medium',
        userMessage: 'Anda tidak memiliki izin untuk mengakses fitur ini.',
        technicalMessage: error.message,
        suggestedAction: 'Hubungi administrator atau login ulang',
        recoverable: false,
      }
    }

    // Runtime errors
    if (
      error instanceof TypeError ||
      error instanceof ReferenceError ||
      errorStack.includes('typeerror') ||
      errorStack.includes('referenceerror')
    ) {
      return {
        category: 'runtime',
        severity: 'critical',
        userMessage: 'Terjadi kesalahan sistem. Tim teknis telah diberitahu.',
        technicalMessage: error.message,
        suggestedAction: 'Muat ulang halaman atau hubungi dukungan teknis',
        recoverable: true,
      }
    }

    // Default classification
    return {
      category: 'unknown',
      severity: 'medium',
      userMessage: 'Terjadi kesalahan yang tidak terduga. Silakan coba lagi.',
      technicalMessage: error.message,
      suggestedAction: 'Muat ulang halaman atau hubungi dukungan teknis',
      recoverable: true,
    }
  }

  private async reportError(error: Error, errorInfo: ErrorInfo): Promise<void> {
    try {
      const errorReport = {
        error,
        errorInfo,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        errorId: this.state.errorId,
        componentName: this.props.componentName,
        level: this.props.level,
        retryCount: this.state.retryCount,
      }

      // Queue for batch reporting
      this.errorReportingQueue.push(errorReport)

      // In production, send to error reporting service
      if (process.env.NODE_ENV === 'production') {
        // Send to your error reporting service
        // await errorReportingService.report(errorReport)
        console.log('Error reported:', errorReport.errorId)
      }
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError)
    }
  }

  private handleRetry(): void {
    const { maxRetries = 3 } = this.props
    const { retryCount } = this.state

    if (retryCount >= maxRetries) {
      return
    }

    // Clear error state with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000)

    const timeout = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
        showDetails: false,
        copied: false,
      })
    }, delay)

    this.retryTimeouts.push(timeout)
  }

  private handleReset(): void {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      showDetails: false,
      copied: false,
    })
  }

  private async copyErrorDetails(): Promise<void> {
    try {
      const { error, errorInfo, errorId } = this.state
      const classifiedError = error ? this.classifyError(error) : null

      const errorDetails = {
        errorId,
        timestamp: new Date().toISOString(),
        component: this.props.componentName || 'Unknown',
        category: classifiedError?.category,
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
      }

      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      this.setState({ copied: true })

      setTimeout(() => {
        this.setState({ copied: false })
      }, 2000)
    } catch (err) {
      console.error('Failed to copy error details:', err)
    }
  }

  render() {
    const { hasError, error, errorInfo, retryCount, showDetails, copied } = this.state
    const {
      children,
      fallback,
      maxRetries = 3,
      showErrorDetails = true,
      level = 'component',
      componentName = 'Unknown Component',
    } = this.props

    if (!hasError) {
      return children
    }

    // Use custom fallback if provided
    if (fallback) {
      return fallback
    }

    const classifiedError = error ? this.classifyError(error) : null
    const canRetry = retryCount < maxRetries && classifiedError?.recoverable

    return (
      <div className="flex min-h-[400px] w-full items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Terjadi Kesalahan
              {classifiedError && (
                <Badge variant={classifiedError.severity === 'critical' ? 'destructive' : 'secondary'} className="ml-2">
                  {classifiedError.category.replace(/_/g, ' ').toUpperCase()}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* User-friendly error message */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {classifiedError?.userMessage || 'Terjadi kesalahan yang tidak terduga.'}
              </AlertDescription>
            </Alert>

            {/* Suggested action */}
            {classifiedError?.suggestedAction && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  <strong>Saran:</strong>
                </div>
                <p className="mt-1">{classifiedError.suggestedAction}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              {canRetry && (
                <Button onClick={this.handleRetry} className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Coba Lagi {retryCount > 0 && `(${retryCount}/${maxRetries})`}
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => (window.location.href = '/')}
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Kembali ke Beranda
              </Button>

              <Button variant="outline" onClick={() => window.location.reload()} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Muat Ulang Halaman
              </Button>
            </div>

            {/* Technical details (expandable) */}
            {showErrorDetails && error && process.env.NODE_ENV === 'development' && (
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    this.setState({ showDetails: !showDetails })
                  }}
                  className="flex items-center gap-2"
                >
                  <Bug className="h-4 w-4" />
                  Detail Teknis
                  <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                </Button>

                {showDetails && (
                  <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900">
                    <div className="mb-2 flex items-center justify-between">
                      <strong>Error Details:</strong>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void this.copyErrorDetails()
                        }}
                        className="flex items-center gap-2"
                      >
                        {copied ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Disalin
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Salin
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <strong>Component:</strong> {componentName}
                      </div>
                      <div>
                        <strong>Level:</strong> {level}
                      </div>
                      <div>
                        <strong>Error ID:</strong> {this.state.errorId}
                      </div>
                      <div>
                        <strong>Message:</strong> {error.message}
                      </div>
                      {error.stack && (
                        <div>
                          <strong>Stack:</strong>
                          <pre className="mt-1 max-h-32 overflow-auto text-xs whitespace-pre-wrap">{error.stack}</pre>
                        </div>
                      )}
                      {errorInfo?.componentStack && (
                        <div>
                          <strong>Component Stack:</strong>
                          <pre className="mt-1 max-h-32 overflow-auto text-xs whitespace-pre-wrap">
                            {errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Retry exhausted message */}
            {retryCount >= maxRetries && classifiedError?.recoverable && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Mencoba sebanyak {maxRetries} kali namun masih gagal. Silakan muat ulang halaman atau hubungi dukungan
                  teknis.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>,
) {
  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return ComponentWithErrorBoundary
}

export default ErrorBoundary
