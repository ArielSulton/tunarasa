#!/usr/bin/env python3
"""
Test script for the enhanced dynamic RAG typo correction system
Testing case: KKTH → KTP HILANG
"""

import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "app"))

from services.langchain_service import EnhancedLangChainService


def test_intelligent_pattern_analysis():
    """Test the intelligent pattern analysis method directly"""
    service = EnhancedLangChainService()

    # Test cases
    test_cases = [
        ("kkth", "KTP HILANG"),  # Current failing case
        ("ktphjlaoh", "KTP HILANG"),  # Known working case
        ("kktpbakv", "KTP BARU"),  # Known working case
        ("kkap", "KTP"),  # Known working case
        ("ktp", "KTP"),  # Simple case
        ("simh", "SIM HILANG"),  # SIM pattern
        ("paspor", "PASPOR"),  # Passport pattern
    ]

    print("🧪 Testing Intelligent Pattern Analysis")
    print("=" * 50)

    for input_text, expected in test_cases:
        result = service._intelligent_pattern_analysis(input_text)
        status = "✅ PASS" if result == expected else f"❌ FAIL (got: {result})"
        print(f"{input_text:12} → {expected:15} | {status}")

    print("\n" + "=" * 50)


def test_character_overlap_analysis():
    """Test the character overlap logic for KKTH case specifically"""
    service = EnhancedLangChainService()

    test_text = "kkth"
    print(f"\n🔍 Detailed Analysis for '{test_text}':")
    print("=" * 40)

    # Simulate the analysis logic
    service_patterns = {
        "ktp": ["KTP", "KTP HILANG", "KTP BARU", "KTP RUSAK"],
        "sim": ["SIM", "SIM HILANG", "SIM BARU", "PERPANJANG SIM"],
    }

    for service, variations in service_patterns.items():
        service_chars = set(service)
        text_chars = set(test_text)
        overlap = len(service_chars & text_chars)
        overlap_percentage = overlap / len(service) if len(service) > 0 else 0

        print(f"Service: {service}")
        print(f"  Service chars: {service_chars}")
        print(f"  Text chars: {text_chars}")
        print(
            f"  Overlap: {service_chars & text_chars} ({overlap}/{len(service)} = {overlap_percentage:.1%})"
        )

        if overlap_percentage >= 0.6:  # 60% threshold
            print("  ✅ Meets 60% threshold - Analyzing variations...")

            # Check for 'h' indicating HILANG
            if "h" in test_text:
                candidate = f"{service.upper()} HILANG"
                print(f"  🎯 Found 'h' → {candidate}")

                # Calculate similarity
                similarity = service._calculate_similarity(
                    test_text, candidate.lower().replace(" ", "")
                )
                print(f"  📊 Similarity score: {similarity:.2f}")

                if similarity > 0.4:
                    print(f"  ✅ Final result: {candidate}")
                else:
                    print("  ❌ Below 0.4 threshold")
            else:
                print(f"  ℹ️  No 'h' found - default to {service.upper()}")
        else:
            print("  ❌ Below 60% threshold")
        print()


if __name__ == "__main__":
    test_intelligent_pattern_analysis()
    test_character_overlap_analysis()
