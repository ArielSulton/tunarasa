/**
 * GestureRecognition Component
 * Main component for A-Z hand gesture recognition interface
 */

'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useGestureRecognition } from '@/hooks/use-gesture-recognition'
import { GestureRecognitionResult } from '@/lib/ai/services/gesture-recognition'
import { Play, Pause, AlertCircle, Loader2, Hand, Eye, EyeOff, RotateCcw } from 'lucide-react'

interface GestureRecognitionProps {
  onLetterDetected?: (letter: string, confidence: number) => void
  onWordFormed?: (word: string) => void
  className?: string
  showAlternatives?: boolean
  enableWordFormation?: boolean
  maxWordLength?: number
}

export const GestureRecognition: React.FC<GestureRecognitionProps> = ({
  onLetterDetected,
  onWordFormed,
  className = '',
  showAlternatives = true,
  enableWordFormation = true,
  maxWordLength = 50,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentWord, setCurrentWord] = useState<string>('')
  const [detectedLetters, setDetectedLetters] = useState<string[]>([])
  const [lastStableResult, setLastStableResult] = useState<GestureRecognitionResult | null>(null)
  const [stabilityCount, setStabilityCount] = useState(0)
  const [showCamera, setShowCamera] = useState(true)
  const [confidence, setConfidence] = useState(0)

  // Gesture recognition hook
  const { isInitialized, isRunning, isLoading, error, status, lastResult, start, stop, initialize } =
    useGestureRecognition({
      config: {
        mediaPipeConfig: {
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        },
        classifierConfig: {
          modelPath: '/models/sibi_model.h5',
          confidenceThreshold: 0.7,
          maxAlternatives: 3,
          normalizationMethod: 'wrist',
        },
        processingOptions: {
          enableSmoothing: true,
          smoothingWindow: 5,
          debounceTime: 500,
          autoStart: false,
        },
      },
      onResult: handleGestureResult,
      onError: (error) => console.error('Gesture recognition error:', error),
      onStatus: (status) => console.log('Status:', status),
    })

  // Initialize camera and canvas
  useEffect(() => {
    if (videoRef.current && canvasRef.current && !isInitialized) {
      const initializeCamera = async () => {
        try {
          await initialize(videoRef.current!, canvasRef.current!)
        } catch (error) {
          console.error('Failed to initialize camera:', error)
        }
      }

      initializeCamera()
    }
  }, [isInitialized, initialize])

  // Handle gesture recognition results
  function handleGestureResult(result: GestureRecognitionResult): void {
    setConfidence(result.confidence)

    // Check for stable results
    if (lastStableResult?.letter === result.letter && result.confidence > 0.8) {
      setStabilityCount((prev) => prev + 1)

      // Add letter to word after stable detection
      if (stabilityCount >= 3) {
        addLetterToWord(result.letter)
        setStabilityCount(0)
        setLastStableResult(null)
      }
    } else {
      setLastStableResult(result)
      setStabilityCount(1)
    }

    // Call external callback
    if (onLetterDetected) {
      onLetterDetected(result.letter, result.confidence)
    }
  }

  // Add letter to current word
  const addLetterToWord = useCallback(
    (letter: string) => {
      if (currentWord.length < maxWordLength) {
        const newWord = currentWord + letter
        setCurrentWord(newWord)
        setDetectedLetters((prev) => [...prev, letter])

        if (enableWordFormation && onWordFormed) {
          onWordFormed(newWord)
        }
      }
    },
    [currentWord, maxWordLength, enableWordFormation, onWordFormed],
  )

  // Clear current word
  const clearWord = useCallback(() => {
    setCurrentWord('')
    setDetectedLetters([])
    setLastStableResult(null)
    setStabilityCount(0)
  }, [])

  // Remove last letter
  const removeLastLetter = useCallback(() => {
    if (currentWord.length > 0) {
      const newWord = currentWord.slice(0, -1)
      setCurrentWord(newWord)
      setDetectedLetters((prev) => prev.slice(0, -1))

      if (enableWordFormation && onWordFormed) {
        onWordFormed(newWord)
      }
    }
  }, [currentWord, enableWordFormation, onWordFormed])

  // Toggle camera start/stop
  const toggleCamera = useCallback(async () => {
    try {
      if (isRunning) {
        await stop()
      } else {
        await start()
      }
    } catch (error) {
      console.error('Failed to toggle camera:', error)
    }
  }, [isRunning, start, stop])

  // Get status color
  const getStatusColor = () => {
    if (error) return 'destructive'
    if (isRunning) return 'default'
    if (isInitialized) return 'secondary'
    return 'outline'
  }

  // Get confidence color
  const getConfidenceColor = () => {
    if (confidence > 0.8) return 'bg-green-500'
    if (confidence > 0.6) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <Card className={`mx-auto w-full max-w-4xl ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Hand className="h-5 w-5" />
            A-Z Gesture Recognition
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusColor()}>
              {error ? 'Error' : isRunning ? 'Running' : isInitialized ? 'Ready' : 'Initializing'}
            </Badge>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </div>

        {/* Status and confidence */}
        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>{status}</span>
            {lastResult && <span>Confidence: {Math.round(lastResult.confidence * 100)}%</span>}
          </div>

          {lastResult && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>Detection Confidence</span>
                <span>{Math.round(lastResult.confidence * 100)}%</span>
              </div>
              <Progress value={lastResult.confidence * 100} className="h-2" />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Error display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {/* Camera and canvas */}
        <div className="relative">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Video input */}
            <div className="relative">
              <div className="aspect-video overflow-hidden rounded-lg bg-gray-100">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${showCamera ? 'block' : 'hidden'}`}
                />
                {!showCamera && (
                  <div className="flex h-full w-full items-center justify-center bg-gray-200">
                    <EyeOff className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Camera controls */}
              <div className="absolute top-2 right-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowCamera(!showCamera)}>
                  {showCamera ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Canvas output */}
            <div className="relative">
              <div className="aspect-video overflow-hidden rounded-lg bg-gray-100">
                <canvas ref={canvasRef} width="640" height="480" className="h-full w-full object-cover" />
              </div>

              {/* Current detection overlay */}
              {lastResult && (
                <div className="absolute top-2 left-2 rounded-md bg-black/70 px-3 py-1 text-white">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{lastResult.letter}</span>
                    <div className={`h-2 w-2 rounded-full ${getConfidenceColor()}`} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button onClick={toggleCamera} disabled={!isInitialized || isLoading} className="flex items-center gap-2">
            {isRunning ? (
              <>
                <Pause className="h-4 w-4" />
                Stop Detection
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Detection
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={clearWord}
            disabled={currentWord.length === 0}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Clear Word
          </Button>
        </div>

        {/* Word formation */}
        {enableWordFormation && (
          <div className="space-y-4">
            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Current Word</h3>
                <span className="text-muted-foreground text-xs">
                  {currentWord.length}/{maxWordLength}
                </span>
              </div>

              <div className="min-h-[60px] rounded-lg border-2 border-dashed bg-gray-50 p-4">
                {currentWord ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {detectedLetters.map((letter, index) => (
                      <Badge key={index} variant="secondary" className="text-lg">
                        {letter}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400">Start signing to build a word...</div>
                )}
              </div>

              {currentWord && (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-bold">{currentWord}</span>
                  <Button variant="outline" size="sm" onClick={removeLastLetter} disabled={currentWord.length === 0}>
                    Remove Last
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alternatives */}
        {showAlternatives && lastResult && lastResult.alternatives.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Alternative Predictions</h3>
            <div className="flex flex-wrap gap-2">
              {lastResult.alternatives.map((alt, index) => (
                <Badge key={index} variant="outline" className="flex items-center gap-1">
                  <span>{alt.letter}</span>
                  <span className="text-muted-foreground text-xs">{Math.round(alt.confidence * 100)}%</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* System info */}
        <div className="text-muted-foreground space-y-1 text-xs">
          <div>Processing Time: {lastResult?.processingTime.toFixed(1)}ms</div>
          <div>Handedness: {lastResult?.handedness}</div>
          <div>Stability: {stabilityCount}/3</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default GestureRecognition
