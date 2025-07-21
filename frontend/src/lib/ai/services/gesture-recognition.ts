/**
 * Gesture Recognition Service
 * Combines MediaPipe hand detection with TensorFlow.js classification
 * for real-time A-Z sign language recognition
 */

import { MediaPipeService, GestureDetectionResult } from './mediapipe-service'
import { GestureClassifier } from './gesture-classifier'
import { SIBI_CONFIG } from '../config/sibi-config'

export interface GestureRecognitionResult {
  letter: string
  confidence: number
  alternatives: Array<{ letter: string; confidence: number }>
  handedness: 'Left' | 'Right'
  timestamp: number
  processingTime: number
}

export interface GestureRecognitionConfig {
  mediaPipeConfig?: {
    maxNumHands?: number
    modelComplexity?: 0 | 1
    minDetectionConfidence?: number
    minTrackingConfidence?: number
  }
  classifierConfig?: {
    modelPath?: string
    confidenceThreshold?: number
    maxAlternatives?: number
    normalizationMethod?: 'wrist' | 'center' | 'none'
  }
  processingOptions?: {
    enableSmoothing?: boolean
    smoothingWindow?: number
    debounceTime?: number
    autoStart?: boolean
  }
}

export class GestureRecognitionService {
  private mediaPipe: MediaPipeService
  private classifier: GestureClassifier
  private isInitialized = false
  private isRunning = false
  private lastProcessingTime = 0
  private processingQueue: GestureDetectionResult[] = []
  private smoothingBuffer: GestureRecognitionResult[] = []
  private videoElement: HTMLVideoElement | null = null

  // Callbacks
  private onResultCallback: ((result: GestureRecognitionResult) => void) | null = null
  private onErrorCallback: ((error: Error) => void) | null = null
  private onStatusCallback: ((status: string) => void) | null = null

  // Configuration
  private config: Required<GestureRecognitionConfig> = {
    mediaPipeConfig: {
      maxNumHands: SIBI_CONFIG.MAX_NUM_HANDS,
      modelComplexity: SIBI_CONFIG.MODEL_COMPLEXITY,
      minDetectionConfidence: SIBI_CONFIG.MIN_DETECTION_CONFIDENCE,
      minTrackingConfidence: SIBI_CONFIG.MIN_TRACKING_CONFIDENCE,
    },
    classifierConfig: {
      modelPath: SIBI_CONFIG.MODEL_PATH,
      confidenceThreshold: SIBI_CONFIG.CONFIDENCE_THRESHOLD,
      maxAlternatives: SIBI_CONFIG.MAX_ALTERNATIVES,
      normalizationMethod: SIBI_CONFIG.NORMALIZATION_METHOD,
    },
    processingOptions: {
      enableSmoothing: true,
      smoothingWindow: SIBI_CONFIG.SMOOTHING_WINDOW,
      debounceTime: SIBI_CONFIG.DEBOUNCE_TIME,
      autoStart: false,
    },
  }

  constructor(config?: GestureRecognitionConfig) {
    if (config) {
      this.config = this.mergeConfig(this.config, config)
    }

    this.mediaPipe = new MediaPipeService(this.config.mediaPipeConfig)
    this.classifier = new GestureClassifier(this.config.classifierConfig)
  }

  /**
   * Initialize the gesture recognition system
   */
  async initialize(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<void> {
    try {
      console.log('🔧 GestureRecognitionService: Starting initialization, instance:', this)
      this.updateStatus('Initializing gesture recognition...')

      // Store video element reference for classifier
      this.videoElement = videoElement

      // Initialize MediaPipe
      try {
        console.log('🎥 Initializing MediaPipe...')
        await this.mediaPipe.initialize(videoElement, canvasElement)

        // Set up MediaPipe callbacks
        this.mediaPipe.setOnResults(this.onHandDetectionResults.bind(this))
        this.mediaPipe.setOnError(this.onError.bind(this))

        if (this.mediaPipe.isReady()) {
          console.log('✅ MediaPipe initialized successfully')
          this.updateStatus('MediaPipe initialized successfully')
        } else {
          console.warn('⚠️ MediaPipe not ready after initialization')
          this.updateStatus('MediaPipe initialization incomplete')
        }
      } catch (mediaPipeError) {
        console.error('❌ MediaPipe initialization failed:', mediaPipeError)
        this.updateStatus('Gesture recognition disabled (MediaPipe failed)')
        this.isInitialized = false
        return
      }

      // Load TensorFlow.js model
      try {
        console.log('🤖 Loading gesture classification model...')
        await this.classifier.loadModel()

        if (this.classifier.isReady()) {
          console.log('✅ Gesture classification model ready')
          this.updateStatus('Gesture recognition initialized successfully')
        } else {
          console.warn('⚠️ Gesture classifier not ready after loading')
          this.updateStatus('Gesture recognition initialized (classification not ready)')
        }
      } catch (modelError) {
        console.warn('⚠️ Gesture model not available, continuing without classification:', modelError)
        this.updateStatus('Gesture recognition initialized (no classification model)')
      }

      this.isInitialized = true
      console.log('✅ GestureRecognitionService: isInitialized set to true')

      // Auto-start if configured
      if (this.config.processingOptions.autoStart) {
        console.log('🚀 Auto-starting gesture recognition...')
        await this.start()
      }

      console.log('🎯 Final initialization status:', this.isInitialized)
    } catch (error) {
      console.error('Failed to initialize gesture recognition:', error)
      this.isInitialized = false
      this.updateStatus('Gesture recognition initialization failed')
      // Don't throw error, allow system to continue
    }
  }

  /**
   * Start gesture recognition
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Gesture recognition not initialized')
    }

    if (this.isRunning) {
      return
    }

    // Check if MediaPipe is available
    if (!this.mediaPipe.isReady()) {
      throw new Error('MediaPipe not available for gesture recognition')
    }

    try {
      this.updateStatus('Starting gesture recognition...')
      await this.mediaPipe.start()
      this.isRunning = true
      this.updateStatus('Gesture recognition started')
    } catch (error) {
      this.onError(error as Error)
      throw error
    }
  }

  /**
   * Stop gesture recognition
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    try {
      this.updateStatus('Stopping gesture recognition...')
      await this.mediaPipe.stop()
      this.isRunning = false
      this.processingQueue = []
      this.smoothingBuffer = []
      this.updateStatus('Gesture recognition stopped')
    } catch (error) {
      this.onError(error as Error)
      throw error
    }
  }

  /**
   * Set callback for gesture recognition results
   */
  setOnResult(callback: (result: GestureRecognitionResult) => void): void {
    this.onResultCallback = callback
  }

  /**
   * Set callback for error handling
   */
  setOnError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback
  }

  /**
   * Set callback for status updates
   */
  setOnStatus(callback: (status: string) => void): void {
    this.onStatusCallback = callback
  }

  /**
   * Handle hand detection results from MediaPipe
   */
  private async onHandDetectionResults(results: GestureDetectionResult[]): Promise<void> {
    if (!this.isRunning || results.length === 0) {
      return
    }

    // Take the most confident hand detection
    const bestResult = results.reduce((best, current) => (current.confidence > best.confidence ? current : best))

    // Apply debouncing
    const now = Date.now()
    if (now - this.lastProcessingTime < (this.config.processingOptions?.debounceTime || 100)) {
      return
    }
    this.lastProcessingTime = now

    try {
      // Classify the gesture if classifier is available and video element exists
      if (this.classifier.isReady() && this.videoElement) {
        const classification = await this.classifier.classify(this.videoElement)

        // Create recognition result
        const recognitionResult: GestureRecognitionResult = {
          letter: classification.letter,
          confidence: classification.confidence,
          alternatives: classification.alternatives,
          handedness: bestResult.handedness,
          timestamp: bestResult.timestamp,
          processingTime: classification.processingTime,
        }

        // Apply smoothing if enabled
        if (this.config.processingOptions.enableSmoothing) {
          const smoothedResult = this.applySmoothing(recognitionResult)
          if (smoothedResult) {
            this.emitResult(smoothedResult)
          }
        } else {
          this.emitResult(recognitionResult)
        }
      } else {
        // Skip classification if model not available, just continue with hand detection
        console.warn('Gesture classification skipped - model not available')
      }
    } catch (error) {
      console.error('Error processing gesture:', error)
      // Don't propagate error, continue with hand detection
    }
  }

  /**
   * Apply smoothing to reduce jitter in recognition results
   */
  private applySmoothing(result: GestureRecognitionResult): GestureRecognitionResult | null {
    // Add to smoothing buffer
    this.smoothingBuffer.push(result)

    // Maintain window size
    if (this.smoothingBuffer.length > (this.config.processingOptions?.smoothingWindow || 5)) {
      this.smoothingBuffer.shift()
    }

    // Need minimum samples for smoothing
    if (this.smoothingBuffer.length < 3) {
      return null
    }

    // Count occurrences of each letter
    const letterCounts = new Map<string, number>()
    const confidenceSum = new Map<string, number>()

    for (const bufferedResult of this.smoothingBuffer) {
      const letter = bufferedResult.letter
      letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1)
      confidenceSum.set(letter, (confidenceSum.get(letter) || 0) + bufferedResult.confidence)
    }

    // Find most frequent letter
    let mostFrequentLetter = ''
    let maxCount = 0

    for (const [letter, count] of letterCounts) {
      if (count > maxCount) {
        maxCount = count
        mostFrequentLetter = letter
      }
    }

    // Calculate average confidence for most frequent letter
    const avgConfidence = (confidenceSum.get(mostFrequentLetter) || 0) / maxCount

    // Return smoothed result
    return {
      ...result,
      letter: mostFrequentLetter,
      confidence: avgConfidence,
    }
  }

  /**
   * Emit recognition result to callback
   */
  private emitResult(result: GestureRecognitionResult): void {
    if (this.onResultCallback) {
      this.onResultCallback(result)
    }
  }

  /**
   * Handle errors
   */
  private onError(error: Error): void {
    console.error('Gesture recognition error:', error)
    if (this.onErrorCallback) {
      this.onErrorCallback(error)
    }
  }

  /**
   * Update status
   */
  private updateStatus(status: string): void {
    console.log('Gesture recognition status:', status)
    if (this.onStatusCallback) {
      this.onStatusCallback(status)
    }
  }

  /**
   * Merge configuration objects
   */
  private mergeConfig(
    defaultConfig: Required<GestureRecognitionConfig>,
    userConfig: GestureRecognitionConfig,
  ): Required<GestureRecognitionConfig> {
    return {
      mediaPipeConfig: { ...defaultConfig.mediaPipeConfig, ...userConfig.mediaPipeConfig },
      classifierConfig: { ...defaultConfig.classifierConfig, ...userConfig.classifierConfig },
      processingOptions: { ...defaultConfig.processingOptions, ...userConfig.processingOptions },
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<GestureRecognitionConfig> {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GestureRecognitionConfig>): void {
    this.config = this.mergeConfig(this.config, config)

    // Update underlying services
    if (config.mediaPipeConfig) {
      this.mediaPipe.updateConfig(config.mediaPipeConfig)
    }

    if (config.classifierConfig) {
      this.classifier.updateConfig(config.classifierConfig)
    }
  }

  /**
   * Get system status
   */
  getStatus(): {
    isInitialized: boolean
    isRunning: boolean
    mediaPipeReady: boolean
    classifierReady: boolean
    processingQueueSize: number
    smoothingBufferSize: number
  } {
    console.log('📊 GestureRecognitionService: getStatus called, instance:', this, 'isInitialized:', this.isInitialized)
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      mediaPipeReady: this.mediaPipe.isReady(),
      classifierReady: this.classifier.isReady(),
      processingQueueSize: this.processingQueue.length,
      smoothingBufferSize: this.smoothingBuffer.length,
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop()
    this.mediaPipe.dispose()
    this.classifier.dispose()

    this.isInitialized = false
    this.isRunning = false
    this.processingQueue = []
    this.smoothingBuffer = []
    this.videoElement = null
    this.onResultCallback = null
    this.onErrorCallback = null
    this.onStatusCallback = null
  }
}
