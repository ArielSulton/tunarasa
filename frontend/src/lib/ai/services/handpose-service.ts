/**
 * HandPose Service with Fingerpose Integration
 * Real-time hand detection and gesture recognition using TensorFlow.js HandPose and Fingerpose
 */

import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
import * as handpose from '@tensorflow-models/handpose'
import { GestureEstimator } from 'fingerpose'
import { SIBI_CONFIG } from '../config/sibi-config'
import Handsigns from '../../../components/handsigns'

// Hand landmark connections for drawing
const fingerJoints = {
  thumb: [0, 1, 2, 3, 4],
  indexFinger: [0, 5, 6, 7, 8],
  middleFinger: [0, 9, 10, 11, 12],
  ringFinger: [0, 13, 14, 15, 16],
  pinky: [0, 17, 18, 19, 20],
}

export interface HandLandmark {
  x: number
  y: number
  z: number
}

export interface HandPoseDetection {
  landmarks: HandLandmark[]
  confidence: number
  timestamp: number
}

export interface GestureRecognitionResult {
  letter: string
  confidence: number
  alternatives: Array<{ letter: string; confidence: number }>
  timestamp: number
  processingTime: number
}

export interface HandPoseConfig {
  flipHorizontal: boolean
  maxNumHands: number
  detectionConfidence: number
  scoreThreshold: number
}

// Get all SIBI gesture definitions from handsigns directory
class SIBIGestures {
  static getAllGestures() {
    return Object.values(Handsigns)
  }
}

export class HandPoseService {
  private model: handpose.HandPose | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private allGestures: any[] = []
  private isInitialized = false
  private config: HandPoseConfig = {
    flipHorizontal: SIBI_CONFIG.FLIP_HORIZONTAL,
    maxNumHands: SIBI_CONFIG.MAX_NUM_HANDS,
    detectionConfidence: SIBI_CONFIG.MIN_DETECTION_CONFIDENCE,
    scoreThreshold: SIBI_CONFIG.SCORE_THRESHOLD,
  }

  constructor(config?: Partial<HandPoseConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔧 HandPoseService: Starting initialization...')

      // Initialize TensorFlow.js backend
      await tf.ready()
      console.log('✅ TensorFlow.js ready with backend:', tf.getBackend())

      // Load HandPose model
      console.log('📥 Loading HandPose model...')
      this.model = await handpose.load()
      console.log('✅ HandPose model loaded successfully')

      // Store gestures for creating new GestureEstimator instances (match reference pattern)
      this.allGestures = SIBIGestures.getAllGestures()
      console.log('✅ Loaded', this.allGestures.length, 'SIBI gestures (A-Z) for per-detection estimation')
      console.log('Available gestures:', this.allGestures.map((g) => g.name || 'unnamed').join(', '))

      this.isInitialized = true
    } catch (error) {
      console.error('❌ HandPose initialization failed:', error)
      throw error
    }
  }

  async detectHands(videoElement: HTMLVideoElement): Promise<HandPoseDetection[]> {
    if (!this.isInitialized || !this.model) {
      throw new Error('HandPose service not initialized')
    }

    // Validate video element and dimensions
    if (!videoElement || videoElement.readyState < 2) {
      throw new Error('Video element not ready')
    }

    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      throw new Error('Video dimensions not available')
    }

    try {
      // HandPose v0.1.0 API fix: Use object config but cast to avoid TypeScript error
      const predictions = await this.model.estimateHands(videoElement, {
        flipHorizontal: this.config.flipHorizontal,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      // Debug: Check if hand detection is working properly
      if (predictions.length > 0) {
        const firstHand = predictions[0]
        const wrist = firstHand.landmarks[0]
        const thumb = firstHand.landmarks[4]
        console.log(
          '👋 Hand detected - Wrist:',
          wrist.map((n) => n.toFixed(1)),
          'Thumb tip:',
          thumb.map((n) => n.toFixed(1)),
        )
      }

      return predictions.map((prediction) => {
        const landmarks: HandLandmark[] = prediction.landmarks.map((landmark) => ({
          x: landmark[0],
          y: landmark[1],
          z: landmark[2] || 0,
        }))

        return {
          landmarks,
          confidence: prediction.handInViewConfidence || 0.8,
          timestamp: Date.now(),
        }
      })
    } catch (error) {
      console.error('Hand detection error:', error)
      throw error
    }
  }

  async recognizeGesture(landmarks: HandLandmark[]): Promise<GestureRecognitionResult> {
    console.log('🚀 recognizeGesture called with', landmarks.length, 'landmarks')
    // Debug: Check if landmarks are actually changing
    const landmarkHash = landmarks
      .slice(0, 5)
      .map((l) => `${l.x.toFixed(1)},${l.y.toFixed(1)}`)
      .join('|')
    console.log('🔍 First 5 landmarks hash:', landmarkHash)

    if (!this.allGestures || this.allGestures.length === 0) {
      console.error('❌ Gestures not loaded!')
      throw new Error('Gestures not loaded')
    }

    const startTime = performance.now()

    try {
      // Debug: Check landmark data format
      console.log('🔍 Landmarks sample (first 3):')
      landmarks.slice(0, 3).forEach((lm, i) => {
        console.log(`  [${i}] x:${lm.x.toFixed(1)} y:${lm.y.toFixed(1)} z:${lm.z.toFixed(1)}`)
      })
      console.log('🔍 Landmarks length:', landmarks.length, 'Expected: 21')

      // Create new GestureEstimator for each detection (match reference pattern)
      const GE = new GestureEstimator(this.allGestures)
      console.log('🎯 Using threshold:', this.config.scoreThreshold, 'with', this.allGestures.length, 'gestures')

      // FIX: Use correct data format for fingerpose v0.1.0 (raw landmark arrays, not keypoint objects)
      // Convert landmarks back to raw array format that fingerpose expects: [[x,y,z], [x,y,z], ...]
      const rawLandmarks = landmarks.map((landmark) => [landmark.x, landmark.y, landmark.z])
      console.log('🔧 Using raw landmarks format for fingerpose:', rawLandmarks.length, 'points')

      // Call fingerpose with correct format (match official repository pattern)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gestureResults = GE.estimate(rawLandmarks as any, this.config.scoreThreshold)

      console.log('📊 Raw results:', gestureResults)

      // Debug: Check finger analysis from fingerpose
      if (gestureResults.poseData && gestureResults.poseData.length > 0) {
        const fingerData = gestureResults.poseData
        console.log('🖐️ Finger analysis:')
        console.log('📋 Raw poseData:', fingerData)
        fingerData.forEach((finger, idx) => {
          const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']
          console.log(`  Raw finger[${idx}]:`, finger)
          if (finger && typeof finger === 'object' && finger.length >= 3) {
            // FIX: Correct parsing - finger[1] is curl, finger[2] is direction
            console.log(`  ${fingerNames[idx]}: Curl=${finger[1]}, Direction=${finger[2]}`)
          } else if (finger && typeof finger === 'object') {
            // Try different property access patterns
            console.log(`  ${fingerNames[idx]}: Object keys=`, Object.keys(finger))
            console.log(`  ${fingerNames[idx]}: Full object=`, finger)
          }
        })
      }

      // Debug: check gesture object structure
      if (gestureResults.gestures && gestureResults.gestures.length > 0) {
        console.log('First gesture object:', gestureResults.gestures[0])
        console.log(
          'Gestures detected:',
          gestureResults.gestures.map((g) => `${g.name}:${g.score.toFixed(1)}`).join(', '),
        )
      } else {
        console.log('❌ No gestures detected above threshold', this.config.scoreThreshold)
      }

      // Process results
      let bestGesture = { name: 'Unknown', score: 0 }
      const alternatives: Array<{ letter: string; confidence: number }> = []

      if (gestureResults.gestures.length > 0) {
        // Use score property (fingerpose library uses 'score', not 'confidence')
        const scores = gestureResults.gestures.map((p) => p.score)
        const maxScore = Math.max(...scores)
        const maxScoreIndex = scores.indexOf(maxScore)

        console.log('🔍 Scores array:', scores)
        console.log('🔍 Max score:', maxScore, 'at index:', maxScoreIndex)
        console.log(
          '🔍 All gestures with scores:',
          gestureResults.gestures.map((g, i) => `[${i}] ${g.name}:${g.score}`),
        )

        bestGesture = {
          name: gestureResults.gestures[maxScoreIndex].name,
          score: gestureResults.gestures[maxScoreIndex].score,
        }

        console.log('→', bestGesture.name, 'selected (', gestureResults.gestures[maxScoreIndex].score.toFixed(1), ')')

        // Get alternatives using score
        for (let i = 0; i < gestureResults.gestures.length; i++) {
          if (i !== maxScoreIndex && alternatives.length < 3) {
            alternatives.push({
              letter: gestureResults.gestures[i].name,
              confidence: gestureResults.gestures[i].score, // Map score to confidence for consistency
            })
          }
        }
      }

      const processingTime = performance.now() - startTime

      // Force confidence to reasonable values
      const cappedConfidence = Math.min(Math.max(bestGesture.score, 0), 1.0)

      // Final gesture result

      return {
        letter: bestGesture.name,
        confidence: cappedConfidence, // Force cap confidence at 100%
        alternatives,
        timestamp: Date.now(),
        processingTime,
      }
    } catch (error) {
      console.error('Gesture recognition error:', error)
      throw error
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.model !== null && this.allGestures.length > 0
  }

  updateConfig(config: Partial<HandPoseConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): HandPoseConfig {
    return { ...this.config }
  }

  // Manual finger analysis to debug fingerpose issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private analyzeFingerManually(landmarks: any[]): any {
    // MediaPipe hand landmarks indices:
    // Thumb: 1, 2, 3, 4
    // Index: 5, 6, 7, 8
    // Middle: 9, 10, 11, 12
    // Ring: 13, 14, 15, 16
    // Pinky: 17, 18, 19, 20

    const fingers = {
      thumb: [1, 2, 3, 4],
      index: [5, 6, 7, 8],
      middle: [9, 10, 11, 12],
      ring: [13, 14, 15, 16],
      pinky: [17, 18, 19, 20],
    }

    const results: { [key: string]: { curl: string; direction: string } } = {}

    Object.entries(fingers).forEach(([fingerName, joints]) => {
      // Get finger joint positions
      const fingerJoints = joints.map((i) => landmarks[i])

      // Calculate curl based on joint angles (simplified)
      const tip = fingerJoints[3] // fingertip
      const pip = fingerJoints[1] // proximal interphalangeal joint

      // Simple curl calculation: if tip is below pip, finger is curled
      const isCurled = tip.y > pip.y
      const curl = isCurled ? 'FullCurl' : 'NoCurl'

      // Simple direction calculation based on fingertip position relative to base
      const base = fingerJoints[0]
      const deltaX = tip.x - base.x
      const deltaY = tip.y - base.y

      let direction = 'Unknown'
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'HorizontalRight' : 'HorizontalLeft'
      } else {
        direction = deltaY < 0 ? 'VerticalUp' : 'VerticalDown'
      }

      results[fingerName] = { curl, direction }
    })

    return results
  }

  dispose(): void {
    this.model = null
    this.allGestures = []
    this.isInitialized = false
  }
}

// Drawing function for hand landmarks
export const drawHand = (predictions: HandPoseDetection[], ctx: CanvasRenderingContext2D) => {
  if (predictions.length === 0) return

  predictions.forEach((prediction) => {
    const landmarks = prediction.landmarks

    // Draw finger connections
    Object.values(fingerJoints).forEach((finger) => {
      for (let i = 0; i < finger.length - 1; i++) {
        const firstJointIndex = finger[i]
        const secondJointIndex = finger[i + 1]

        if (landmarks[firstJointIndex] && landmarks[secondJointIndex]) {
          const firstJoint = landmarks[firstJointIndex]
          const secondJoint = landmarks[secondJointIndex]

          ctx.beginPath()
          ctx.moveTo(firstJoint.x, firstJoint.y)
          ctx.lineTo(secondJoint.x, secondJoint.y)
          ctx.strokeStyle = '#00ff00'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
    })

    // Draw landmark points
    landmarks.forEach((landmark, index) => {
      ctx.beginPath()
      ctx.arc(landmark.x, landmark.y, 5, 0, 2 * Math.PI)
      ctx.fillStyle = index < 4 ? '#ff0000' : '#0000ff' // Thumb in red, others in blue
      ctx.fill()
    })
  })
}
