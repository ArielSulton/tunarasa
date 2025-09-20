/**
 * SIBI (Sistem Isyarat Bahasa Indonesia) Configuration
 * Centralized configuration for HandPose + Fingerpose gesture recognition
 */

export const SIBI_CONFIG = {
  // HandPose settings - Optimized for performance
  MAX_NUM_HANDS: 1,
  MIN_DETECTION_CONFIDENCE: 0.65, // Reduced for faster detection
  SCORE_THRESHOLD: 5.0, // Reduced for better performance
  FLIP_HORIZONTAL: true, // Mirror camera for natural gestures

  // Gesture classification settings - Balanced accuracy/speed
  CONFIDENCE_THRESHOLD: 0.7, // Reduced for faster validation
  MAX_ALTERNATIVES: 2, // Reduced to save processing

  // Enhanced processing settings - Balanced for accuracy and performance
  SMOOTHING_WINDOW: 4, // Increased for better smoothing
  DEBOUNCE_TIME: 150, // Increased to prevent spam detection

  // Temporal consistency settings - Fine-tuned for optimal balance
  MIN_STABLE_FRAMES: 5, // Slightly increased for better accuracy
  CONFIDENCE_AVERAGING_WINDOW: 7, // Enhanced for better stability
  MAX_CONFIDENCE_VARIATION: 0.12, // Tightened for better accuracy
  TEMPORAL_VALIDATION_WINDOW: 1200, // Optimized to 1.2 seconds for balanced validation

  // SIBI alphabet mapping (Indonesian Sign Language)
  ALPHABET: [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
  ] as const,

  // Language settings
  DEFAULT_LANGUAGE: 'sibi' as const,
  SUPPORTED_LANGUAGES: ['sibi', 'bisindo'] as const,

  // Available gestures (implemented in handsigns directory)
  AVAILABLE_GESTURES: [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
  ] as const,
} as const

export type SibiLanguage = (typeof SIBI_CONFIG.SUPPORTED_LANGUAGES)[number]
export type SibiLetter = (typeof SIBI_CONFIG.ALPHABET)[number]
