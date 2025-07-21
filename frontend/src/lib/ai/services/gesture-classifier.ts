/**
 * TensorFlow.js Gesture Classification Service
 * Classifies hand gesture images into A-Z letters for SIBI recognition
 */

import * as tf from '@tensorflow/tfjs'
import { SIBI_CONFIG } from '../config/sibi-config'

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
  imageSize: number
}

export class GestureClassifier {
  private model: tf.LayersModel | tf.GraphModel | null = null
  private isLoaded = false
  private config: GestureClassifierConfig
  private alphabet = SIBI_CONFIG.ALPHABET

  constructor(config?: Partial<GestureClassifierConfig>) {
    this.config = {
      modelPath: SIBI_CONFIG.MODEL_PATH,
      confidenceThreshold: SIBI_CONFIG.CONFIDENCE_THRESHOLD,
      maxAlternatives: SIBI_CONFIG.MAX_ALTERNATIVES,
      imageSize: 224, // MobileNet input size
      ...config,
    }
  }

  /**
   * Load the TensorFlow.js model
   */
  async loadModel(): Promise<void> {
    try {
      console.log('TensorFlow.js version:', tf.version.tfjs)
      console.log('Available backends:', tf.engine().registryFactory)

      // Set TensorFlow.js backend
      await tf.ready()
      console.log('TensorFlow.js ready with backend:', tf.getBackend())

      // Try to load the model, fallback if not available
      try {
        console.log('Loading TensorFlow.js model from:', this.config.modelPath)

        // For Keras v3.5.0 converted models, try with explicit HTTP handler
        try {
          console.log('Attempting to load with explicit HTTP handler...')
          const httpHandler = tf.io.http(this.config.modelPath)
          this.model = await tf.loadLayersModel(httpHandler, {
            strict: false,
          })
          console.log('✅ Successfully loaded as LayersModel with HTTP handler')
        } catch (layersError) {
          console.warn('Failed to load with HTTP handler, trying direct path:', layersError)
          try {
            // Fallback: Try direct loading
            console.log('Attempting direct LayersModel loading...')
            this.model = await tf.loadLayersModel(this.config.modelPath, {
              strict: false,
              fromTFHub: false,
            })
            console.log('✅ Successfully loaded as LayersModel (direct)')
          } catch (directError) {
            console.warn('Direct loading failed, trying GraphModel:', directError)
            try {
              // Final fallback: Try as graph model
              console.log('Attempting to load as GraphModel...')
              const graphModel = await tf.loadGraphModel(this.config.modelPath)
              this.model = graphModel
              console.log('✅ Successfully loaded as GraphModel')
            } catch (graphError) {
              console.error('All loading methods failed')
              console.error('HTTP handler error:', (layersError as Error).message)
              console.error('Direct loading error:', (directError as Error).message)
              console.error('GraphModel error:', (graphError as Error).message)
              throw new Error(
                `Model loading failed with all methods. HTTP: ${(layersError as Error).message}, Direct: ${(directError as Error).message}, Graph: ${(graphError as Error).message}`,
              )
            }
          }
        }

        console.log('Model loaded successfully, warming up...')

        // Check model input/output shapes
        if (this.model.inputs && this.model.inputs[0]) {
          console.log('Model input shape:', this.model.inputs[0].shape)
        }
        if (this.model.outputs && this.model.outputs[0]) {
          console.log('Model output shape:', this.model.outputs[0].shape)
        }

        // Warm up the model with dummy data
        const dummyInput = tf.zeros([1, 224, 224, 3]) // Image input shape
        console.log('Running model warmup...')

        let warmupResult: tf.Tensor
        if ('predict' in this.model) {
          // LayersModel
          warmupResult = (this.model as tf.LayersModel).predict(dummyInput) as tf.Tensor
        } else if ('execute' in this.model) {
          // GraphModel
          warmupResult = (this.model as tf.GraphModel).execute(dummyInput) as tf.Tensor
        } else {
          throw new Error('Model does not have predict or execute method')
        }

        console.log('Warmup prediction shape:', warmupResult.shape)
        warmupResult.dispose()
        dummyInput.dispose()

        this.isLoaded = true
        console.log('✅ Gesture classification model loaded and warmed up successfully')
      } catch (modelError) {
        console.error('❌ Failed to load model:', modelError)
        console.error('Model path:', this.config.modelPath)

        this.model = null
        this.isLoaded = false
        console.warn(
          'Gesture classification model unavailable - system will continue with MediaPipe hand detection only',
        )
        // Don't throw error, allow system to continue without gesture classification
      }
    } catch (error) {
      console.error('Failed to initialize gesture classifier:', error)
      // Don't throw error, allow system to continue without gesture recognition
      this.model = null
      this.isLoaded = false
    }
  }

  /**
   * Classify hand gesture image into A-Z letters
   */
  async classify(
    imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  ): Promise<GestureClassificationResult> {
    if (!this.isLoaded || !this.model) {
      throw new Error('Gesture classification model not available')
    }

    const startTime = performance.now()

    try {
      // Preprocess image
      const preprocessedImage = this.preprocessImage(imageElement)

      // Make prediction (handle both LayersModel and GraphModel)
      let prediction: tf.Tensor
      if ('predict' in this.model) {
        // LayersModel
        prediction = (this.model as tf.LayersModel).predict(preprocessedImage) as tf.Tensor
      } else if ('execute' in this.model) {
        // GraphModel
        prediction = (this.model as tf.GraphModel).execute(preprocessedImage) as tf.Tensor
      } else {
        throw new Error('Model does not have predict or execute method')
      }
      const predictions = await prediction.data()

      // Clean up tensors
      preprocessedImage.dispose()
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
   * Preprocess image for model input
   */
  private preprocessImage(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): tf.Tensor4D {
    // Convert image to tensor and resize to model input size
    let imageTensor = tf.browser.fromPixels(imageElement)

    // Resize to model input size (224x224)
    imageTensor = tf.image.resizeBilinear(imageTensor, [this.config.imageSize, this.config.imageSize])

    // Normalize to [0, 1] range (if using MobileNet preprocessing)
    imageTensor = imageTensor.div(255.0)

    // Add batch dimension
    const batchedImage = imageTensor.expandDims(0) as tf.Tensor4D

    // Clean up intermediate tensor
    imageTensor.dispose()

    return batchedImage
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
   * Batch classify multiple gesture images
   */
  async classifyBatch(
    imageElements: (HTMLImageElement | HTMLVideoElement | HTMLCanvasElement)[],
  ): Promise<GestureClassificationResult[]> {
    if (!this.isLoaded || !this.model) {
      throw new Error('Gesture classification model not available')
    }

    const results: GestureClassificationResult[] = []

    for (const imageElement of imageElements) {
      try {
        const result = await this.classify(imageElement)
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
