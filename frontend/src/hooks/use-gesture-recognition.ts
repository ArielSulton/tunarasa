/**
 * useGestureRecognition Hook
 * React hook for A-Z gesture recognition with MediaPipe and TensorFlow.js
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  GestureRecognitionService,
  GestureRecognitionResult,
  GestureRecognitionConfig,
} from '@/lib/ai/services/gesture-recognition'

export interface UseGestureRecognitionOptions {
  config?: GestureRecognitionConfig
  autoStart?: boolean
  onResult?: (result: GestureRecognitionResult) => void
  onError?: (error: Error) => void
  onStatus?: (status: string) => void
}

export interface UseGestureRecognitionReturn {
  // State
  isInitialized: boolean
  isRunning: boolean
  isLoading: boolean
  error: Error | null
  status: string
  lastResult: GestureRecognitionResult | null

  // Controls
  start: () => Promise<void>
  stop: () => Promise<void>
  initialize: (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => Promise<void>

  // Configuration
  updateConfig: (config: Partial<GestureRecognitionConfig>) => void
  getConfig: () => GestureRecognitionConfig | null

  // Utility
  getSystemStatus: () => unknown
  dispose: () => void
}

export const useGestureRecognition = (options: UseGestureRecognitionOptions = {}): UseGestureRecognitionReturn => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [status, setStatus] = useState<string>('Not initialized')
  const [lastResult, setLastResult] = useState<GestureRecognitionResult | null>(null)

  const gestureServiceRef = useRef<GestureRecognitionService | null>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null)

  // Initialize gesture recognition service
  useEffect(() => {
    gestureServiceRef.current = new GestureRecognitionService(options.config)

    // Set up callbacks
    gestureServiceRef.current.setOnResult((result) => {
      setLastResult(result)
      setError(null)
      if (options.onResult) {
        options.onResult(result)
      }
    })

    gestureServiceRef.current.setOnError((error) => {
      setError(error)
      setIsRunning(false)
      if (options.onError) {
        options.onError(error)
      }
    })

    gestureServiceRef.current.setOnStatus((status) => {
      setStatus(status)
      if (options.onStatus) {
        options.onStatus(status)
      }
    })

    return () => {
      if (gestureServiceRef.current) {
        gestureServiceRef.current.dispose()
      }
    }
  }, [options])

  // Initialize the system
  const initialize = useCallback(
    async (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<void> => {
      if (!gestureServiceRef.current) {
        throw new Error('Gesture recognition service not available')
      }

      try {
        setIsLoading(true)
        setError(null)

        videoElementRef.current = videoElement
        canvasElementRef.current = canvasElement

        await gestureServiceRef.current.initialize(videoElement, canvasElement)

        setIsInitialized(true)
        setStatus('Initialized successfully')
      } catch (error) {
        setError(error as Error)
        setIsInitialized(false)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  // Start gesture recognition
  const start = useCallback(async (): Promise<void> => {
    if (!gestureServiceRef.current) {
      throw new Error('Gesture recognition service not available')
    }

    if (!isInitialized) {
      throw new Error('Gesture recognition not initialized')
    }

    try {
      setIsLoading(true)
      setError(null)

      await gestureServiceRef.current.start()
      setIsRunning(true)
      setStatus('Recognition started')
    } catch (error) {
      setError(error as Error)
      setIsRunning(false)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [isInitialized])

  // Stop gesture recognition
  const stop = useCallback(async (): Promise<void> => {
    if (!gestureServiceRef.current) {
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      await gestureServiceRef.current.stop()
      setIsRunning(false)
      setStatus('Recognition stopped')
    } catch (error) {
      setError(error as Error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Update configuration
  const updateConfig = useCallback((config: Partial<GestureRecognitionConfig>): void => {
    if (gestureServiceRef.current) {
      gestureServiceRef.current.updateConfig(config)
    }
  }, [])

  // Get current configuration
  const getConfig = useCallback((): GestureRecognitionConfig | null => {
    if (gestureServiceRef.current) {
      return gestureServiceRef.current.getConfig()
    }
    return null
  }, [])

  // Get system status
  const getSystemStatus = useCallback(() => {
    if (gestureServiceRef.current) {
      return gestureServiceRef.current.getStatus()
    }
    return null
  }, [])

  // Dispose of resources
  const dispose = useCallback((): void => {
    if (gestureServiceRef.current) {
      gestureServiceRef.current.dispose()
      setIsInitialized(false)
      setIsRunning(false)
      setError(null)
      setStatus('Disposed')
      setLastResult(null)
    }
  }, [])

  // Auto-start if configured
  useEffect(() => {
    if (options.autoStart && isInitialized && !isRunning && !error) {
      start().catch(console.error)
    }
  }, [options.autoStart, isInitialized, isRunning, error, start])

  return {
    // State
    isInitialized,
    isRunning,
    isLoading,
    error,
    status,
    lastResult,

    // Controls
    start,
    stop,
    initialize,

    // Configuration
    updateConfig,
    getConfig,

    // Utility
    getSystemStatus,
    dispose,
  }
}

export default useGestureRecognition
