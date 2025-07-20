/**
 * TensorFlow.js Gesture Classification Service
 * Classifies hand landmarks into A-Z letters for sign language recognition
 */

import * as tf from '@tensorflow/tfjs'
import { HandLandmark } from './mediapipe-service'

export interface GestureClassificationResult {
  letter: string
  confidence: number
  alternatives: Array<{ letter: string; confidence: number }>
  processingTime: number
}

export interface GestureClassifierConfig {
  modelPath: string
  confidenceThreshold: number
  maxAlternatives: number
  normalizationMethod: 'wrist' | 'center' | 'none'
}

export class GestureClassifier {
  private model: tf.LayersModel | null = null
  private isLoaded = false
  private config: GestureClassifierConfig
  private alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

  constructor(config?: Partial<GestureClassifierConfig>) {
    this.config = {
      modelPath: '/models/sibi_model.h5',
      confidenceThreshold: 0.7,
      maxAlternatives: 3,
      normalizationMethod: 'wrist',
      ...config,
    }
  }

  /**
   * Load the TensorFlow.js model
   */
  async loadModel(): Promise<void> {
    try {
      console.log('Loading gesture classification model...')

      // Load the model
      this.model = await tf.loadLayersModel(this.config.modelPath)

      // Warm up the model with dummy data
      const dummyInput = tf.zeros([1, 42]) // 21 landmarks * 2 coordinates
      const warmupResult = this.model.predict(dummyInput) as tf.Tensor
      warmupResult.dispose()
      dummyInput.dispose()

      this.isLoaded = true
      console.log('Gesture classification model loaded successfully')
    } catch (error) {
      console.error('Failed to load gesture classification model:', error)
      throw error
    }
  }

  /**
   * Classify hand landmarks into A-Z letters
   */
  async classify(landmarks: HandLandmark[]): Promise<GestureClassificationResult> {
    if (!this.isLoaded || !this.model) {
      throw new Error('Model not loaded. Call loadModel() first.')
    }

    const startTime = performance.now()

    try {
      // Normalize landmarks
      const normalizedLandmarks = this.normalizeLandmarks(landmarks)

      // Convert to tensor
      const inputTensor = tf.tensor2d([normalizedLandmarks], [1, normalizedLandmarks.length])

      // Make prediction
      const prediction = this.model.predict(inputTensor) as tf.Tensor
      const predictions = await prediction.data()

      // Clean up tensors
      inputTensor.dispose()
      prediction.dispose()

      // Process results
      const results = this.processResults(Array.from(predictions))

      const processingTime = performance.now() - startTime

      return {
        letter: results.topPrediction.letter,
        confidence: results.topPrediction.confidence,
        alternatives: results.alternatives,
        processingTime,
      }
    } catch (error) {
      console.error('Classification error:', error)
      throw error
    }
  }

  /**
   * Normalize hand landmarks for consistent input
   */
  private normalizeLandmarks(landmarks: HandLandmark[]): number[] {
    if (landmarks.length !== 21) {
      throw new Error('Expected 21 hand landmarks')
    }

    let normalized: number[] = []

    switch (this.config.normalizationMethod) {
      case 'wrist':
        normalized = this.normalizeToWrist(landmarks)
        break
      case 'center':
        normalized = this.normalizeToCenter(landmarks)
        break
      case 'none':
        normalized = landmarks.flatMap((landmark) => [landmark.x, landmark.y])
        break
      default:
        throw new Error(`Unknown normalization method: ${this.config.normalizationMethod}`)
    }

    return normalized
  }

  /**
   * Normalize landmarks relative to wrist position
   */
  private normalizeToWrist(landmarks: HandLandmark[]): number[] {
    const wrist = landmarks[0] // Wrist is always landmark 0
    const normalized: number[] = []

    for (const landmark of landmarks) {
      normalized.push(landmark.x - wrist.x)
      normalized.push(landmark.y - wrist.y)
    }

    return normalized
  }

  /**
   * Normalize landmarks relative to center point
   */
  private normalizeToCenter(landmarks: HandLandmark[]): number[] {
    // Calculate center point
    const centerX = landmarks.reduce((sum, landmark) => sum + landmark.x, 0) / landmarks.length
    const centerY = landmarks.reduce((sum, landmark) => sum + landmark.y, 0) / landmarks.length

    const normalized: number[] = []

    for (const landmark of landmarks) {
      normalized.push(landmark.x - centerX)
      normalized.push(landmark.y - centerY)
    }

    return normalized
  }

  /**
   * Process model predictions into readable results
   */
  private processResults(predictions: number[]): {
    topPrediction: { letter: string; confidence: number }
    alternatives: Array<{ letter: string; confidence: number }>
  } {
    // Create array of letter-confidence pairs
    const results = predictions.map((confidence, index) => ({
      letter: this.alphabet[index],
      confidence,
    }))

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence)

    // Get top prediction
    const topPrediction = results[0]

    // Get alternatives (excluding top prediction)
    const alternatives = results
      .slice(1, this.config.maxAlternatives + 1)
      .filter((result) => result.confidence >= this.config.confidenceThreshold * 0.5)

    return {
      topPrediction,
      alternatives,
    }
  }

  /**
   * Batch classify multiple gesture sequences
   */
  async classifyBatch(landmarkSequences: HandLandmark[][]): Promise<GestureClassificationResult[]> {
    if (!this.isLoaded || !this.model) {
      throw new Error('Model not loaded. Call loadModel() first.')
    }

    const results: GestureClassificationResult[] = []

    for (const landmarks of landmarkSequences) {
      try {
        const result = await this.classify(landmarks)
        results.push(result)
      } catch (error) {
        console.error('Error classifying gesture in batch:', error)
        // Continue with next gesture instead of failing entire batch
      }
    }

    return results
  }

  /**
   * Get model information
   */
  getModelInfo(): {
    isLoaded: boolean
    inputShape: number[] | null
    outputShape: number[] | null
    config: GestureClassifierConfig
  } {
    return {
      isLoaded: this.isLoaded,
      inputShape: this.model?.inputs[0]?.shape ? Array.from(this.model.inputs[0].shape.map((dim) => dim || 0)) : null,
      outputShape: this.model?.outputs[0]?.shape
        ? Array.from(this.model.outputs[0].shape.map((dim) => dim || 0))
        : null,
      config: { ...this.config },
    }
  }

  /**
   * Update classifier configuration
   */
  updateConfig(config: Partial<GestureClassifierConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Check if classifier is ready
   */
  isReady(): boolean {
    return this.isLoaded && this.model !== null
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose()
      this.model = null
    }
    this.isLoaded = false
  }
}
