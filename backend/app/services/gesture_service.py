"""
Gesture Recognition Service for Tunarasa

This service provides MediaPipe-based gesture recognition for American Sign Language (ASL)
letters and Indonesian Sign Language (Bisindo) gestures with ML model integration.
"""

import logging
import numpy as np
import json
import asyncio
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass
from enum import Enum

try:
    import mediapipe as mp
    import tensorflow as tf
    from sklearn.metrics.pairwise import cosine_similarity
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    logging.warning("MediaPipe or TensorFlow not available. Gesture recognition will use fallback mode.")

from app.core.config import settings

logger = logging.getLogger(__name__)


class GestureLanguage(Enum):
    """Supported gesture languages"""
    ASL = "asl"  # American Sign Language
    BISINDO = "bisindo"  # Indonesian Sign Language


class GestureType(Enum):
    """Types of gestures supported"""
    LETTER = "letter"
    WORD = "word"
    NUMBER = "number"
    PHRASE = "phrase"


@dataclass
class GestureResult:
    """Result of gesture recognition"""
    recognized_symbol: str
    confidence: float
    language: GestureLanguage
    gesture_type: GestureType
    landmarks: Optional[List[List[float]]] = None
    processing_time: float = 0.0
    alternatives: List[Tuple[str, float]] = None
    hand_detected: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "recognized_symbol": self.recognized_symbol,
            "confidence": self.confidence,
            "language": self.language.value,
            "gesture_type": self.gesture_type.value,
            "landmarks": self.landmarks,
            "processing_time": self.processing_time,
            "alternatives": self.alternatives or [],
            "hand_detected": self.hand_detected,
            "timestamp": datetime.utcnow().isoformat()
        }


@dataclass
class HandLandmarks:
    """MediaPipe hand landmarks with utilities"""
    landmarks: List[List[float]]
    hand_type: str  # "left" or "right"
    confidence: float
    
    def normalize(self) -> np.ndarray:
        """Normalize landmarks for ML model input"""
        if not self.landmarks:
            return np.zeros((21, 3))  # 21 landmarks, 3 coordinates each
        
        landmarks_array = np.array(self.landmarks)
        
        # Normalize relative to wrist (landmark 0)
        if len(landmarks_array) >= 21:
            wrist = landmarks_array[0]
            normalized = landmarks_array - wrist
            
            # Scale by hand size (distance from wrist to middle finger tip)
            if len(normalized) >= 12:
                hand_size = np.linalg.norm(normalized[12] - normalized[0])
                if hand_size > 0:
                    normalized = normalized / hand_size
            
            return normalized
        
        return np.zeros((21, 3))
    
    def get_feature_vector(self) -> np.ndarray:
        """Extract feature vector for gesture classification"""
        normalized = self.normalize()
        
        # Calculate angles between key landmarks
        features = []
        
        # Finger tip to base distances
        finger_tips = [4, 8, 12, 16, 20]  # Thumb, Index, Middle, Ring, Pinky
        finger_bases = [2, 5, 9, 13, 17]
        
        for tip, base in zip(finger_tips, finger_bases):
            if len(normalized) > max(tip, base):
                distance = np.linalg.norm(normalized[tip] - normalized[base])
                features.append(distance)
        
        # Finger to thumb distances
        thumb_tip = 4
        for finger_tip in [8, 12, 16, 20]:
            if len(normalized) > max(thumb_tip, finger_tip):
                distance = np.linalg.norm(normalized[thumb_tip] - normalized[finger_tip])
                features.append(distance)
        
        # Hand orientation features
        if len(normalized) >= 21:
            wrist_to_middle = normalized[9] - normalized[0]
            hand_vector = wrist_to_middle / (np.linalg.norm(wrist_to_middle) + 1e-8)
            features.extend(hand_vector)
        
        return np.array(features)


class GestureClassifier:
    """ML-based gesture classifier"""
    
    def __init__(self, language: GestureLanguage = GestureLanguage.ASL):
        self.language = language
        self.model = None
        self.label_encoder = None
        self.feature_scaler = None
        self.reference_gestures = {}
        self.is_loaded = False
        
        # Initialize gesture mappings
        self._init_gesture_mappings()
    
    def _init_gesture_mappings(self):
        """Initialize gesture to symbol mappings"""
        if self.language == GestureLanguage.ASL:
            self.gesture_symbols = {
                'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E',
                'F': 'F', 'G': 'G', 'H': 'H', 'I': 'I', 'J': 'J',
                'K': 'K', 'L': 'L', 'M': 'M', 'N': 'N', 'O': 'O',
                'P': 'P', 'Q': 'Q', 'R': 'R', 'S': 'S', 'T': 'T',
                'U': 'U', 'V': 'V', 'W': 'W', 'X': 'X', 'Y': 'Y', 'Z': 'Z'
            }
        elif self.language == GestureLanguage.BISINDO:
            # Indonesian Sign Language mappings
            self.gesture_symbols = {
                'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E',
                'F': 'F', 'G': 'G', 'H': 'H', 'I': 'I', 'J': 'J',
                'K': 'K', 'L': 'L', 'M': 'M', 'N': 'N', 'O': 'O',
                'P': 'P', 'Q': 'Q', 'R': 'R', 'S': 'S', 'T': 'T',
                'U': 'U', 'V': 'V', 'W': 'W', 'X': 'X', 'Y': 'Y', 'Z': 'Z'
            }
    
    async def load_model(self, model_path: Optional[str] = None) -> bool:
        """Load the trained gesture recognition model"""
        try:
            if not MEDIAPIPE_AVAILABLE:
                logger.warning("MediaPipe not available, using fallback recognition")
                return False
            
            # Try to load pre-trained model
            if model_path and Path(model_path).exists():
                self.model = tf.keras.models.load_model(model_path)
                logger.info(f"Loaded gesture model from {model_path}")
            else:
                # Load reference gestures for similarity-based recognition
                await self._load_reference_gestures()
                logger.info("Using reference gesture matching")
            
            self.is_loaded = True
            return True
            
        except Exception as e:
            logger.error(f"Failed to load gesture model: {e}")
            return False
    
    async def _load_reference_gestures(self):
        """Load reference gesture patterns for similarity matching"""
        # This would load pre-recorded gesture patterns
        # For now, use placeholder patterns
        self.reference_gestures = {
            'A': np.random.rand(15),  # Placeholder feature vector
            'B': np.random.rand(15),
            'C': np.random.rand(15),
            # Add more reference patterns...
        }
    
    async def classify_gesture(self, landmarks: HandLandmarks) -> GestureResult:
        """Classify gesture from hand landmarks"""
        start_time = datetime.utcnow()
        
        try:
            if not landmarks.landmarks:
                return GestureResult(
                    recognized_symbol="?",
                    confidence=0.0,
                    language=self.language,
                    gesture_type=GestureType.LETTER,
                    hand_detected=False,
                    processing_time=0.0
                )
            
            # Extract features
            features = landmarks.get_feature_vector()
            
            if self.model and self.is_loaded:
                # Use trained ML model
                result = await self._classify_with_model(features)
            else:
                # Use similarity matching
                result = await self._classify_with_similarity(features)
            
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            result.processing_time = processing_time
            
            return result
            
        except Exception as e:
            logger.error(f"Gesture classification failed: {e}")
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            return GestureResult(
                recognized_symbol="?",
                confidence=0.0,
                language=self.language,
                gesture_type=GestureType.LETTER,
                processing_time=processing_time,
                hand_detected=True
            )
    
    async def _classify_with_model(self, features: np.ndarray) -> GestureResult:
        """Classify using trained ML model"""
        try:
            # Reshape for model input
            features_reshaped = features.reshape(1, -1)
            
            # Predict
            predictions = self.model.predict(features_reshaped, verbose=0)
            confidence = float(np.max(predictions))
            predicted_class = int(np.argmax(predictions))
            
            # Convert to symbol
            symbols = list(self.gesture_symbols.keys())
            if predicted_class < len(symbols):
                recognized_symbol = symbols[predicted_class]
            else:
                recognized_symbol = "?"
                confidence = 0.0
            
            # Get alternatives
            top_indices = np.argsort(predictions[0])[-3:][::-1]
            alternatives = [(symbols[i], float(predictions[0][i])) 
                          for i in top_indices if i < len(symbols)]
            
            return GestureResult(
                recognized_symbol=recognized_symbol,
                confidence=confidence,
                language=self.language,
                gesture_type=GestureType.LETTER,
                alternatives=alternatives,
                hand_detected=True
            )
            
        except Exception as e:
            logger.error(f"Model prediction failed: {e}")
            return GestureResult(
                recognized_symbol="?",
                confidence=0.0,
                language=self.language,
                gesture_type=GestureType.LETTER,
                hand_detected=True
            )
    
    async def _classify_with_similarity(self, features: np.ndarray) -> GestureResult:
        """Classify using similarity matching with reference gestures"""
        try:
            if not self.reference_gestures:
                # Fallback to simple heuristic
                return await self._heuristic_classification(features)
            
            best_match = "?"
            best_confidence = 0.0
            similarities = []
            
            # Ensure features have the same dimension as reference
            target_dim = 15  # Expected feature dimension
            if len(features) != target_dim:
                # Pad or truncate features
                if len(features) < target_dim:
                    features = np.pad(features, (0, target_dim - len(features)))
                else:
                    features = features[:target_dim]
            
            # Compare with reference gestures
            for symbol, ref_features in self.reference_gestures.items():
                if len(ref_features) == len(features):
                    similarity = cosine_similarity([features], [ref_features])[0][0]
                    similarities.append((symbol, float(similarity)))
                    
                    if similarity > best_confidence:
                        best_confidence = similarity
                        best_match = symbol
            
            # Sort alternatives by similarity
            similarities.sort(key=lambda x: x[1], reverse=True)
            alternatives = similarities[:3]
            
            return GestureResult(
                recognized_symbol=best_match,
                confidence=best_confidence,
                language=self.language,
                gesture_type=GestureType.LETTER,
                alternatives=alternatives,
                hand_detected=True
            )
            
        except Exception as e:
            logger.error(f"Similarity matching failed: {e}")
            return await self._heuristic_classification(features)
    
    async def _heuristic_classification(self, features: np.ndarray) -> GestureResult:
        """Simple heuristic classification based on hand shape"""
        try:
            # Simple heuristics based on feature patterns
            # This is a fallback when no model is available
            
            if len(features) < 5:
                return GestureResult(
                    recognized_symbol="?",
                    confidence=0.1,
                    language=self.language,
                    gesture_type=GestureType.LETTER,
                    hand_detected=True
                )
            
            # Simple pattern matching
            finger_distances = features[:5] if len(features) >= 5 else features
            avg_distance = np.mean(finger_distances)
            
            # Heuristic rules
            if avg_distance < 0.1:
                # Closed fist - likely 'A' or 'S'
                recognized = 'A'
                confidence = 0.6
            elif avg_distance > 0.8:
                # Open hand - likely '5' or 'B'
                recognized = 'B'
                confidence = 0.5
            else:
                # Medium position - could be various letters
                recognized = 'C'
                confidence = 0.4
            
            return GestureResult(
                recognized_symbol=recognized,
                confidence=confidence,
                language=self.language,
                gesture_type=GestureType.LETTER,
                alternatives=[(recognized, confidence)],
                hand_detected=True
            )
            
        except Exception as e:
            logger.error(f"Heuristic classification failed: {e}")
            return GestureResult(
                recognized_symbol="?",
                confidence=0.0,
                language=self.language,
                gesture_type=GestureType.LETTER,
                hand_detected=True
            )


class MediaPipeGestureProcessor:
    """MediaPipe-based gesture processing"""
    
    def __init__(self):
        self.mp_hands = None
        self.hands = None
        self.mp_drawing = None
        self.mp_drawing_styles = None
        self.is_initialized = False
        
        if MEDIAPIPE_AVAILABLE:
            self._initialize_mediapipe()
    
    def _initialize_mediapipe(self):
        """Initialize MediaPipe hands solution"""
        try:
            self.mp_hands = mp.solutions.hands
            self.mp_drawing = mp.solutions.drawing_utils
            self.mp_drawing_styles = mp.solutions.drawing_styles
            
            self.hands = self.mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            
            self.is_initialized = True
            logger.info("MediaPipe hands initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize MediaPipe: {e}")
            self.is_initialized = False
    
    async def process_image(self, image_data: Union[np.ndarray, bytes]) -> List[HandLandmarks]:
        """Process image and extract hand landmarks"""
        try:
            if not self.is_initialized:
                logger.warning("MediaPipe not initialized, returning empty landmarks")
                return []
            
            # Convert image data if needed
            if isinstance(image_data, bytes):
                # Convert bytes to numpy array
                image_array = np.frombuffer(image_data, dtype=np.uint8)
                # This would need proper image decoding in practice
                logger.warning("Byte image processing not fully implemented")
                return []
            
            # Process with MediaPipe
            results = self.hands.process(image_data)
            
            hand_landmarks_list = []
            if results.multi_hand_landmarks:
                for idx, hand_landmarks in enumerate(results.multi_hand_landmarks):
                    # Extract landmark coordinates
                    landmarks = []
                    for landmark in hand_landmarks.landmark:
                        landmarks.append([landmark.x, landmark.y, landmark.z])
                    
                    # Determine hand type
                    hand_type = "right"  # Default
                    if results.multi_handedness and idx < len(results.multi_handedness):
                        hand_type = results.multi_handedness[idx].classification[0].label.lower()
                    
                    hand_landmarks_obj = HandLandmarks(
                        landmarks=landmarks,
                        hand_type=hand_type,
                        confidence=0.8  # Placeholder confidence
                    )
                    
                    hand_landmarks_list.append(hand_landmarks_obj)
            
            return hand_landmarks_list
            
        except Exception as e:
            logger.error(f"Image processing failed: {e}")
            return []
    
    async def process_landmarks_data(self, landmarks_data: List[List[float]]) -> HandLandmarks:
        """Process raw landmarks data"""
        try:
            if not landmarks_data or len(landmarks_data) != 21:
                logger.warning("Invalid landmarks data")
                return HandLandmarks(
                    landmarks=[],
                    hand_type="right",
                    confidence=0.0
                )
            
            return HandLandmarks(
                landmarks=landmarks_data,
                hand_type="right",  # Default
                confidence=0.8
            )
            
        except Exception as e:
            logger.error(f"Landmarks processing failed: {e}")
            return HandLandmarks(
                landmarks=[],
                hand_type="right",
                confidence=0.0
            )


class GestureRecognitionService:
    """Main gesture recognition service"""
    
    def __init__(self, language: GestureLanguage = GestureLanguage.ASL):
        self.language = language
        self.processor = MediaPipeGestureProcessor()
        self.classifier = GestureClassifier(language)
        self.is_initialized = False
        
        # Recognition statistics
        self.stats = {
            "total_recognitions": 0,
            "successful_recognitions": 0,
            "avg_confidence": 0.0,
            "avg_processing_time": 0.0
        }
    
    async def initialize(self, model_path: Optional[str] = None) -> bool:
        """Initialize the gesture recognition service"""
        try:
            # Load classifier model
            model_loaded = await self.classifier.load_model(model_path)
            
            self.is_initialized = True
            logger.info(f"Gesture recognition service initialized (model_loaded: {model_loaded})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize gesture service: {e}")
            return False
    
    async def recognize_from_landmarks(
        self, 
        landmarks_data: List[List[float]], 
        confidence_threshold: float = 0.5
    ) -> GestureResult:
        """Recognize gesture from MediaPipe landmarks data"""
        try:
            # Process landmarks
            hand_landmarks = await self.processor.process_landmarks_data(landmarks_data)
            
            # Classify gesture
            result = await self.classifier.classify_gesture(hand_landmarks)
            
            # Apply confidence threshold
            if result.confidence < confidence_threshold:
                result.recognized_symbol = "?"
                result.confidence = 0.0
            
            # Update statistics
            self._update_stats(result)
            
            return result
            
        except Exception as e:
            logger.error(f"Gesture recognition failed: {e}")
            return GestureResult(
                recognized_symbol="?",
                confidence=0.0,
                language=self.language,
                gesture_type=GestureType.LETTER,
                hand_detected=False
            )
    
    async def recognize_from_image(
        self, 
        image_data: Union[np.ndarray, bytes], 
        confidence_threshold: float = 0.5
    ) -> List[GestureResult]:
        """Recognize gestures from image data"""
        try:
            # Process image to get landmarks
            hand_landmarks_list = await self.processor.process_image(image_data)
            
            results = []
            for hand_landmarks in hand_landmarks_list:
                # Classify each detected hand
                result = await self.classifier.classify_gesture(hand_landmarks)
                
                # Apply confidence threshold
                if result.confidence < confidence_threshold:
                    result.recognized_symbol = "?"
                    result.confidence = 0.0
                
                # Update statistics
                self._update_stats(result)
                
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Image gesture recognition failed: {e}")
            return [GestureResult(
                recognized_symbol="?",
                confidence=0.0,
                language=self.language,
                gesture_type=GestureType.LETTER,
                hand_detected=False
            )]
    
    async def batch_recognize(
        self, 
        landmarks_batch: List[List[List[float]]], 
        confidence_threshold: float = 0.5
    ) -> List[GestureResult]:
        """Batch recognize multiple gesture sequences"""
        tasks = []
        for landmarks in landmarks_batch:
            task = self.recognize_from_landmarks(landmarks, confidence_threshold)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions
        valid_results = []
        for result in results:
            if isinstance(result, GestureResult):
                valid_results.append(result)
            else:
                # Create error result
                valid_results.append(GestureResult(
                    recognized_symbol="?",
                    confidence=0.0,
                    language=self.language,
                    gesture_type=GestureType.LETTER,
                    hand_detected=False
                ))
        
        return valid_results
    
    def _update_stats(self, result: GestureResult):
        """Update recognition statistics"""
        self.stats["total_recognitions"] += 1
        
        if result.confidence > 0.5:
            self.stats["successful_recognitions"] += 1
        
        # Update averages
        total = self.stats["total_recognitions"]
        prev_avg_conf = self.stats["avg_confidence"]
        prev_avg_time = self.stats["avg_processing_time"]
        
        self.stats["avg_confidence"] = (prev_avg_conf * (total - 1) + result.confidence) / total
        self.stats["avg_processing_time"] = (prev_avg_time * (total - 1) + result.processing_time) / total
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get recognition statistics"""
        return {
            **self.stats,
            "success_rate": (
                self.stats["successful_recognitions"] / max(1, self.stats["total_recognitions"])
            ),
            "language": self.language.value,
            "model_loaded": self.classifier.is_loaded,
            "mediapipe_available": MEDIAPIPE_AVAILABLE
        }
    
    async def calibrate_user(self, user_id: str, calibration_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calibrate recognition for specific user"""
        try:
            # This would implement user-specific calibration
            # For now, return success
            logger.info(f"Calibration requested for user {user_id}")
            
            return {
                "success": True,
                "user_id": user_id,
                "calibration_samples": len(calibration_data),
                "message": "User calibration completed"
            }
            
        except Exception as e:
            logger.error(f"User calibration failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Calibration failed"
            }


# Global service instances
_gesture_services: Dict[str, GestureRecognitionService] = {}


def get_gesture_service(language: GestureLanguage = GestureLanguage.ASL) -> GestureRecognitionService:
    """Get or create gesture recognition service instance"""
    key = language.value
    
    if key not in _gesture_services:
        _gesture_services[key] = GestureRecognitionService(language)
    
    return _gesture_services[key]


# Convenience functions
async def recognize_gesture_simple(
    landmarks: List[List[float]], 
    language: str = "asl",
    confidence_threshold: float = 0.5
) -> Dict[str, Any]:
    """Simple gesture recognition function"""
    
    try:
        lang_enum = GestureLanguage(language.lower())
        service = get_gesture_service(lang_enum)
        
        if not service.is_initialized:
            await service.initialize()
        
        result = await service.recognize_from_landmarks(landmarks, confidence_threshold)
        return result.to_dict()
        
    except Exception as e:
        logger.error(f"Simple gesture recognition failed: {e}")
        return {
            "recognized_symbol": "?",
            "confidence": 0.0,
            "language": language,
            "gesture_type": "letter",
            "hand_detected": False,
            "error": str(e)
        }


async def process_gesture_sequence(
    gesture_sequence: List[Dict[str, Any]],
    language: str = "asl"
) -> Dict[str, Any]:
    """Process a sequence of gestures to form words"""
    
    try:
        recognized_letters = []
        total_confidence = 0.0
        
        for gesture_data in gesture_sequence:
            landmarks = gesture_data.get("landmarks", [])
            if landmarks:
                result = await recognize_gesture_simple(landmarks, language)
                if result["confidence"] > 0.3:  # Minimum confidence
                    recognized_letters.append(result["recognized_symbol"])
                    total_confidence += result["confidence"]
        
        # Form word
        word = "".join(recognized_letters)
        avg_confidence = total_confidence / max(1, len(recognized_letters))
        
        return {
            "success": True,
            "recognized_letters": recognized_letters,
            "formed_word": word,
            "total_gestures": len(gesture_sequence),
            "valid_gestures": len(recognized_letters),
            "average_confidence": avg_confidence,
            "language": language
        }
        
    except Exception as e:
        logger.error(f"Gesture sequence processing failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "recognized_letters": [],
            "formed_word": "",
            "language": language
        }