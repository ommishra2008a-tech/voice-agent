# VOICE ENGINE BENCHMARK REPORT

**Date:** 2026-08-24  
**Target:** Multi-Model Synthesis Throughput & Latency Profiling  

---

## 1. Workload Latency Scaling

| Script Workload | FastPitch Baseline (ms) | OpenVoice v2 (ms) | XTTS v2 (ms) | CosyVoice (ms) |
|:---|:---:|:---:|:---:|:---:|
| **Short Sentence (12 words)** | 48 ms | 95 ms | 185 ms | 240 ms |
| **Paragraph (45 words)** | 110 ms | 240 ms | 480 ms | 620 ms |
| **Long Script (120 words)** | 260 ms | 580 ms | 1,250 ms | 1,600 ms |

---

## 2. Multi-Language Synthesis RTF

- **English**: 0.015 RTF on FastPitch / 0.058 RTF on XTTS v2
- **Hindi (Devanagari)**: 0.018 RTF on FastPitch / 0.062 RTF on XTTS v2
