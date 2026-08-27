# VOICE SIMILARITY BASELINE REPORT

**Date:** 2026-08-23  
**Target:** Voice Profile Identity Comparison & Verification Baseline  
**Evaluation Method:** Cosine Similarity on 256-D L2-Normalized D-Vectors + Multi-Dimensional Acoustic/Pitch/Prosody Composite Scoring  

---

## 1. Measured Similarity Metrics

| Comparison Pair | Cosine Similarity | Pitch Similarity | Timbre Similarity | Prosody Similarity | Composite Score | Speaker Match Decision |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Same-Speaker (Reference vs Self)** | **1.0000** | 1.0000 | 1.0000 | 1.0000 | **1.0000** | ✅ Same Speaker (100% confidence) |
| **Cross-Speaker (Speaker 1 vs Speaker 2)** | **0.0248** | 0.8600 | 0.8300 | 0.8900 | **0.4504** | ❌ Different Speakers (Cosine < 0.75) |

---

## 2. Threshold Calibration Guidelines for Phase 5 (Voice Synthesis)

- **Strict Identity Threshold (Same Speaker)**: `Cosine Similarity >= 0.75` and `Composite Score >= 0.70`
- **Ambiguous / Verification Required**: `0.60 <= Cosine < 0.75`
- **Distinct Speaker / Mismatch**: `Cosine < 0.60`
