/**
 * Gesture Recognition Service
 * Combines MediaPipe hand detection with TensorFlow.js classification
 * for real-time A-Z sign language recognition
 */

import { MediaPipeService, GestureDetectionResult } from './mediapipe-service'
import { GestureClassifier } from './gesture-classifier'

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

  // Callbacks
  private onResultCallback: ((result: GestureRecognitionResult) => void) | null = null
  private onErrorCallback: ((error: Error) => void) | null = null
  private onStatusCallback: ((status: string) => void) | null = null

  // Configuration
  private config: Required<GestureRecognitionConfig> = {
    mediaPipeConfig: {
      maxNumHands: 1,
      modelComplexity: 1 as 0 | 1,
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
      debounceTime: 100,
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
      this.updateStatus('Initializing gesture recognition...')

      // Initialize MediaPipe
      await this.mediaPipe.initialize(videoElement, canvasElement)

      // Set up MediaPipe callbacks
      this.mediaPipe.setOnResults(this.onHandDetectionResults.bind(this))
      this.mediaPipe.setOnError(this.onError.bind(this))

      // Load TensorFlow.js model
      await this.classifier.loadModel()

      this.isInitialized = true
      this.updateStatus('Gesture recognition initialized successfully')

      // Auto-start if configured
      if (this.config.processingOptions.autoStart) {
        await this.start()
      }
    } catch (error) {
      this.onError(error as Error)
      throw error
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
      // Classify the gesture
      const classification = await this.classifier.classify(bestResult.landmarks)

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
    } catch (error) {
      console.error('Error processing gesture:', error)
      this.onError(error as Error)
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
    this.onResultCallback = null
    this.onErrorCallback = null
    this.onStatusCallback = null
  }
}
