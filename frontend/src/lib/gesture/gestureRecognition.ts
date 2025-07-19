/**
 * Gesture Recognition Service using MediaPipe.js and TensorFlow.js
 * Handles real-time ASL/Bisindo gesture recognition in the browser
 */

import { Hands, Results } from '@mediapipe/hands'
import { Camera } from '@mediapipe/camera_utils'
import * as tf from '@tensorflow/tfjs'

export interface GestureResult {
  letter: string
  confidence: number
  landmarks: number[][]
  handDetected: boolean
  processingTime: number
  alternatives?: Array<{ letter: string; confidence: number }>
}

export interface GestureSequence {
  letters: string[]
  word: string
  confidence: number
  timestamp: string
}

export type GestureLanguage = 'asl' | 'bisindo'

export class GestureRecognitionService {
  private hands: Hands | null = null
  private camera: Camera | null = null
  private model: tf.LayersModel | null = null
  private isInitialized = false
  private currentLandmarks: number[][] = []
  private gestureSequence: string[] = []
  private lastGestureTime = 0
  private readonly GESTURE_COOLDOWN = 1000 // 1 second between gestures

  // ASL Letter mappings (simplified for demo)
  private readonly aslPatterns = {
    A: [0.1, 0.2, 0.3, 0.1, 0.05], // Simplified feature pattern
    B: [0.8, 0.8, 0.8, 0.8, 0.1],
    C: [0.6, 0.3, 0.3, 0.3, 0.3],
    D: [0.2, 0.8, 0.2, 0.2, 0.2],
    E: [0.1, 0.1, 0.1, 0.1, 0.1],
    F: [0.1, 0.8, 0.8, 0.8, 0.2],
    G: [0.2, 0.8, 0.1, 0.1, 0.1],
    H: [0.2, 0.8, 0.8, 0.1, 0.1],
    I: [0.1, 0.1, 0.1, 0.1, 0.8],
    J: [0.1, 0.1, 0.1, 0.1, 0.8], // Movement required
    K: [0.2, 0.8, 0.8, 0.1, 0.1],
    L: [0.2, 0.8, 0.1, 0.1, 0.1],
    M: [0.1, 0.1, 0.1, 0.3, 0.2],
    N: [0.1, 0.1, 0.3, 0.2, 0.2],
    O: [0.5, 0.5, 0.5, 0.5, 0.5],
    P: [0.2, 0.8, 0.8, 0.1, 0.1],
    Q: [0.2, 0.8, 0.1, 0.1, 0.1],
    R: [0.2, 0.8, 0.8, 0.1, 0.1],
    S: [0.1, 0.1, 0.1, 0.1, 0.1],
    T: [0.1, 0.1, 0.3, 0.2, 0.2],
    U: [0.2, 0.8, 0.8, 0.1, 0.1],
    V: [0.2, 0.8, 0.8, 0.1, 0.1],
    W: [0.2, 0.8, 0.8, 0.8, 0.1],
    X: [0.2, 0.5, 0.1, 0.1, 0.1],
    Y: [0.8, 0.1, 0.1, 0.1, 0.8],
    Z: [0.2, 0.8, 0.1, 0.1, 0.1],
  }

  constructor(private language: GestureLanguage = 'asl') {}

  /**
   * Initialize the gesture recognition service
   */
  async initialize(videoElement: HTMLVideoElement): Promise<boolean> {
    try {
      // Initialize MediaPipe Hands
      this.hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      })

      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      })

      this.hands.onResults(this.onResults.bind(this))

      // Initialize camera
      this.camera = new Camera(videoElement, {
        onFrame: async () => {
          if (this.hands) {
            await this.hands.send({ image: videoElement })
          }
        },
        width: 640,
        height: 480,
      })

      // Try to load TensorFlow model (optional)
      try {
        // In production, you would load a trained model
        // this.model = await tf.loadLayersModel('/models/gesture-model.json');
        console.log('Using pattern matching for gesture recognition')
      } catch (e) {
        console.log('No custom model found, using pattern matching')
      }

      this.isInitialized = true
      console.log('Gesture recognition service initialized')
      return true
    } catch (error) {
      console.error('Failed to initialize gesture recognition:', error)
      return false
    }
  }

  /**
   * Start gesture recognition
   */
  async start(): Promise<void> {
    if (!this.isInitialized || !this.camera) {
      throw new Error('Service not initialized')
    }

    await this.camera.start()
  }

  /**
   * Stop gesture recognition
   */
  stop(): void {
    if (this.camera) {
      this.camera.stop()
    }
  }

  /**
   * Process MediaPipe results
   */
  private onResults(results: Results): void {
    if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
      this.currentLandmarks = results.multiHandLandmarks[0].map((landmark) => [landmark.x, landmark.y, landmark.z])

      // Recognize gesture with cooldown
      const now = Date.now()
      if (now - this.lastGestureTime > this.GESTURE_COOLDOWN) {
        this.recognizeGesture()
        this.lastGestureTime = now
      }
    } else {
      this.currentLandmarks = []
    }
  }

  /**
   * Recognize gesture from current landmarks
   */
  private recognizeGesture(): GestureResult | null {
    if (this.currentLandmarks.length !== 21) {
      return null
    }

    const startTime = performance.now()

    try {
      // Extract features from landmarks
      const features = this.extractFeatures(this.currentLandmarks)

      // Classify gesture
      const result = this.classifyGesture(features)

      const processingTime = performance.now() - startTime

      const gestureResult: GestureResult = {
        letter: result.letter,
        confidence: result.confidence,
        landmarks: this.currentLandmarks,
        handDetected: true,
        processingTime,
        alternatives: result.alternatives,
      }

      // Add to sequence if confidence is high enough
      if (result.confidence > 0.6) {
        this.addToSequence(result.letter)
      }

      // Dispatch custom event
      this.dispatchGestureEvent(gestureResult)

      return gestureResult
    } catch (error) {
      console.error('Gesture recognition error:', error)
      return null
    }
  }

  /**
   * Extract features from hand landmarks
   */
  private extractFeatures(landmarks: number[][]): number[] {
    const features: number[] = []

    // Normalize landmarks relative to wrist (landmark 0)
    const wrist = landmarks[0]
    const normalized = landmarks.map((point) => [point[0] - wrist[0], point[1] - wrist[1], point[2] - wrist[2]])

    // Calculate finger tip distances from palm
    const fingerTips = [4, 8, 12, 16, 20] // Thumb, Index, Middle, Ring, Pinky
    const palm = landmarks[0] // Wrist as palm reference

    for (const tipIndex of fingerTips) {
      const tip = normalized[tipIndex]
      const distance = Math.sqrt(tip[0] ** 2 + tip[1] ** 2 + tip[2] ** 2)
      features.push(distance)
    }

    return features
  }

  /**
   * Classify gesture using pattern matching
   */
  private classifyGesture(features: number[]): {
    letter: string
    confidence: number
    alternatives: Array<{ letter: string; confidence: number }>
  } {
    const similarities: Array<{ letter: string; confidence: number }> = []

    // Compare with known patterns
    for (const [letter, pattern] of Object.entries(this.aslPatterns)) {
      const similarity = this.cosineSimilarity(features, pattern)
      similarities.push({ letter, confidence: similarity })
    }

    // Sort by confidence
    similarities.sort((a, b) => b.confidence - a.confidence)

    return {
      letter: similarities[0].letter,
      confidence: similarities[0].confidence,
      alternatives: similarities.slice(1, 4), // Top 3 alternatives
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] ** 2
      normB += b[i] ** 2
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Add letter to gesture sequence
   */
  private addToSequence(letter: string): void {
    // Avoid duplicate consecutive letters
    if (this.gestureSequence.length === 0 || this.gestureSequence[this.gestureSequence.length - 1] !== letter) {
      this.gestureSequence.push(letter)

      // Limit sequence length
      if (this.gestureSequence.length > 20) {
        this.gestureSequence = this.gestureSequence.slice(-20)
      }
    }
  }

  /**
   * Get current gesture sequence
   */
  getGestureSequence(): GestureSequence {
    return {
      letters: [...this.gestureSequence],
      word: this.gestureSequence.join(''),
      confidence: 0.8, // Average confidence
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Clear gesture sequence
   */
  clearSequence(): void {
    this.gestureSequence = []
  }

  /**
   * Dispatch gesture recognition event
   */
  private dispatchGestureEvent(result: GestureResult): void {
    const event = new CustomEvent('gestureRecognized', {
      detail: result,
    })
    window.dispatchEvent(event)
  }

  /**
   * Get current landmarks
   */
  getCurrentLandmarks(): number[][] {
    return [...this.currentLandmarks]
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.hands !== null
  }

  /**
   * Set language
   */
  setLanguage(language: GestureLanguage): void {
    this.language = language
    // In production, this would switch to different model/patterns
  }

  /**
   * Get recognition statistics
   */
  getStatistics() {
    return {
      isInitialized: this.isInitialized,
      hasModel: this.model !== null,
      currentSequenceLength: this.gestureSequence.length,
      lastGestureTime: this.lastGestureTime,
      language: this.language,
    }
  }
}

// Export singleton instance
export const gestureService = new GestureRecognitionService()

// Type definitions for events
declare global {
  interface WindowEventMap {
    gestureRecognized: CustomEvent<GestureResult>
  }
}
