/**
 * Gesture Recognition Service
 * Combines HandPose hand detection with Fingerpose classification
 * for real-time A-Z sign language recognition
 */

import { HandPoseService, HandPoseDetection, drawHand } from './handpose-service'
import { SIBI_CONFIG } from '../config/sibi-config'

export interface GestureRecognitionResult {
  letter: string
  confidence: number
  alternatives: Array<{ letter: string; confidence: number }>
  timestamp: number
  processingTime: number
}

export interface GestureRecognitionConfig {
  handPoseConfig?: {
    maxNumHands?: number
    detectionConfidence?: number
    scoreThreshold?: number
    flipHorizontal?: boolean
  }
  processingOptions?: {
    enableSmoothing?: boolean
    smoothingWindow?: number
    debounceTime?: number
    autoStart?: boolean
  }
}

export class GestureRecognitionService {
  private readonly handPose: HandPoseService
  private isInitialized = false
  private isRunning = false
  private lastProcessingTime = 0
  private processingQueue: HandPoseDetection[] = []
  private smoothingBuffer: GestureRecognitionResult[] = []
  private videoElement: HTMLVideoElement | null = null
  private canvasElement: HTMLCanvasElement | null = null
  private animationFrameId: number | null = null

  // Callbacks
  private onResultCallback: ((result: GestureRecognitionResult) => void) | null = null
  private onErrorCallback: ((error: Error) => void) | null = null
  private onStatusCallback: ((status: string) => void) | null = null

  // Configuration
  private config: Required<GestureRecognitionConfig> = {
    handPoseConfig: {
      maxNumHands: SIBI_CONFIG.MAX_NUM_HANDS,
      detectionConfidence: SIBI_CONFIG.MIN_DETECTION_CONFIDENCE,
      scoreThreshold: SIBI_CONFIG.SCORE_THRESHOLD,
      flipHorizontal: SIBI_CONFIG.FLIP_HORIZONTAL,
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

    this.handPose = new HandPoseService({
      maxNumHands: this.config.handPoseConfig.maxNumHands,
      detectionConfidence: this.config.handPoseConfig.detectionConfidence,
      scoreThreshold: this.config.handPoseConfig.scoreThreshold,
      flipHorizontal: this.config.handPoseConfig.flipHorizontal,
    })
  }

  /**
   * Initialize the gesture recognition system
   */
  async initialize(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<void> {
    try {
      console.log('🔧 GestureRecognitionService: Starting initialization with HandPose...')
      this.updateStatus('Initializing gesture recognition...')

      // Store element references
      this.videoElement = videoElement
      this.canvasElement = canvasElement

      // Initialize camera
      await this.setupCamera(videoElement)

      // Initialize HandPose service
      try {
        console.log('🤖 Initializing HandPose...')
        await this.handPose.initialize()

        if (this.handPose.isReady()) {
          console.log('✅ HandPose initialized successfully')
          this.updateStatus('HandPose initialized successfully')
        } else {
          console.warn('⚠️ HandPose not ready after initialization')
          this.updateStatus('HandPose initialization incomplete')
        }
      } catch (handPoseError) {
        console.error('❌ HandPose initialization failed:', handPoseError)
        this.updateStatus('Gesture recognition disabled (HandPose failed)')
        this.isInitialized = false
        return
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
  // eslint-disable-next-line @typescript-eslint/require-await
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Gesture recognition not initialized')
    }

    if (this.isRunning) {
      return
    }

    // Check if HandPose is available
    if (!this.handPose.isReady()) {
      throw new Error('HandPose not available for gesture recognition')
    }

    try {
      this.updateStatus('Starting gesture recognition...')
      this.isRunning = true
      this.startProcessingLoop()
      this.updateStatus('Gesture recognition started')
    } catch (error) {
      this.onError(error as Error)
      throw error
    }
  }

  /**
   * Stop gesture recognition
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    try {
      this.updateStatus('Stopping gesture recognition...')
      this.isRunning = false

      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId)
        this.animationFrameId = null
      }

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
   * Start the processing loop for hand detection and gesture recognition
   */
  private startProcessingLoop(): void {
    const processFrame = async () => {
      if (!this.isRunning || !this.videoElement || !this.canvasElement) {
        return
      }

      try {
        // Apply debouncing
        const now = Date.now()
        if (now - this.lastProcessingTime < (this.config.processingOptions?.debounceTime ?? 100)) {
          this.animationFrameId = requestAnimationFrame(() => void processFrame())
          return
        }
        this.lastProcessingTime = now

        // Detect hands
        const handDetections = await this.handPose.detectHands(this.videoElement)

        if (handDetections.length > 0) {
          // Take the most confident hand detection
          const bestResult = handDetections.reduce((best, current) =>
            current.confidence > best.confidence ? current : best,
          )

          // Recognize gesture using fingerpose
          const gestureResult = await this.handPose.recognizeGesture(bestResult.landmarks)

          // Create recognition result
          const recognitionResult: GestureRecognitionResult = {
            letter: gestureResult.letter,
            confidence: gestureResult.confidence,
            alternatives: gestureResult.alternatives,
            timestamp: bestResult.timestamp,
            processingTime: gestureResult.processingTime,
          }

          // Draw hand landmarks on canvas
          this.drawHandsOnCanvas(handDetections)

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
          // Clear canvas if no hands detected
          this.clearCanvas()
        }
      } catch (error) {
        // Handle specific errors differently
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (
          errorMessage.includes('Video element not ready') ||
          errorMessage.includes('Video dimensions not available')
        ) {
          // Silently skip frame if video not ready
          return
        } else {
          console.error('Error processing frame:', error)
        }
        // Don't propagate error, continue processing
      }

      // Schedule next frame
      if (this.isRunning) {
        this.animationFrameId = requestAnimationFrame(() => void processFrame)
      }
    }

    // Start the loop
    void processFrame()
  }

  /**
   * Draw hands on canvas
   */
  private drawHandsOnCanvas(handDetections: HandPoseDetection[]): void {
    if (!this.canvasElement) return

    const ctx = this.canvasElement.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height)

    // Draw video frame
    if (this.videoElement) {
      ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height)
    }

    // Draw hand landmarks using the HandPose service
    drawHand(handDetections, ctx)
  }

  /**
   * Clear canvas
   */
  private clearCanvas(): void {
    if (!this.canvasElement) return

    const ctx = this.canvasElement.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height)

    // Draw video frame
    if (this.videoElement) {
      ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height)
    }
  }

  /**
   * Apply smoothing to reduce jitter in recognition results
   */
  private applySmoothing(result: GestureRecognitionResult): GestureRecognitionResult | null {
    // Add to smoothing buffer
    this.smoothingBuffer.push(result)

    // Maintain window size
    if (this.smoothingBuffer.length > (this.config.processingOptions?.smoothingWindow ?? 5)) {
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
      letterCounts.set(letter, (letterCounts.get(letter) ?? 0) + 1)
      confidenceSum.set(letter, (confidenceSum.get(letter) ?? 0) + bufferedResult.confidence)
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
    const avgConfidence = (confidenceSum.get(mostFrequentLetter) ?? 0) / maxCount

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
      handPoseConfig: { ...defaultConfig.handPoseConfig, ...userConfig.handPoseConfig },
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

    // Update HandPose service config
    if (config.handPoseConfig) {
      this.handPose.updateConfig({
        maxNumHands: config.handPoseConfig.maxNumHands ?? this.config.handPoseConfig.maxNumHands,
        detectionConfidence:
          config.handPoseConfig.detectionConfidence ?? this.config.handPoseConfig.detectionConfidence,
        scoreThreshold: config.handPoseConfig.scoreThreshold ?? this.config.handPoseConfig.scoreThreshold,
        flipHorizontal: config.handPoseConfig.flipHorizontal ?? this.config.handPoseConfig.flipHorizontal,
      })
    }
  }

  /**
   * Get system status
   */
  getStatus(): {
    isInitialized: boolean
    isRunning: boolean
    handPoseReady: boolean
    processingQueueSize: number
    smoothingBufferSize: number
  } {
    console.log('📊 GestureRecognitionService: getStatus called, instance:', this, 'isInitialized:', this.isInitialized)
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      handPoseReady: this.handPose.isReady(),
      processingQueueSize: this.processingQueue.length,
      smoothingBufferSize: this.smoothingBuffer.length,
    }
  }

  /**
   * Setup camera access for video element
   */
  private async setupCamera(videoElement: HTMLVideoElement): Promise<void> {
    try {
      console.log('📹 Setting up camera access...')
      this.updateStatus('Requesting camera access...')

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user', // Front-facing camera
          frameRate: 30,
        },
        audio: false,
      })

      videoElement.srcObject = stream

      // Wait for video metadata to load
      await new Promise<void>((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          console.log('✅ Video metadata loaded:', {
            width: videoElement.videoWidth,
            height: videoElement.videoHeight,
            readyState: videoElement.readyState,
          })
          resolve()
        }
        videoElement.onerror = reject

        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('Camera setup timeout')), 10000)
      })

      // Start video playback
      await videoElement.play()

      console.log('✅ Camera setup complete')
      this.updateStatus('Camera access granted')
    } catch (error) {
      console.error('❌ Camera setup failed:', error)
      this.updateStatus('Camera access denied or failed')
      throw error
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    void this.stop()

    // Stop camera stream
    if (this.videoElement?.srcObject) {
      const stream = this.videoElement.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      this.videoElement.srcObject = null
    }

    this.handPose.dispose()

    this.isInitialized = false
    this.isRunning = false
    this.processingQueue = []
    this.smoothingBuffer = []
    this.videoElement = null
    this.canvasElement = null
    this.animationFrameId = null
    this.onResultCallback = null
    this.onErrorCallback = null
    this.onStatusCallback = null
  }
}
