/**
 * SIBI (Sistem Isyarat Bahasa Indonesia) Configuration
 * Centralized configuration for HandPose + Fingerpose gesture recognition
 */

export const SIBI_CONFIG = {
  // HandPose settings
  MAX_NUM_HANDS: 1,
  MIN_DETECTION_CONFIDENCE: 0.7,
  SCORE_THRESHOLD: 4.0, // Temporarily lower for testing
  FLIP_HORIZONTAL: true, // Mirror camera for natural gestures

  // Gesture classification settings
  CONFIDENCE_THRESHOLD: 0.8, // Increased from 0.7
  MAX_ALTERNATIVES: 3,

  // Processing settings
  SMOOTHING_WINDOW: 5,
  DEBOUNCE_TIME: 150, // Match reference project interval

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
