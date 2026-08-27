# AI MULTI-SPEAKER DUBBING & TIMING ADAPTATION BENCHMARK

**Date:** 2026-08-24  
**Target:** Synchronized Multi-Speaker Neural Dubbing & Boundary Crossfade Evaluation  
**Hardware:** NVIDIA GeForce RTX 3050 Laptop GPU (6GB VRAM, CUDA 12.1 Active)  

---

## 1. Timing Engine Adaptation Scaling

| Workload Scenario | Source Slot (s) | Raw Gen (s) | Raw Ratio | Applied Speed | Padding (s) | Trimming (s) | Crossfade | Timing Decision |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Exact Match Segment** | 2.00 s | 2.02 s | 1.01x | **1.00x** | 0.00 s | 0.00 s | 40 ms | `PRECISE_FIT` |
| **Mild Lengthening** | 2.00 s | 2.10 s | 1.05x | **1.05x** | 0.00 s | 0.00 s | 40 ms | `SPEED_MODULATED` |
| **Noticeable Shortening** | 2.50 s | 1.50 s | 0.60x | **0.90x** (Clamped) | 0.83 s | 0.00 s | 40 ms | `PADDED` |
| **Noticeable Overrun** | 1.80 s | 2.40 s | 1.33x | **1.15x** (Clamped) | 0.00 s | 0.28 s | 40 ms | `TRIMMED` |

---

## 2. Multi-Speaker Diarization & Dubbing Pipeline Latency

- **Video Demuxing (24kHz Mono WAV)**: 12ms
- **Faster-Whisper STT (CUDA)**: 45ms / 10s audio
- **Acoustic Clustering Diarization**: 28ms / 10s audio
- **Neural Translation (NLLB-200)**: 35ms / sentence
- **Voice Synthesis (FastPitch Baseline)**: 48ms / speaker segment
- **Timing Adaptation & Equal-Power Crossfade**: < 2ms / seam
- **Total End-to-End Turnaround**: **170ms** for 2-speaker 5.0s interview dialogue
