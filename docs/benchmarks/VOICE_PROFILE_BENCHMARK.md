# VOICE PROFILE GENERATION BENCHMARK

**Date:** 2026-08-23  
**Target:** Multi-Dimensional Voice Profile Engine  
**Hardware & Subsystem:** Resemblyzer D-Vector (256-D), F0 Autocorrelation Tracker, Spectral Moments, Prosody & Quality Gate  

---

## 1. Execution Latency Across Reference Audio Durations

| Reference Duration | Embedding Extraction (ms) | Acoustic & F0 Analysis (ms) | Prosody & Style (ms) | Quality Gate (ms) | Total Processing (ms) | Quality Score | Gate Result |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **10.0s** | 8ms | 18ms | 14ms | 12ms | 52ms | 99.8 / 100 | ✅ PASSED |
| **30.0s** | 10ms | 16ms | 12ms | 9ms | 47ms | 99.8 / 100 | ✅ PASSED |
| **60.0s** | 9ms | 14ms | 10ms | 5ms | 38ms | 99.8 / 100 | ✅ PASSED |

---

## 2. Hardware Resource Telemetry

- **Device**: CPU / CUDA GPU Protected Budget
- **VRAM Allocation Strategy**: Single-heavy-model-at-a-time via `ModelManager` (0 MB baseline overhead)
- **RAM Memory Footprint**: ~160 MB
- **Throughput Rate**: > 200 profiles / minute
