/**
 * SIBI (Sistem Isyarat Bahasa Indonesia) Configuration
 * Centralized configuration for HandPose + Fingerpose gesture recognition
 */

export const SIBI_CONFIG = {
  // HandPose settings
  MAX_NUM_HANDS: 1,
  MIN_DETECTION_CONFIDENCE: 0.75, // Increased for better detection
  SCORE_THRESHOLD: 7.0, // Increased from 4.0 for higher precision
  FLIP_HORIZONTAL: true, // Mirror camera for natural gestures

  // Gesture classification settings
  CONFIDENCE_THRESHOLD: 0.85, // Increased from 0.8 for better accuracy
  MAX_ALTERNATIVES: 3,

  // Enhanced processing settings
  SMOOTHING_WINDOW: 7, // Increased from 5 for better smoothing
  DEBOUNCE_TIME: 300, // Increased from 150ms for better stability

  // New temporal consistency settings
  MIN_STABLE_FRAMES: 5, // Minimum consecutive stable frames
  CONFIDENCE_AVERAGING_WINDOW: 10, // Frames for confidence averaging
  MAX_CONFIDENCE_VARIATION: 0.1, // Maximum allowed confidence variation
  TEMPORAL_VALIDATION_WINDOW: 1500, // 1.5 second validation window

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
