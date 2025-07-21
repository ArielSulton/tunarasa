/**
 * SIBI (Sistem Isyarat Bahasa Indonesia) Configuration
 * Centralized configuration for SIBI gesture recognition model
 */

export const SIBI_CONFIG = {
  // Model configuration (TensorFlow.js JSON format)
  MODEL_PATH: '/models/tfjs_model/model.json',

  // Classification settings
  CONFIDENCE_THRESHOLD: 0.7,
  MAX_ALTERNATIVES: 3,

  // Processing settings
  NORMALIZATION_METHOD: 'wrist' as const,
  SMOOTHING_WINDOW: 5,
  DEBOUNCE_TIME: 500,

  // MediaPipe settings
  MAX_NUM_HANDS: 1,
  MODEL_COMPLEXITY: 1 as 0 | 1,
  MIN_DETECTION_CONFIDENCE: 0.7,
  MIN_TRACKING_CONFIDENCE: 0.7,

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
} as const

export type SibiLanguage = (typeof SIBI_CONFIG.SUPPORTED_LANGUAGES)[number]
export type SibiLetter = (typeof SIBI_CONFIG.ALPHABET)[number]
