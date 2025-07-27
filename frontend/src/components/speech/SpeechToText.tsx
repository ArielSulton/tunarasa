'use client'

import { useEffect } from 'react'
import { Mic, MicOff } from 'lucide-react'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'

interface SpeechToTextProps {
  onSpeechResult: (text: string) => void
  language?: string
  continuous?: boolean
  interimResults?: boolean
}

export function SpeechToText({ onSpeechResult, language = 'id-ID' }: SpeechToTextProps) {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition()

  // Detect if user is using Brave browser
  const isBrave = typeof (navigator as unknown as { brave?: unknown }).brave !== 'undefined'

  // Send transcript to parent when it changes
  useEffect(() => {
    if (transcript.trim()) {
      console.log('🎤 Transcript changed:', transcript)
      onSpeechResult(transcript.trim())
    }
  }, [transcript, onSpeechResult])

  const startListening = () => {
    console.log('🎤 Starting speech recognition...')
    resetTranscript()
    void SpeechRecognition.startListening({
      continuous: true,
      language,
    })
  }

  const stopListening = () => {
    console.log('🎤 Stopping speech recognition...')
    void SpeechRecognition.stopListening()
  }

  const handleButtonClick = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    console.log('🎤 Button clicked! Current listening state:', listening)
    console.log('🎤 Button click event:', event.type, event.target)

    if (listening) {
      console.log('🎤 Attempting to stop listening...')
      stopListening()
    } else {
      console.log('🎤 Attempting to start listening...')
      startListening()
    }
  }

  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="mx-auto max-w-lg rounded-lg bg-yellow-50 p-6 text-center">
        {isBrave ? (
          <div className="space-y-3">
            <div className="text-4xl">🦁</div>
            <h3 className="text-lg font-semibold text-yellow-800">Brave Browser Detected</h3>
            <p className="text-sm text-yellow-700">Speech recognition di-block oleh Brave&apos;s privacy protection</p>
            <div className="space-y-1 text-xs text-yellow-600">
              <p>
                <strong>Solusi:</strong>
              </p>
              <p>• Klik shield icon di address bar → Turn off Shields</p>
              <p>• Atau gunakan Chrome/Edge untuk fitur speech recognition</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-4xl">❌</div>
            <p className="text-gray-600">Speech recognition tidak didukung di browser ini</p>
            <p className="text-sm text-gray-500">Silakan gunakan Chrome, Edge, atau Safari terbaru</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Brave browser warning - compact */}
      {isBrave && (
        <div className="mb-2 rounded-md border border-yellow-200 bg-yellow-50 p-2">
          <div className="flex items-center gap-1 text-yellow-800">
            <div className="text-sm">⚠️</div>
            <div className="text-xs">
              <span className="font-medium">Brave detected.</span> Turn off Shields atau gunakan Chrome.
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {/* Microphone button - smaller to fit container */}
        <div className="relative mb-3">
          {/* Status ring - behind button */}
          {listening && (
            <div className="pointer-events-none absolute inset-0 animate-ping rounded-full border-4 border-red-300"></div>
          )}

          <button
            type="button"
            onClick={handleButtonClick}
            onMouseDown={() => console.log('🎤 Mouse down on button')}
            onMouseUp={() => console.log('🎤 Mouse up on button')}
            className={`relative z-10 flex h-24 w-24 cursor-pointer items-center justify-center rounded-full transition-all duration-200 ${
              listening
                ? 'bg-red-600 shadow-lg shadow-red-500/50 hover:bg-red-700 focus:ring-4 focus:ring-red-300 active:bg-red-800'
                : 'bg-blue-600 shadow-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 active:bg-blue-800'
            }`}
            style={{ pointerEvents: 'auto', zIndex: 10 }}
          >
            {listening ? <MicOff className="h-12 w-12 text-white" /> : <Mic className="h-12 w-12 text-white" />}
          </button>
        </div>

        {/* Status text - compact */}
        <div className="mb-2 space-y-1">
          <p className="text-base font-medium text-gray-700">
            {listening ? 'Mendengarkan...' : 'Klik untuk mulai berbicara'}
          </p>
          <p className="text-xs text-gray-500">
            {listening ? 'Klik tombol merah untuk berhenti' : 'Tekan mikrofon untuk memulai'}
          </p>
        </div>

        {/* Audio visualization - compact */}
        {listening && (
          <div className="mb-2 flex items-end justify-center space-x-1">
            <div className="h-4 w-2 animate-pulse rounded-full bg-blue-500"></div>
            <div className="h-6 w-2 animate-pulse rounded-full bg-blue-400" style={{ animationDelay: '0.1s' }}></div>
            <div className="h-8 w-2 animate-pulse rounded-full bg-blue-600" style={{ animationDelay: '0.2s' }}></div>
            <div className="h-5 w-2 animate-pulse rounded-full bg-blue-300" style={{ animationDelay: '0.3s' }}></div>
            <div className="h-7 w-2 animate-pulse rounded-full bg-blue-500" style={{ animationDelay: '0.4s' }}></div>
            <div className="h-3 w-2 animate-pulse rounded-full bg-blue-400" style={{ animationDelay: '0.5s' }}></div>
          </div>
        )}
      </div>

      {/* Debug info - at bottom, compact */}
      <div className="mt-auto rounded-md bg-gray-100 p-2 text-xs text-gray-600">
        <div className="flex justify-between text-xs">
          <span>Status: {listening ? '✅' : '❌'}</span>
          <span>Support: {browserSupportsSpeechRecognition ? '✅' : '❌'}</span>
          <span>{transcript.length} chars</span>
        </div>
      </div>
    </div>
  )
}
