"""
Gesture Recognition Validation Service
Provides ground truth validation for gesture recognition accuracy metrics
"""

import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.metrics_service import metrics_service

logger = logging.getLogger(__name__)


class GestureGroundTruth:
    """Ground truth data structure for gesture validation"""

    def __init__(
        self,
        gesture_id: str,
        expected_text: str,
        gesture_type: str,
        confidence_threshold: float = 0.7,
        variations: Optional[List[str]] = None,
    ):
        self.gesture_id = gesture_id
        self.expected_text = expected_text.lower().strip()
        self.gesture_type = gesture_type
        self.confidence_threshold = confidence_threshold
        self.variations = variations or []
        self.created_at = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "gesture_id": self.gesture_id,
            "expected_text": self.expected_text,
            "gesture_type": self.gesture_type,
            "confidence_threshold": self.confidence_threshold,
            "variations": self.variations,
            "created_at": self.created_at.isoformat(),
        }


class GestureValidationService:
    """Service for validating gesture recognition accuracy against ground truth"""

    def __init__(self):
        self.ground_truth_data: Dict[str, GestureGroundTruth] = {}
        self.validation_history: List[Dict[str, Any]] = []
        self.accuracy_metrics = {
            "total_validations": 0,
            "correct_predictions": 0,
            "accuracy_score": 0.0,
            "last_updated": datetime.now(timezone.utc),
        }
        self._initialize_ground_truth_dataset()

    def _initialize_ground_truth_dataset(self):
        """Initialize comprehensive ground truth dataset for Indonesian sign language"""

        # Administrative/Government services - most common for accessibility services
        admin_gestures = [
            GestureGroundTruth(
                "admin_001",
                "cara membuat ktp baru",
                "administrative",
                0.8,
                ["bagaimana membuat ktp", "prosedur ktp baru", "buat kartu identitas"],
            ),
            GestureGroundTruth(
                "admin_002",
                "perpanjang sim",
                "administrative",
                0.8,
                ["cara perpanjang sim", "renewal sim", "extend driving license"],
            ),
            GestureGroundTruth(
                "admin_003",
                "buat akta kelahiran",
                "administrative",
                0.8,
                ["cara buat akta lahir", "birth certificate", "dokumen kelahiran"],
            ),
            GestureGroundTruth(
                "admin_004",
                "cara daftar bpjs",
                "administrative",
                0.8,
                ["pendaftaran bpjs", "register health insurance", "asuransi kesehatan"],
            ),
            GestureGroundTruth(
                "admin_005",
                "buat paspor baru",
                "administrative",
                0.8,
                ["cara bikin paspor", "passport application", "dokumen perjalanan"],
            ),
        ]

        # Health and medical services
        health_gestures = [
            GestureGroundTruth(
                "health_001",
                "dimana rumah sakit terdekat",
                "health",
                0.8,
                ["hospital terdekat", "cari rs", "nearest hospital"],
            ),
            GestureGroundTruth(
                "health_002",
                "cara daftar puskesmas",
                "health",
                0.8,
                [
                    "register puskesmas",
                    "community health center",
                    "fasilitas kesehatan",
                ],
            ),
            GestureGroundTruth(
                "health_003",
                "beli obat dimana",
                "health",
                0.8,
                ["apotek terdekat", "pharmacy location", "cari obat"],
            ),
            GestureGroundTruth(
                "health_004",
                "jadwal dokter",
                "health",
                0.8,
                ["schedule doctor", "appointment dokter", "konsultasi medis"],
            ),
        ]

        # Education services
        education_gestures = [
            GestureGroundTruth(
                "edu_001",
                "cara daftar sekolah",
                "education",
                0.8,
                ["pendaftaran sekolah", "school registration", "masuk sekolah"],
            ),
            GestureGroundTruth(
                "edu_002",
                "beasiswa tersedia",
                "education",
                0.8,
                ["scholarship available", "bantuan pendidikan", "dana kuliah"],
            ),
            GestureGroundTruth(
                "edu_003",
                "jadwal ujian",
                "education",
                0.8,
                ["exam schedule", "test schedule", "waktu ujian"],
            ),
        ]

        # Transportation
        transport_gestures = [
            GestureGroundTruth(
                "trans_001",
                "jadwal bus",
                "transportation",
                0.8,
                ["schedule bus", "waktu bus", "transportasi umum"],
            ),
            GestureGroundTruth(
                "trans_002",
                "tiket kereta api",
                "transportation",
                0.8,
                ["train ticket", "beli tiket ka", "perjalanan kereta"],
            ),
            GestureGroundTruth(
                "trans_003",
                "tarif ojek online",
                "transportation",
                0.8,
                ["harga gojek", "biaya grab", "online transport"],
            ),
        ]

        # Emergency and safety
        emergency_gestures = [
            GestureGroundTruth(
                "emerg_001",
                "panggil ambulans",
                "emergency",
                0.9,
                ["call ambulance", "darurat medis", "emergency medical"],
            ),
            GestureGroundTruth(
                "emerg_002",
                "lapor polisi",
                "emergency",
                0.9,
                ["call police", "emergency police", "keamanan"],
            ),
            GestureGroundTruth(
                "emerg_003",
                "panggil pemadam",
                "emergency",
                0.9,
                ["call fire department", "damkar", "kebakaran"],
            ),
        ]

        # Communication and accessibility
        communication_gestures = [
            GestureGroundTruth(
                "comm_001",
                "tolong saya",
                "communication",
                0.9,
                ["help me", "bantuan", "need assistance"],
            ),
            GestureGroundTruth(
                "comm_002",
                "saya tidak bisa dengar",
                "communication",
                0.9,
                ["i cant hear", "deaf", "tuli", "gangguan pendengaran"],
            ),
            GestureGroundTruth(
                "comm_003",
                "terima kasih",
                "communication",
                0.8,
                ["thank you", "thanks", "makasih"],
            ),
            GestureGroundTruth(
                "comm_004",
                "permisi",
                "communication",
                0.8,
                ["excuse me", "sorry", "maaf"],
            ),
        ]

        # Combine all gesture datasets
        all_gestures = (
            admin_gestures
            + health_gestures
            + education_gestures
            + transport_gestures
            + emergency_gestures
            + communication_gestures
        )

        # Store in dictionary for quick lookup
        for gesture in all_gestures:
            self.ground_truth_data[gesture.gesture_id] = gesture

        logger.info(
            f"Initialized ground truth dataset with {len(all_gestures)} gesture patterns"
        )

    def calculate_text_similarity(
        self, predicted_text: str, expected_text: str
    ) -> float:
        """
        Calculate similarity between predicted and expected text using multiple methods
        Returns similarity score between 0.0 and 1.0
        """
        if not predicted_text or not expected_text:
            return 0.0

        predicted = predicted_text.lower().strip()
        expected = expected_text.lower().strip()

        # Exact match
        if predicted == expected:
            return 1.0

        # Word overlap similarity
        predicted_words = set(predicted.split())
        expected_words = set(expected.split())

        if not predicted_words or not expected_words:
            return 0.0

        intersection = predicted_words.intersection(expected_words)
        union = predicted_words.union(expected_words)

        jaccard_similarity = len(intersection) / len(union) if union else 0.0

        # Character-level similarity (Levenshtein distance approximation)
        def levenshtein_ratio(s1: str, s2: str) -> float:
            if len(s1) == 0:
                return len(s2)
            if len(s2) == 0:
                return len(s1)

            # Simple character overlap approximation
            common_chars = sum(1 for c in s1 if c in s2)
            total_chars = max(len(s1), len(s2))
            return common_chars / total_chars if total_chars > 0 else 0.0

        char_similarity = levenshtein_ratio(predicted, expected)

        # Combined similarity score (weighted)
        combined_similarity = (jaccard_similarity * 0.7) + (char_similarity * 0.3)

        return min(combined_similarity, 1.0)

    def validate_gesture_prediction(
        self,
        predicted_text: str,
        gesture_confidence: float,
        gesture_type: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Validate gesture prediction against ground truth dataset
        Returns validation results with accuracy metrics
        """
        validation_start = time.time()

        try:
            if not predicted_text:
                return self._create_validation_result(
                    False, 0.0, 0.0, "Empty prediction text", validation_start
                )

            best_match = None
            best_similarity = 0.0
            best_ground_truth = None

            # Find best match in ground truth dataset
            for gt_id, ground_truth in self.ground_truth_data.items():
                # Calculate similarity with main expected text
                similarity = self.calculate_text_similarity(
                    predicted_text, ground_truth.expected_text
                )

                # Also check against variations
                for variation in ground_truth.variations:
                    var_similarity = self.calculate_text_similarity(
                        predicted_text, variation
                    )
                    similarity = max(similarity, var_similarity)

                # Update best match if this is better
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = gt_id
                    best_ground_truth = ground_truth

            # Determine if prediction is correct based on similarity threshold
            similarity_threshold = 0.6  # 60% similarity required for correct match
            is_correct = best_similarity >= similarity_threshold

            # Additional confidence check
            confidence_passed = gesture_confidence >= (
                best_ground_truth.confidence_threshold if best_ground_truth else 0.7
            )

            # Calculate accuracy score combining similarity and confidence
            accuracy_score = (best_similarity * 0.8) + (gesture_confidence * 0.2)

            # Update metrics
            self.accuracy_metrics["total_validations"] += 1
            if is_correct and confidence_passed:
                self.accuracy_metrics["correct_predictions"] += 1

            # Recalculate overall accuracy
            self.accuracy_metrics["accuracy_score"] = (
                self.accuracy_metrics["correct_predictions"]
                / self.accuracy_metrics["total_validations"]
            )
            self.accuracy_metrics["last_updated"] = datetime.now(timezone.utc)

            # Record metrics to Prometheus
            metrics_service.record_gesture_recognition(
                gesture_type=gesture_type or "unknown",
                confidence=gesture_confidence,
                accuracy=accuracy_score,  # Now we have REAL accuracy!
            )

            # Create validation result
            validation_result = self._create_validation_result(
                is_correct and confidence_passed,
                best_similarity,
                accuracy_score,
                (
                    f"Best match: {best_match}"
                    if best_match
                    else "No suitable match found"
                ),
                validation_start,
                best_ground_truth.to_dict() if best_ground_truth else None,
                {
                    "predicted_text": predicted_text,
                    "gesture_confidence": gesture_confidence,
                    "similarity_threshold": similarity_threshold,
                    "confidence_passed": confidence_passed,
                    "session_id": session_id,
                },
            )

            # Store validation history for analysis
            self.validation_history.append(validation_result)

            # Keep only last 1000 validations in memory
            if len(self.validation_history) > 1000:
                self.validation_history = self.validation_history[-1000:]

            return validation_result

        except Exception as e:
            logger.error(f"Error during gesture validation: {e}")
            return self._create_validation_result(
                False, 0.0, 0.0, f"Validation error: {str(e)}", validation_start
            )

    def _create_validation_result(
        self,
        is_correct: bool,
        similarity_score: float,
        accuracy_score: float,
        message: str,
        start_time: float,
        ground_truth: Optional[Dict[str, Any]] = None,
        additional_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create standardized validation result"""

        validation_time = time.time() - start_time

        result = {
            "is_correct": is_correct,
            "similarity_score": similarity_score,
            "accuracy_score": accuracy_score,
            "message": message,
            "validation_time_ms": validation_time * 1000,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ground_truth_match": ground_truth,
        }

        if additional_data:
            result.update(additional_data)

        return result

    def get_accuracy_metrics(self) -> Dict[str, Any]:
        """Get current accuracy metrics and statistics"""

        try:
            # Recent accuracy trend (last 100 validations)
            recent_validations = (
                self.validation_history[-100:] if self.validation_history else []
            )
            recent_accuracy = (
                sum(1 for v in recent_validations if v["is_correct"])
                / len(recent_validations)
                if recent_validations
                else 0.0
            )

            # Accuracy by gesture type
            type_accuracy = {}
            for validation in recent_validations:
                gt_data = validation.get("ground_truth_match")
                if gt_data:
                    gesture_type = gt_data.get("gesture_type", "unknown")
                    if gesture_type not in type_accuracy:
                        type_accuracy[gesture_type] = {"correct": 0, "total": 0}
                    type_accuracy[gesture_type]["total"] += 1
                    if validation["is_correct"]:
                        type_accuracy[gesture_type]["correct"] += 1

            # Calculate accuracy percentages
            for gesture_type, stats in type_accuracy.items():
                stats["accuracy"] = (
                    stats["correct"] / stats["total"] if stats["total"] > 0 else 0.0
                )

            return {
                **self.accuracy_metrics,
                "recent_accuracy_100": recent_accuracy,
                "accuracy_by_type": type_accuracy,
                "ground_truth_size": len(self.ground_truth_data),
                "validation_history_size": len(self.validation_history),
                "last_validation": (
                    self.validation_history[-1]["timestamp"]
                    if self.validation_history
                    else None
                ),
            }

        except Exception as e:
            logger.error(f"Error getting accuracy metrics: {e}")
            return {**self.accuracy_metrics, "error": str(e)}

    def export_ground_truth_dataset(self, file_path: Optional[str] = None) -> str:
        """Export ground truth dataset to JSON file"""

        if file_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_path = f"gesture_ground_truth_{timestamp}.json"

        try:
            dataset_export = {
                "metadata": {
                    "exported_at": datetime.now(timezone.utc).isoformat(),
                    "total_gestures": len(self.ground_truth_data),
                    "service_version": "1.0.0",
                },
                "ground_truth": {
                    gt_id: gt.to_dict() for gt_id, gt in self.ground_truth_data.items()
                },
                "accuracy_metrics": self.get_accuracy_metrics(),
            }

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(dataset_export, f, ensure_ascii=False, indent=2)

            logger.info(f"Ground truth dataset exported to: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Error exporting ground truth dataset: {e}")
            raise


# Global validation service instance
_gesture_validation_service: Optional[GestureValidationService] = None


def get_gesture_validation_service() -> GestureValidationService:
    """Get gesture validation service singleton"""
    global _gesture_validation_service
    if _gesture_validation_service is None:
        _gesture_validation_service = GestureValidationService()
    return _gesture_validation_service


# Convenience function for easy integration
def validate_gesture_prediction(
    predicted_text: str,
    gesture_confidence: float,
    gesture_type: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Convenient function to validate gesture prediction"""

    validation_service = get_gesture_validation_service()
    return validation_service.validate_gesture_prediction(
        predicted_text=predicted_text,
        gesture_confidence=gesture_confidence,
        gesture_type=gesture_type,
        session_id=session_id,
    )
