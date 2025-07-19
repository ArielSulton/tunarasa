/**
 * Gesture Recognition Component
 * Provides real-time ASL/Bisindo gesture recognition interface
 */

'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, Camera, CameraOff, Trash2, Send, Hand } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useGestureRecognition } from '@/hooks/useGestureRecognition'
import { GestureResult, GestureSequence } from '@/lib/gesture/gestureRecognition'

interface GestureRecognitionProps {
  onSendText?: (text: string, confidence: number) => void
  onGestureUpdate?: (gesture: GestureResult) => void
  language?: 'asl' | 'bisindo'
  className?: string
}

export function GestureRecognition({
  onSendText,
  onGestureUpdate,
  language = 'asl',
  className = '',
}: GestureRecognitionProps) {
  const [showVideo, setShowVideo] = useState(false)
  const [lastSentText, setLastSentText] = useState<string>('')

  const {
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
  } = useGestureRecognition({
    language,
    onGestureRecognized: useCallback(
      (gesture: GestureResult) => {
        onGestureUpdate?.(gesture)
      },
      [onGestureUpdate],
    ),
  })

  const handleStartCamera = async () => {
    setShowVideo(true)
    await startRecognition()
  }

  const handleStopCamera = () => {
    stopRecognition()
    setShowVideo(false)
  }

  const handleSendText = () => {
    const text = gestureSequence.word.toLowerCase()
    if (text && text !== lastSentText) {
      onSendText?.(text, gestureSequence.confidence)
      setLastSentText(text)
      clearSequence()
    }
  }

  const handleClearSequence = () => {
    clearSequence()
    setLastSentText('')
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500'
    if (confidence >= 0.6) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Hand className="h-5 w-5" />
            Sign Language Recognition
            <Badge variant="outline" className="ml-auto">
              {language.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Camera Controls */}
          <div className="flex gap-2">
            {!isActive ? (
              <Button onClick={handleStartCamera} className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Start Camera
              </Button>
            ) : (
              <Button onClick={handleStopCamera} variant="outline" className="flex items-center gap-2">
                <CameraOff className="h-4 w-4" />
                Stop Camera
              </Button>
            )}

            {gestureSequence.letters.length > 0 && (
              <>
                <Button onClick={handleClearSequence} variant="outline" size="sm" className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
                <Button onClick={handleSendText} className="flex items-center gap-2" disabled={!gestureSequence.word}>
                  <Send className="h-4 w-4" />
                  Send Text
                </Button>
              </>
            )}
          </div>

          {/* Video Feed */}
          {showVideo && (
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} className="h-64 w-full object-cover" autoPlay muted playsInline />

              {/* Status Overlay */}
              <div className="absolute top-2 left-2 flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${isActive ? 'animate-pulse bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium text-white">{isActive ? 'Recording' : 'Stopped'}</span>
              </div>

              {/* Hand Detection Status */}
              {currentGesture && (
                <div className="absolute top-2 right-2 rounded-lg bg-black/70 p-2">
                  <div className="text-sm text-white">
                    <div className="flex items-center gap-2">
                      <Hand className="h-4 w-4" />
                      <span>{currentGesture.handDetected ? 'Hand Detected' : 'No Hand'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Current Gesture */}
          {currentGesture && currentGesture.handDetected && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{currentGesture.letter}</div>
                    <div className="text-muted-foreground text-sm">Current Gesture</div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Progress value={currentGesture.confidence * 100} className="h-2 w-20" />
                      <span className="text-sm font-medium">{Math.round(currentGesture.confidence * 100)}%</span>
                    </div>
                    <div className="text-muted-foreground text-xs">{currentGesture.processingTime.toFixed(0)}ms</div>
                  </div>
                </div>

                {/* Alternatives */}
                {currentGesture.alternatives && currentGesture.alternatives.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <div className="text-muted-foreground mb-2 text-xs">Alternatives:</div>
                    <div className="flex gap-2">
                      {currentGesture.alternatives.slice(0, 3).map((alt, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {alt.letter} ({Math.round(alt.confidence * 100)}%)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Gesture Sequence */}
          {gestureSequence.letters.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Gesture Sequence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Letters */}
                  <div className="flex flex-wrap gap-1">
                    {gestureSequence.letters.map((letter, index) => (
                      <Badge key={index} variant="secondary" className="text-sm">
                        {letter}
                      </Badge>
                    ))}
                  </div>

                  {/* Formed Word */}
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-muted-foreground mb-1 text-sm">Formed Text:</div>
                    <div className="text-lg font-semibold">{gestureSequence.word || 'No text yet...'}</div>
                  </div>

                  {/* Sequence Stats */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Letters: </span>
                      <span className="font-medium">{gestureSequence.letters.length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Confidence: </span>
                      <span className="font-medium">{Math.round(gestureSequence.confidence * 100)}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistics */}
          {isInitialized && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <span className="font-medium">{statistics.isInitialized ? 'Ready' : 'Initializing'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Language: </span>
                    <span className="font-medium">{statistics.language?.toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Model: </span>
                    <span className="font-medium">{statistics.hasModel ? 'ML Model' : 'Pattern Matching'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sequence: </span>
                    <span className="font-medium">{statistics.currentSequenceLength} letters</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
