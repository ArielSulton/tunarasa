/**
 * React hook for gesture recognition using MediaPipe and TensorFlow.js
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { gestureService, GestureResult, GestureSequence, GestureLanguage } from '@/lib/gesture/gestureRecognition'

interface UseGestureRecognitionOptions {
  language?: GestureLanguage
  autoStart?: boolean
  onGestureRecognized?: (result: GestureResult) => void
  onSequenceUpdate?: (sequence: GestureSequence) => void
  onError?: (error: Error) => void
}

interface UseGestureRecognitionReturn {
  isInitialized: boolean
  isActive: boolean
  currentGesture: GestureResult | null
  gestureSequence: GestureSequence
  error: string | null
  startRecognition: () => Promise<void>
  stopRecognition: () => void
  clearSequence: () => void
  videoRef: React.RefObject<HTMLVideoElement>
  statistics: any
}

export function useGestureRecognition(options: UseGestureRecognitionOptions = {}): UseGestureRecognitionReturn {
  const { language = 'asl', autoStart = false, onGestureRecognized, onSequenceUpdate, onError } = options

  const [isInitialized, setIsInitialized] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [currentGesture, setCurrentGesture] = useState<GestureResult | null>(null)
  const [gestureSequence, setGestureSequence] = useState<GestureSequence>({
    letters: [],
    word: '',
    confidence: 0,
    timestamp: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [statistics, setStatistics] = useState<any>({})

  const videoRef = useRef<HTMLVideoElement>(null)
  const initializationRef = useRef(false)

  // Initialize gesture service
  const initialize = useCallback(async () => {
    if (initializationRef.current || !videoRef.current) return

    initializationRef.current = true

    try {
      setError(null)

      // Set language
      gestureService.setLanguage(language)

      // Initialize service
      const success = await gestureService.initialize(videoRef.current)

      if (success) {
        setIsInitialized(true)
        setStatistics(gestureService.getStatistics())

        // Auto-start if requested
        if (autoStart) {
          await startRecognition()
        }
      } else {
        throw new Error('Failed to initialize gesture recognition')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Initialization failed'
      setError(errorMessage)
      onError?.(new Error(errorMessage))
    } finally {
      initializationRef.current = false
    }
  }, [language, autoStart, onError])

  // Start gesture recognition
  const startRecognition = useCallback(async () => {
    if (!isInitialized) {
      await initialize()
      return
    }

    try {
      setError(null)
      await gestureService.start()
      setIsActive(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recognition'
      setError(errorMessage)
      onError?.(new Error(errorMessage))
    }
  }, [isInitialized, initialize, onError])

  // Stop gesture recognition
  const stopRecognition = useCallback(() => {
    gestureService.stop()
    setIsActive(false)
  }, [])

  // Clear gesture sequence
  const clearSequence = useCallback(() => {
    gestureService.clearSequence()
    setGestureSequence({
      letters: [],
      word: '',
      confidence: 0,
      timestamp: new Date().toISOString(),
    })
  }, [])

  // Handle gesture recognition events
  useEffect(() => {
    const handleGestureRecognized = (event: CustomEvent<GestureResult>) => {
      const result = event.detail
      setCurrentGesture(result)
      onGestureRecognized?.(result)

      // Update sequence
      const sequence = gestureService.getGestureSequence()
      setGestureSequence(sequence)
      onSequenceUpdate?.(sequence)

      // Update statistics
      setStatistics(gestureService.getStatistics())
    }

    window.addEventListener('gestureRecognized', handleGestureRecognized)

    return () => {
      window.removeEventListener('gestureRecognized', handleGestureRecognized)
    }
  }, [onGestureRecognized, onSequenceUpdate])

  // Initialize when video element is available
  useEffect(() => {
    if (videoRef.current && !isInitialized && !initializationRef.current) {
      initialize()
    }
  }, [initialize, isInitialized])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecognition()
    }
  }, [stopRecognition])

  // Update language
  useEffect(() => {
    if (isInitialized) {
      gestureService.setLanguage(language)
      setStatistics(gestureService.getStatistics())
    }
  }, [language, isInitialized])

  return {
    isInitialized,
    isActive,
    currentGesture,
    gestureSequence,
    error,
    startRecognition,
    stopRecognition,
    clearSequence,
    videoRef,
    statistics,
  }
}
