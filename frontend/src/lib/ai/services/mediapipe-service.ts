/**
 * MediaPipe Hand Detection Service
 * Handles camera access and hand landmark detection for A-Z gesture recognition
 * Updated: Fixed import issues with MediaPipe modules
 */

// Import actual MediaPipe types - only import types, not implementations
import type { Results as MediaPipeResults } from '@mediapipe/hands'

// MediaPipe modules interface
interface MediaPipeModules {
  Camera: new (videoElement: HTMLVideoElement, config: CameraConfig) => MediaPipeCamera
  Hands: new (config: HandsConfig) => MediaPipeHands
  HAND_CONNECTIONS: Connection[]
  drawConnectors: (
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark[],
    connections: Connection[],
    style?: DrawingStyle,
  ) => void
  drawLandmarks: (ctx: CanvasRenderingContext2D, landmarks: Landmark[], style?: DrawingStyle) => void
}

// MediaPipe type definitions
interface CameraConfig {
  onFrame: () => void
  width: number
  height: number
}

interface HandsConfig {
  locateFile: (file: string) => string
}

interface MediaPipeCamera {
  start(): Promise<void>
  stop(): void
}

interface MediaPipeHands {
  setOptions(options: HandsOptions): void
  onResults(callback: (results: Results) => void): void
  send(config: { image: HTMLVideoElement }): Promise<void>
  close(): void
}

interface HandsOptions {
  maxNumHands?: number
  modelComplexity?: 0 | 1
  minDetectionConfidence?: number
  minTrackingConfidence?: number
}

interface Landmark {
  x: number
  y: number
  z?: number
}

interface Connection {
  0: number
  1: number
}

interface DrawingStyle {
  color?: string
  lineWidth?: number
  radius?: number
  fillColor?: string
}

// Load MediaPipe from CDN - proper production approach
const loadMediaPipe = async (): Promise<MediaPipeModules> => {
  if (typeof window === 'undefined') {
    throw new Error('MediaPipe is client-side only')
  }

  // Check if MediaPipe is already loaded globally
  const globalWindow = window as typeof window & {
    Camera?: MediaPipeModules['Camera']
    Hands?: MediaPipeModules['Hands']
    HAND_CONNECTIONS?: MediaPipeModules['HAND_CONNECTIONS']
    drawConnectors?: MediaPipeModules['drawConnectors']
    drawLandmarks?: MediaPipeModules['drawLandmarks']
  }

  if (globalWindow.Camera && globalWindow.Hands && globalWindow.drawConnectors) {
    return {
      Camera: globalWindow.Camera,
      Hands: globalWindow.Hands,
      HAND_CONNECTIONS: globalWindow.HAND_CONNECTIONS || [],
      drawConnectors: globalWindow.drawConnectors,
      drawLandmarks: globalWindow.drawLandmarks || (() => {}),
    }
  }

  // Load MediaPipe scripts dynamically (menggunakan pattern dari contoh)
  await Promise.all([
    loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js'),
    loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js'),
    loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js'),
  ])

  // Wait a bit for scripts to initialize
  await new Promise((resolve) => setTimeout(resolve, 100))

  if (!globalWindow.Camera || !globalWindow.Hands || !globalWindow.drawConnectors) {
    throw new Error('Failed to load MediaPipe modules from CDN')
  }

  return {
    Camera: globalWindow.Camera,
    Hands: globalWindow.Hands,
    HAND_CONNECTIONS: globalWindow.HAND_CONNECTIONS || [],
    drawConnectors: globalWindow.drawConnectors,
    drawLandmarks: globalWindow.drawLandmarks || (() => {}),
  }
}

// Helper function to load scripts dynamically
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

// Use the actual MediaPipe types
type Results = MediaPipeResults

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
  private hands: InstanceType<MediaPipeModules['Hands']> | null = null
  private camera: InstanceType<MediaPipeModules['Camera']> | null = null
  private videoElement: HTMLVideoElement | null = null
  private canvasElement: HTMLCanvasElement | null = null
  private canvasCtx: CanvasRenderingContext2D | null = null
  private isInitialized = false
  private isProcessing = false
  private onResultsCallback: ((results: GestureDetectionResult[]) => void) | null = null
  private onErrorCallback: ((error: Error) => void) | null = null
  private mediaModule: MediaPipeModules | null = null

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

      // Load MediaPipe modules dynamically
      this.mediaModule = await loadMediaPipe()

      // Initialize MediaPipe Hands
      this.hands = new this.mediaModule.Hands({
        locateFile: (file: string) => {
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
      if (this.hands) {
        this.hands.onResults(this.onResults.bind(this))
      }

      // Initialize camera
      this.camera = new this.mediaModule.Camera(this.videoElement, {
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
      // Handle different image types from MediaPipe
      if (
        results.image instanceof HTMLVideoElement ||
        results.image instanceof HTMLImageElement ||
        results.image instanceof HTMLCanvasElement
      ) {
        this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height)
      }
    }

    // Process detected hands
    const detectionResults: GestureDetectionResult[] = []

    if (results.multiHandLandmarks && results.multiHandedness) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i]
        const handedness = results.multiHandedness[i]

        // Draw hand landmarks
        if (this.mediaModule) {
          this.mediaModule.drawConnectors(this.canvasCtx, landmarks, this.mediaModule.HAND_CONNECTIONS, {
            color: '#00FF00',
            lineWidth: 2,
          })
          this.mediaModule.drawLandmarks(this.canvasCtx, landmarks, {
            color: '#FF0000',
            lineWidth: 1,
            radius: 3,
          })
        }

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
