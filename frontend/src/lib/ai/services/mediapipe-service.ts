/**
 * MediaPipe Hand Detection Service
 * Handles camera access and hand landmark detection for A-Z gesture recognition
 */

import { Camera } from '@mediapipe/camera_utils'
import { Hands, Results } from '@mediapipe/hands'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { HAND_CONNECTIONS } from '@mediapipe/hands'

export interface HandLandmark {
  x: number
  y: number
  z: number
}

export interface GestureDetectionResult {
  landmarks: HandLandmark[]
  handedness: 'Left' | 'Right'
  confidence: number
  timestamp: number
}

export interface MediaPipeConfig {
  maxNumHands: number
  modelComplexity: 0 | 1
  minDetectionConfidence: number
  minTrackingConfidence: number
}

export class MediaPipeService {
  private hands: Hands | null = null
  private camera: Camera | null = null
  private videoElement: HTMLVideoElement | null = null
  private canvasElement: HTMLCanvasElement | null = null
  private canvasCtx: CanvasRenderingContext2D | null = null
  private isInitialized = false
  private isProcessing = false
  private onResultsCallback: ((results: GestureDetectionResult[]) => void) | null = null
  private onErrorCallback: ((error: Error) => void) | null = null

  private config: MediaPipeConfig = {
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  }

  constructor(config?: Partial<MediaPipeConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
  }

  /**
   * Initialize MediaPipe Hands detection
   */
  async initialize(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<void> {
    try {
      this.videoElement = videoElement
      this.canvasElement = canvasElement
      this.canvasCtx = canvasElement.getContext('2d')

      if (!this.canvasCtx) {
        throw new Error('Failed to get canvas context')
      }

      // Initialize MediaPipe Hands
      this.hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        },
      })

      // Configure MediaPipe Hands
      this.hands.setOptions({
        maxNumHands: this.config.maxNumHands,
        modelComplexity: this.config.modelComplexity as 0 | 1,
        minDetectionConfidence: this.config.minDetectionConfidence,
        minTrackingConfidence: this.config.minTrackingConfidence,
      })

      // Set up results callback
      this.hands.onResults(this.onResults.bind(this))

      // Initialize camera
      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          if (this.hands && this.videoElement && !this.isProcessing) {
            this.isProcessing = true
            try {
              await this.hands.send({ image: this.videoElement })
            } catch (error) {
              console.error('Error processing frame:', error)
            }
            this.isProcessing = false
          }
        },
        width: 640,
        height: 480,
      })

      this.isInitialized = true
    } catch (error) {
      console.error('MediaPipe initialization failed:', error)
      throw error
    }
  }

  /**
   * Start hand detection
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MediaPipe service not initialized')
    }

    if (!this.camera) {
      throw new Error('Camera not initialized')
    }

    try {
      await this.camera.start()
    } catch (error) {
      console.error('Failed to start camera:', error)
      if (this.onErrorCallback) {
        this.onErrorCallback(error as Error)
      }
      throw error
    }
  }

  /**
   * Stop hand detection
   */
  async stop(): Promise<void> {
    if (this.camera) {
      this.camera.stop()
    }
    this.isProcessing = false
  }

  /**
   * Set callback for gesture detection results
   */
  setOnResults(callback: (results: GestureDetectionResult[]) => void): void {
    this.onResultsCallback = callback
  }

  /**
   * Set callback for error handling
   */
  setOnError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback
  }

  /**
   * Process MediaPipe results
   */
  private onResults(results: Results): void {
    if (!this.canvasElement || !this.canvasCtx) return

    // Clear canvas
    this.canvasCtx.save()
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height)

    // Draw the image
    if (results.image) {
      this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height)
    }

    // Process detected hands
    const detectionResults: GestureDetectionResult[] = []

    if (results.multiHandLandmarks && results.multiHandedness) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i]
        const handedness = results.multiHandedness[i]

        // Draw hand landmarks
        drawConnectors(this.canvasCtx, landmarks, HAND_CONNECTIONS, {
          color: '#00FF00',
          lineWidth: 2,
        })
        drawLandmarks(this.canvasCtx, landmarks, {
          color: '#FF0000',
          lineWidth: 1,
          radius: 3,
        })

        // Convert landmarks to our format
        const handLandmarks: HandLandmark[] = landmarks.map((landmark) => ({
          x: landmark.x,
          y: landmark.y,
          z: landmark.z || 0,
        }))

        // Create detection result
        detectionResults.push({
          landmarks: handLandmarks,
          handedness: handedness.label as 'Left' | 'Right',
          confidence: handedness.score,
          timestamp: Date.now(),
        })
      }
    }

    this.canvasCtx.restore()

    // Call results callback
    if (this.onResultsCallback) {
      this.onResultsCallback(detectionResults)
    }
  }

  /**
   * Update MediaPipe configuration
   */
  updateConfig(config: Partial<MediaPipeConfig>): void {
    this.config = { ...this.config, ...config }

    if (this.hands) {
      this.hands.setOptions({
        maxNumHands: this.config.maxNumHands,
        modelComplexity: this.config.modelComplexity as 0 | 1,
        minDetectionConfidence: this.config.minDetectionConfidence,
        minTrackingConfidence: this.config.minTrackingConfidence,
      })
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): MediaPipeConfig {
    return { ...this.config }
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.hands !== null && this.camera !== null
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.camera) {
      this.camera.stop()
    }

    if (this.hands) {
      this.hands.close()
    }

    this.videoElement = null
    this.canvasElement = null
    this.canvasCtx = null
    this.camera = null
    this.hands = null
    this.isInitialized = false
    this.isProcessing = false
    this.onResultsCallback = null
    this.onErrorCallback = null
  }
}
