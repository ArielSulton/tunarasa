"""
LLM Recommendation Service dengan Cosine Similarity
Memberikan rekomendasi untuk meningkatkan kualitas respons LLM berdasarkan analisis similarity
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import numpy as np
import redis
from app.core.config import settings

# Sklearn untuk cosine similarity
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


class RecommendationType(Enum):
    """Jenis rekomendasi LLM"""

    CONTENT_IMPROVEMENT = "content_improvement"
    RESPONSE_LENGTH = "response_length"
    ACCURACY_BOOST = "accuracy_boost"
    CONTEXT_UTILIZATION = "context_utilization"
    LANGUAGE_CLARITY = "language_clarity"
    ANSWER_COMPLETENESS = "answer_completeness"


class PriorityLevel(Enum):
    """Level prioritas rekomendasi"""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class QAExample:
    """Contoh Q&A untuk analisis"""

    question: str
    answer: str
    context: str
    confidence: float
    response_time: float
    user_feedback: Optional[str] = None
    timestamp: datetime = None
    session_id: str = ""

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


@dataclass
class LLMRecommendation:
    """Rekomendasi untuk meningkatkan LLM"""

    type: RecommendationType
    title: str
    description: str
    priority: PriorityLevel
    confidence: float
    evidence: List[str]
    suggested_actions: List[str]
    expected_improvement: float
    category_affected: str
    examples: List[Dict[str, Any]]
    implementation_effort: str  # "low", "medium", "high"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "title": self.title,
            "description": self.description,
            "priority": self.priority.value,
            "confidence": self.confidence,
            "evidence": self.evidence,
            "suggested_actions": self.suggested_actions,
            "expected_improvement": self.expected_improvement,
            "category_affected": self.category_affected,
            "examples": self.examples,
            "implementation_effort": self.implementation_effort,
        }


class LLMQualityAnalyzer:
    """Analyzer untuk menilai kualitas respons LLM"""

    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=1000, stop_words="english", ngram_range=(1, 2)
        )
        self.high_quality_examples = []
        self.low_quality_examples = []
        self.is_trained = False

    async def analyze_response_quality(self, qa_example: QAExample) -> Dict[str, float]:
        """Analisis kualitas respons dengan berbagai metrik"""
        try:
            metrics = {}

            # 1. Content Length Analysis
            metrics["length_score"] = self._analyze_length(qa_example)

            # 2. Context Utilization
            metrics["context_utilization"] = self._analyze_context_usage(qa_example)

            # 3. Answer Completeness
            metrics["completeness_score"] = self._analyze_completeness(qa_example)

            # 4. Language Clarity
            metrics["clarity_score"] = self._analyze_clarity(qa_example)

            # 5. Question-Answer Relevance
            metrics["relevance_score"] = self._analyze_relevance(qa_example)

            # 6. Response Time Efficiency
            metrics["efficiency_score"] = self._analyze_efficiency(qa_example)

            # Overall quality score
            weights = {
                "relevance_score": 0.25,
                "completeness_score": 0.20,
                "clarity_score": 0.20,
                "context_utilization": 0.15,
                "length_score": 0.10,
                "efficiency_score": 0.10,
            }

            overall_score = sum(metrics[key] * weights[key] for key in weights)
            metrics["overall_quality"] = overall_score

            return metrics

        except Exception as e:
            logger.error(f"Quality analysis failed: {e}")
            return {"overall_quality": 0.5, "error": str(e)}

    def _analyze_length(self, qa_example: QAExample) -> float:
        """Analisis panjang respons yang optimal"""
        answer_length = len(qa_example.answer.split())
        question_length = len(qa_example.question.split())

        # Ideal ratio: respons 3-8x lebih panjang dari pertanyaan
        ratio = answer_length / max(question_length, 1)

        if 3 <= ratio <= 8:
            return 1.0
        elif 2 <= ratio < 3 or 8 < ratio <= 12:
            return 0.8
        elif 1 <= ratio < 2 or 12 < ratio <= 20:
            return 0.6
        else:
            return 0.3

    def _analyze_context_usage(self, qa_example: QAExample) -> float:
        """Analisis penggunaan konteks"""
        if not qa_example.context:
            return 0.5

        try:
            # Vectorize context dan answer
            texts = [qa_example.context, qa_example.answer]
            tfidf_matrix = self.vectorizer.fit_transform(texts)

            # Hitung similarity
            similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]

            # Normalisasi: similarity 0.3-0.7 dianggap optimal
            if 0.3 <= similarity <= 0.7:
                return 1.0
            elif 0.2 <= similarity < 0.3 or 0.7 < similarity <= 0.8:
                return 0.8
            elif 0.1 <= similarity < 0.2 or 0.8 < similarity <= 0.9:
                return 0.6
            else:
                return 0.3

        except Exception:
            return 0.5

    def _analyze_completeness(self, qa_example: QAExample) -> float:
        """Analisis kelengkapan jawaban"""
        answer = qa_example.answer.lower()
        question = qa_example.question.lower()

        # Indicator kelengkapan
        completeness_indicators = [
            len(answer) > 50,  # Minimal 50 karakter
            "." in answer,  # Ada tanda titik
            "karena" in answer
            or "because" in answer
            or "sebab" in answer,  # Ada penjelasan
            "yaitu" in answer or "adalah" in answer or "is" in answer,  # Ada definisi
            len(answer.split()) >= 10,  # Minimal 10 kata
        ]

        # Question words yang membutuhkan detail
        detail_questions = ["bagaimana", "mengapa", "kenapa", "how", "why", "what"]
        needs_detail = any(word in question for word in detail_questions)

        if needs_detail:
            # Butuh jawaban lebih detail
            completeness_indicators.extend(
                [
                    len(answer.split()) >= 20,  # Minimal 20 kata untuk detail
                    answer.count(".") >= 2,  # Minimal 2 kalimat
                ]
            )

        score = sum(completeness_indicators) / len(completeness_indicators)
        return min(score, 1.0)

    def _analyze_clarity(self, qa_example: QAExample) -> float:
        """Analisis kejelasan bahasa"""
        answer = qa_example.answer

        # Indikator kejelasan
        clarity_indicators = []

        # 1. Panjang kalimat tidak terlalu panjang
        sentences = answer.split(".")
        avg_sentence_length = np.mean([len(s.split()) for s in sentences if s.strip()])
        clarity_indicators.append(1.0 if 10 <= avg_sentence_length <= 25 else 0.5)

        # 2. Tidak ada kata berulang berlebihan
        words = answer.lower().split()
        word_freq = {}
        for word in words:
            word_freq[word] = word_freq.get(word, 0) + 1

        max_repetition = max(word_freq.values()) if word_freq else 1
        repetition_score = (
            1.0 if max_repetition <= 3 else max(0.0, 1.0 - (max_repetition - 3) * 0.2)
        )
        clarity_indicators.append(repetition_score)

        # 3. Struktur yang jelas
        structure_words = [
            "pertama",
            "kedua",
            "kemudian",
            "selanjutnya",
            "finally",
            "first",
            "second",
            "then",
        ]
        has_structure = any(word in answer.lower() for word in structure_words)
        clarity_indicators.append(1.0 if has_structure else 0.7)

        return np.mean(clarity_indicators)

    def _analyze_relevance(self, qa_example: QAExample) -> float:
        """Analisis relevansi jawaban terhadap pertanyaan"""
        try:
            # Vectorize question dan answer
            texts = [qa_example.question, qa_example.answer]
            tfidf_matrix = self.vectorizer.fit_transform(texts)

            # Hitung similarity
            similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]

            # Normalisasi untuk relevansi (similarity tinggi = relevan)
            return min(similarity * 1.5, 1.0)  # Boost similarity score

        except Exception:
            # Fallback: analisis kata kunci
            question_words = set(qa_example.question.lower().split())
            answer_words = set(qa_example.answer.lower().split())

            common_words = question_words.intersection(answer_words)
            relevance = len(common_words) / max(len(question_words), 1)

            return min(relevance * 2, 1.0)

    def _analyze_efficiency(self, qa_example: QAExample) -> float:
        """Analisis efisiensi waktu respons"""
        response_time = qa_example.response_time

        # Target: < 3 detik optimal, < 5 detik baik, < 10 detik acceptable
        if response_time <= 3.0:
            return 1.0
        elif response_time <= 5.0:
            return 0.8
        elif response_time <= 10.0:
            return 0.6
        else:
            return max(0.2, 1.0 - (response_time - 10) * 0.05)


class LLMRecommendationService:
    """Service untuk memberikan rekomendasi peningkatan LLM"""

    def __init__(self):
        self.analyzer = LLMQualityAnalyzer()
        self.redis_client = None
        self.qa_history = []
        self.recommendations_cache = {}
        self._initialize_redis()

        # Template rekomendasi
        self.recommendation_templates = self._load_recommendation_templates()

    def _initialize_redis(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.from_url(settings.REDIS_URL)
            self.redis_client.ping()
            logger.info("Redis connected for LLM recommendation service")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            self.redis_client = None

    def _load_recommendation_templates(self) -> Dict[str, Dict]:
        """Load template rekomendasi"""
        return {
            "short_response": {
                "type": RecommendationType.RESPONSE_LENGTH,
                "title": "Tingkatkan Panjang Respons",
                "description": "Respons terlalu singkat untuk menjawab pertanyaan dengan lengkap",
                "priority": PriorityLevel.MEDIUM,
                "suggested_actions": [
                    "Tambahkan penjelasan detail untuk setiap poin utama",
                    "Berikan contoh konkret untuk memperjelas jawaban",
                    "Sertakan langkah-langkah atau proses jika relevan",
                ],
                "category_affected": "completeness",
            },
            "low_context_usage": {
                "type": RecommendationType.CONTEXT_UTILIZATION,
                "title": "Optimalisasi Penggunaan Konteks",
                "description": "Konteks dokumen tidak dimanfaatkan secara optimal dalam respons",
                "priority": PriorityLevel.HIGH,
                "suggested_actions": [
                    "Rujuk lebih banyak informasi dari dokumen konteks",
                    "Pastikan jawaban selaras dengan sumber yang tersedia",
                    "Gunakan informasi spesifik dari dokumen untuk mendukung jawaban",
                ],
                "category_affected": "faithfulness",
            },
            "unclear_language": {
                "type": RecommendationType.LANGUAGE_CLARITY,
                "title": "Perbaiki Kejelasan Bahasa",
                "description": "Respons menggunakan bahasa yang kurang jelas atau berbelit-belit",
                "priority": PriorityLevel.MEDIUM,
                "suggested_actions": [
                    "Gunakan kalimat yang lebih pendek dan langsung",
                    "Hindari pengulangan kata yang tidak perlu",
                    "Strukturkan jawaban dengan poin-poin yang jelas",
                ],
                "category_affected": "clarity",
            },
            "slow_response": {
                "type": RecommendationType.ACCURACY_BOOST,
                "title": "Optimalisasi Kecepatan Respons",
                "description": "Waktu respons terlalu lambat, mempengaruhi pengalaman pengguna",
                "priority": PriorityLevel.HIGH,
                "suggested_actions": [
                    "Optimalisasi retrieval dokumen untuk mengurangi latensi",
                    "Pertimbangkan caching untuk pertanyaan yang sering ditanyakan",
                    "Gunakan model yang lebih efisien untuk kasus sederhana",
                ],
                "category_affected": "performance",
            },
            "incomplete_answer": {
                "type": RecommendationType.ANSWER_COMPLETENESS,
                "title": "Lengkapi Jawaban",
                "description": "Jawaban tidak menjawab semua aspek dari pertanyaan",
                "priority": PriorityLevel.HIGH,
                "suggested_actions": [
                    "Analisis ulang pertanyaan untuk memastikan semua aspek terjawab",
                    "Berikan penjelasan yang komprehensif untuk setiap bagian pertanyaan",
                    "Tambahkan informasi pendukung yang relevan",
                ],
                "category_affected": "completeness",
            },
        }

    async def analyze_qa_batch(
        self, qa_examples: List[QAExample]
    ) -> List[LLMRecommendation]:
        """Analisis batch Q&A dan generate rekomendasi"""
        try:
            # Simpan ke history
            self.qa_history.extend(qa_examples)

            # Analisis kualitas setiap Q&A
            quality_analyses = []
            for qa in qa_examples:
                quality = await self.analyzer.analyze_response_quality(qa)
                quality_analyses.append({"qa": qa, "quality": quality})

            # Generate rekomendasi berdasarkan pola
            recommendations = await self._generate_recommendations(quality_analyses)

            # Cache hasil
            await self._cache_recommendations(recommendations)

            return recommendations

        except Exception as e:
            logger.error(f"QA batch analysis failed: {e}")
            return []

    async def _generate_recommendations(
        self, quality_analyses: List[Dict]
    ) -> List[LLMRecommendation]:
        """Generate rekomendasi berdasarkan analisis kualitas"""
        recommendations = []

        # Analisis pola umum
        overall_metrics = self._calculate_overall_metrics(quality_analyses)

        # 1. Rekomendasi berdasarkan response length
        if overall_metrics["avg_length_score"] < 0.6:
            recommendations.append(self._create_length_recommendation(quality_analyses))

        # 2. Rekomendasi berdasarkan context utilization
        if overall_metrics["avg_context_utilization"] < 0.7:
            recommendations.append(
                self._create_context_recommendation(quality_analyses)
            )

        # 3. Rekomendasi berdasarkan clarity
        if overall_metrics["avg_clarity_score"] < 0.7:
            recommendations.append(
                self._create_clarity_recommendation(quality_analyses)
            )

        # 4. Rekomendasi berdasarkan response time
        if overall_metrics["avg_efficiency_score"] < 0.8:
            recommendations.append(
                self._create_efficiency_recommendation(quality_analyses)
            )

        # 5. Rekomendasi berdasarkan completeness
        if overall_metrics["avg_completeness_score"] < 0.7:
            recommendations.append(
                self._create_completeness_recommendation(quality_analyses)
            )

        # Filter dan ranking rekomendasi
        valid_recommendations = [r for r in recommendations if r is not None]
        return sorted(
            valid_recommendations, key=lambda x: (x.priority.value, -x.confidence)
        )

    def _calculate_overall_metrics(
        self, quality_analyses: List[Dict]
    ) -> Dict[str, float]:
        """Hitung metrik keseluruhan"""
        if not quality_analyses:
            return {}

        metrics = {}
        metric_keys = [
            "length_score",
            "context_utilization",
            "completeness_score",
            "clarity_score",
            "relevance_score",
            "efficiency_score",
            "overall_quality",
        ]

        for key in metric_keys:
            values = [qa["quality"].get(key, 0) for qa in quality_analyses]
            metrics[f"avg_{key}"] = np.mean(values) if values else 0
            metrics[f"min_{key}"] = np.min(values) if values else 0
            metrics[f"max_{key}"] = np.max(values) if values else 0

        return metrics

    def _create_length_recommendation(
        self, quality_analyses: List[Dict]
    ) -> Optional[LLMRecommendation]:
        """Buat rekomendasi untuk panjang respons"""
        template = self.recommendation_templates["short_response"]

        # Analisis detail
        short_responses = [
            qa for qa in quality_analyses if qa["quality"]["length_score"] < 0.6
        ]

        if not short_responses:
            return None

        confidence = len(short_responses) / len(quality_analyses)

        # Contoh respons yang terlalu pendek
        examples = []
        for qa in short_responses[:3]:
            examples.append(
                {
                    "question": qa["qa"].question[:100] + "...",
                    "answer_length": len(qa["qa"].answer.split()),
                    "score": qa["quality"]["length_score"],
                }
            )

        evidence = [
            f"{len(short_responses)} dari {len(quality_analyses)} respons terlalu pendek",
            f"Rata-rata skor panjang: {np.mean([qa['quality']['length_score'] for qa in quality_analyses]):.2f}",
            "Respons pendek mengurangi kelengkapan informasi",
        ]

        return LLMRecommendation(
            type=RecommendationType.RESPONSE_LENGTH,
            title=template["title"],
            description=template["description"],
            priority=PriorityLevel.MEDIUM,
            confidence=confidence,
            evidence=evidence,
            suggested_actions=template["suggested_actions"],
            expected_improvement=0.15,
            category_affected=template["category_affected"],
            examples=examples,
            implementation_effort="medium",
        )

    def _create_context_recommendation(
        self, quality_analyses: List[Dict]
    ) -> Optional[LLMRecommendation]:
        """Buat rekomendasi untuk penggunaan konteks"""
        template = self.recommendation_templates["low_context_usage"]

        poor_context_usage = [
            qa for qa in quality_analyses if qa["quality"]["context_utilization"] < 0.7
        ]

        if not poor_context_usage:
            return None

        confidence = len(poor_context_usage) / len(quality_analyses)

        examples = []
        for qa in poor_context_usage[:3]:
            examples.append(
                {
                    "question": qa["qa"].question[:100] + "...",
                    "context_utilization": qa["quality"]["context_utilization"],
                    "has_context": bool(qa["qa"].context),
                }
            )

        evidence = [
            f"{len(poor_context_usage)} respons tidak memanfaatkan konteks dengan baik",
            f"Rata-rata skor context utilization: {np.mean([qa['quality']['context_utilization'] for qa in quality_analyses]):.2f}",
            "Konteks yang tidak digunakan mengurangi akurasi jawaban",
        ]

        return LLMRecommendation(
            type=RecommendationType.CONTEXT_UTILIZATION,
            title=template["title"],
            description=template["description"],
            priority=PriorityLevel.HIGH,
            confidence=confidence,
            evidence=evidence,
            suggested_actions=template["suggested_actions"],
            expected_improvement=0.25,
            category_affected=template["category_affected"],
            examples=examples,
            implementation_effort="high",
        )

    def _create_clarity_recommendation(
        self, quality_analyses: List[Dict]
    ) -> Optional[LLMRecommendation]:
        """Buat rekomendasi untuk kejelasan bahasa"""
        template = self.recommendation_templates["unclear_language"]

        unclear_responses = [
            qa for qa in quality_analyses if qa["quality"]["clarity_score"] < 0.7
        ]

        if not unclear_responses:
            return None

        confidence = len(unclear_responses) / len(quality_analyses)

        examples = []
        for qa in unclear_responses[:3]:
            examples.append(
                {
                    "question": qa["qa"].question[:100] + "...",
                    "clarity_score": qa["quality"]["clarity_score"],
                    "answer_preview": qa["qa"].answer[:150] + "...",
                }
            )

        evidence = [
            f"{len(unclear_responses)} respons memiliki kejelasan bahasa yang kurang",
            f"Rata-rata skor clarity: {np.mean([qa['quality']['clarity_score'] for qa in quality_analyses]):.2f}",
            "Bahasa yang tidak jelas mempengaruhi pemahaman pengguna",
        ]

        return LLMRecommendation(
            type=RecommendationType.LANGUAGE_CLARITY,
            title=template["title"],
            description=template["description"],
            priority=PriorityLevel.MEDIUM,
            confidence=confidence,
            evidence=evidence,
            suggested_actions=template["suggested_actions"],
            expected_improvement=0.20,
            category_affected=template["category_affected"],
            examples=examples,
            implementation_effort="medium",
        )

    def _create_efficiency_recommendation(
        self, quality_analyses: List[Dict]
    ) -> Optional[LLMRecommendation]:
        """Buat rekomendasi untuk efisiensi respons"""
        template = self.recommendation_templates["slow_response"]

        slow_responses = [
            qa for qa in quality_analyses if qa["quality"]["efficiency_score"] < 0.8
        ]

        if not slow_responses:
            return None

        confidence = len(slow_responses) / len(quality_analyses)

        examples = []
        for qa in slow_responses[:3]:
            examples.append(
                {
                    "question": qa["qa"].question[:100] + "...",
                    "response_time": qa["qa"].response_time,
                    "efficiency_score": qa["quality"]["efficiency_score"],
                }
            )

        evidence = [
            f"{len(slow_responses)} respons memiliki waktu yang lambat",
            f"Rata-rata waktu respons: {np.mean([qa['qa'].response_time for qa in quality_analyses]):.2f} detik",
            "Respons lambat mengurangi kepuasan pengguna",
        ]

        return LLMRecommendation(
            type=RecommendationType.ACCURACY_BOOST,
            title=template["title"],
            description=template["description"],
            priority=PriorityLevel.HIGH,
            confidence=confidence,
            evidence=evidence,
            suggested_actions=template["suggested_actions"],
            expected_improvement=0.30,
            category_affected=template["category_affected"],
            examples=examples,
            implementation_effort="high",
        )

    def _create_completeness_recommendation(
        self, quality_analyses: List[Dict]
    ) -> Optional[LLMRecommendation]:
        """Buat rekomendasi untuk kelengkapan jawaban"""
        template = self.recommendation_templates["incomplete_answer"]

        incomplete_responses = [
            qa for qa in quality_analyses if qa["quality"]["completeness_score"] < 0.7
        ]

        if not incomplete_responses:
            return None

        confidence = len(incomplete_responses) / len(quality_analyses)

        examples = []
        for qa in incomplete_responses[:3]:
            examples.append(
                {
                    "question": qa["qa"].question[:100] + "...",
                    "completeness_score": qa["quality"]["completeness_score"],
                    "answer_length": len(qa["qa"].answer.split()),
                }
            )

        evidence = [
            f"{len(incomplete_responses)} jawaban tidak lengkap",
            f"Rata-rata skor completeness: {np.mean([qa['quality']['completeness_score'] for qa in quality_analyses]):.2f}",
            "Jawaban tidak lengkap tidak memenuhi kebutuhan pengguna",
        ]

        return LLMRecommendation(
            type=RecommendationType.ANSWER_COMPLETENESS,
            title=template["title"],
            description=template["description"],
            priority=PriorityLevel.HIGH,
            confidence=confidence,
            evidence=evidence,
            suggested_actions=template["suggested_actions"],
            expected_improvement=0.25,
            category_affected=template["category_affected"],
            examples=examples,
            implementation_effort="medium",
        )

    async def _cache_recommendations(self, recommendations: List[LLMRecommendation]):
        """Cache rekomendasi ke Redis"""
        if not self.redis_client:
            return

        try:
            cache_key = f"llm_recommendations:{datetime.utcnow().strftime('%Y%m%d_%H')}"
            cache_data = {
                "recommendations": [r.to_dict() for r in recommendations],
                "generated_at": datetime.utcnow().isoformat(),
                "total_recommendations": len(recommendations),
            }

            # Cache for 2 hours
            await asyncio.to_thread(
                self.redis_client.setex,
                cache_key,
                2 * 3600,
                json.dumps(cache_data, default=str),
            )

        except Exception as e:
            logger.error(f"Failed to cache recommendations: {e}")

    async def get_recommendations_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Dapatkan ringkasan rekomendasi"""
        try:
            # Filter Q&A dari jam terakhir
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            recent_qa = [qa for qa in self.qa_history if qa.timestamp >= cutoff_time]

            if not recent_qa:
                return {
                    "period_hours": hours,
                    "total_qa_analyzed": 0,
                    "recommendations": [],
                    "message": "Tidak ada data Q&A dalam periode ini",
                }

            # Generate rekomendasi baru
            quality_analyses = []
            for qa in recent_qa:
                quality = await self.analyzer.analyze_response_quality(qa)
                quality_analyses.append({"qa": qa, "quality": quality})

            recommendations = await self._generate_recommendations(quality_analyses)

            # Statistik
            overall_metrics = self._calculate_overall_metrics(quality_analyses)

            return {
                "period_hours": hours,
                "total_qa_analyzed": len(recent_qa),
                "overall_quality_score": overall_metrics.get("avg_overall_quality", 0),
                "recommendations": [r.to_dict() for r in recommendations],
                "key_metrics": {
                    "avg_response_time": np.mean(
                        [qa.response_time for qa in recent_qa]
                    ),
                    "avg_confidence": np.mean([qa.confidence for qa in recent_qa]),
                    "quality_distribution": {
                        "excellent": len(
                            [
                                qa
                                for qa in quality_analyses
                                if qa["quality"]["overall_quality"] >= 0.8
                            ]
                        ),
                        "good": len(
                            [
                                qa
                                for qa in quality_analyses
                                if 0.6 <= qa["quality"]["overall_quality"] < 0.8
                            ]
                        ),
                        "needs_improvement": len(
                            [
                                qa
                                for qa in quality_analyses
                                if qa["quality"]["overall_quality"] < 0.6
                            ]
                        ),
                    },
                },
                "generated_at": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Failed to generate recommendations summary: {e}")
            return {
                "error": str(e),
                "period_hours": hours,
                "generated_at": datetime.utcnow().isoformat(),
            }


# Global service instance
_recommendation_service = None


def get_llm_recommendation_service() -> LLMRecommendationService:
    """Get LLM recommendation service singleton"""
    global _recommendation_service
    if _recommendation_service is None:
        _recommendation_service = LLMRecommendationService()
    return _recommendation_service


# Convenience function
async def analyze_and_recommend(
    questions: List[str],
    answers: List[str],
    contexts: List[str],
    confidences: List[float],
    response_times: List[float],
    session_ids: List[str] = None,
) -> Dict[str, Any]:
    """Convenience function untuk analisis dan rekomendasi"""

    service = get_llm_recommendation_service()

    # Buat QA examples
    qa_examples = []
    for i in range(len(questions)):
        qa = QAExample(
            question=questions[i],
            answer=answers[i],
            context=contexts[i] if i < len(contexts) else "",
            confidence=confidences[i] if i < len(confidences) else 0.5,
            response_time=response_times[i] if i < len(response_times) else 1.0,
            session_id=session_ids[i] if session_ids and i < len(session_ids) else "",
        )
        qa_examples.append(qa)

    # Analisis dan generate rekomendasi
    recommendations = await service.analyze_qa_batch(qa_examples)

    return {
        "success": True,
        "total_analyzed": len(qa_examples),
        "recommendations": [r.to_dict() for r in recommendations],
        "summary": {
            "high_priority": len(
                [r for r in recommendations if r.priority == PriorityLevel.HIGH]
            ),
            "medium_priority": len(
                [r for r in recommendations if r.priority == PriorityLevel.MEDIUM]
            ),
            "low_priority": len(
                [r for r in recommendations if r.priority == PriorityLevel.LOW]
            ),
        },
    }
