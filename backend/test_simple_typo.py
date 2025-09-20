#!/usr/bin/env python3
"""
Simple test for intelligent pattern analysis method
Testing case: KKTH → KTP HILANG
"""

import re
from typing import Optional


# Mock the minimal required method implementation for testing
class MockService:
    def _is_ktp_like_pattern(self, text: str) -> bool:
        """Check if text looks like a KTP gesture pattern"""

        # Match patterns like: kkth, ktph, ktp, kkap, etc.
        return bool(re.match(r"^k+[a-z]*[tp]*[h]*[a-z]*$", text) and len(text) <= 8)

    def _calculate_similarity(self, s1: str, s2: str) -> float:
        """Calculate enhanced similarity between two strings with gesture pattern awareness"""
        if not s1 or not s2:
            return 0.0

        # Remove spaces for comparison
        s1_clean = s1.replace(" ", "").lower()
        s2_clean = s2.replace(" ", "").lower()

        # Special case for KTP-like patterns
        if self._is_ktp_like_pattern(s1_clean):
            if "ktp" in s2_clean:
                base_score = 0.6  # High base score for KTP matches
                # Bonus for specific type matches
                if "h" in s1_clean and "hilang" in s2_clean:
                    return base_score + 0.3
                elif "b" in s1_clean and "baru" in s2_clean:
                    return base_score + 0.3
                else:
                    return base_score

        # Check character overlap
        common_chars = set(s1_clean) & set(s2_clean)
        total_chars = set(s1_clean) | set(s2_clean)

        if not total_chars:
            return 0.0

        char_similarity = len(common_chars) / len(total_chars)

        # Enhanced sequence similarity with position awareness
        max_len = max(len(s1_clean), len(s2_clean))
        min_len = min(len(s1_clean), len(s2_clean))
        length_penalty = min_len / max_len if max_len > 0 else 0

        # Position-based scoring for similar sequences
        position_score = 0.0
        if min_len >= 2:
            for i in range(min_len):
                if i < len(s1_clean) and i < len(s2_clean):
                    if s1_clean[i] == s2_clean[i]:
                        position_score += 1.0 / min_len

        # Combine scores with weights
        final_score = (
            (char_similarity * 0.5) + (length_penalty * 0.3) + (position_score * 0.2)
        )
        return min(final_score, 1.0)

    def _intelligent_pattern_analysis(self, text: str) -> Optional[str]:
        """Intelligent pattern analysis for gesture-like strings"""
        if len(text) < 3 or len(text) > 12:
            return None

        # Service keywords for pattern matching
        service_patterns = {
            "ktp": ["KTP", "KTP HILANG", "KTP BARU", "KTP RUSAK"],
            "sim": ["SIM", "SIM HILANG", "SIM BARU", "PERPANJANG SIM"],
            "akta": ["AKTA KELAHIRAN", "AKTA KEMATIAN", "AKTA NIKAH"],
            "skck": ["SKCK", "SKCK BARU", "SKCK RUSAK"],
            "paspor": ["PASPOR", "PASPOR BARU", "PASPOR HILANG"],
        }

        # Character similarity analysis
        best_match = None
        best_score = 0.0

        for service, _ in service_patterns.items():
            # Check if text contains key characters from service
            service_chars = set(service)
            text_chars = set(text)
            overlap = len(service_chars & text_chars)

            if overlap >= len(service) * 0.6:  # 60% character overlap
                # Determine specific variation based on additional characters
                if "h" in text or any(h in text for h in ["hlg", "hilang"]):
                    candidate = f"{service.upper()} HILANG"
                elif "b" in text or any(b in text for b in ["br", "baru"]):
                    candidate = f"{service.upper()} BARU"
                elif "r" in text and "s" in text:
                    candidate = f"{service.upper()} RUSAK"
                elif service == "sim" and ("p" in text or "pjg" in text):
                    candidate = f"PERPANJANG {service.upper()}"
                else:
                    candidate = service.upper()

                # Calculate similarity score
                similarity = self._calculate_similarity(
                    text, candidate.lower().replace(" ", "")
                )
                if similarity > best_score and similarity > 0.4:
                    best_score = similarity
                    best_match = candidate

        return best_match if best_score > 0.4 else None


def test_intelligent_pattern_analysis():
    """Test the intelligent pattern analysis method directly"""
    service = MockService()

    # Test cases
    test_cases = [
        ("kkth", "KTP HILANG"),  # Current failing case - key test
        ("ktphjlaoh", "KTP HILANG"),  # Known working case
        ("kktpbakv", "KTP BARU"),  # Known working case
        ("kkap", "KTP"),  # Known working case
        ("ktp", "KTP"),  # Simple case
        ("simh", "SIM HILANG"),  # SIM pattern
        ("paspor", "PASPOR"),  # Passport pattern
        ("ktpb", "KTP BARU"),  # KTP BARU pattern
        ("simb", "SIM BARU"),  # SIM BARU pattern
    ]

    print("🧪 Testing Intelligent Pattern Analysis")
    print("=" * 60)
    print(f"{'Input':12} → {'Expected':15} | {'Result':15} | Status")
    print("-" * 60)

    passed = 0
    total = len(test_cases)

    for input_text, expected in test_cases:
        result = service._intelligent_pattern_analysis(input_text)
        is_pass = result == expected
        status = "✅ PASS" if is_pass else "❌ FAIL"

        if is_pass:
            passed += 1

        print(f"{input_text:12} → {expected:15} | {str(result):15} | {status}")

    print("-" * 60)
    print(f"Results: {passed}/{total} passed ({passed/total*100:.1f}%)")
    print("=" * 60)


def test_kkth_detailed_analysis():
    """Detailed analysis of the KKTH case"""
    service = MockService()
    test_text = "kkth"

    print(f"\n🔍 Detailed Analysis for '{test_text}':")
    print("=" * 50)

    # Service patterns to check
    service_patterns = {
        "ktp": ["KTP", "KTP HILANG", "KTP BARU", "KTP RUSAK"],
        "sim": ["SIM", "SIM HILANG", "SIM BARU", "PERPANJANG SIM"],
    }

    for service_name, variations in service_patterns.items():
        print(f"\n📋 Analyzing service: {service_name}")

        service_chars = set(service_name)
        text_chars = set(test_text)
        overlap = len(service_chars & text_chars)
        overlap_percentage = overlap / len(service_name) if len(service_name) > 0 else 0

        print(f"  Service chars: {sorted(service_chars)}")
        print(f"  Text chars: {sorted(text_chars)}")
        print(
            f"  Overlap: {sorted(service_chars & text_chars)} ({overlap}/{len(service_name)} = {overlap_percentage:.1%})"
        )

        if overlap_percentage >= 0.6:  # 60% threshold
            print("  ✅ Meets 60% threshold!")

            # Check for pattern indicators
            if "h" in test_text:
                candidate = f"{service_name.upper()} HILANG"
                print(f"  🎯 Found 'h' → suggesting {candidate}")

                # Calculate similarity
                similarity = service._calculate_similarity(
                    test_text, candidate.lower().replace(" ", "")
                )
                print(
                    f"  📊 Similarity with '{candidate.lower().replace(' ', '')}': {similarity:.3f}"
                )

                if similarity > 0.4:
                    print(f"  ✅ Above 0.4 threshold → Final result: {candidate}")
                else:
                    print("  ❌ Below 0.4 threshold")
            else:
                print("  ℹ️  No pattern indicators found")
        else:
            print("  ❌ Below 60% threshold")

    # Test final result
    final_result = service._intelligent_pattern_analysis(test_text)
    print(f"\n🎯 Final Analysis Result: '{test_text}' → '{final_result}'")
    expected = "KTP HILANG"
    success = final_result == expected
    print(f"Expected: '{expected}' | {'✅ SUCCESS' if success else '❌ FAILED'}")


if __name__ == "__main__":
    test_intelligent_pattern_analysis()
    test_kkth_detailed_analysis()
