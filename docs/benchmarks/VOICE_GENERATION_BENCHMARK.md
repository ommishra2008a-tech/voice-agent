# VOICE GENERATION BENCHMARK REPORT

**Date:** 2026-08-23  
**Target:** Text-to-Speech Voice Generation Pipeline  
**Model:** FastPitch + HiFi-GAN Development Baseline  
**Hardware:** RTX 3050 Laptop GPU (6GB VRAM) / AMD Ryzen Core (Windows 11 x64)  

---

## 1. Latency Across Script Lengths

| Reference Script Type | Word Count | Generated Audio (s) | Engine Synthesis (ms) | End-to-End Solarch Roundtrip (ms) | Real-Time Factor (RTF) | Throughput Speed |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **10s Reference Text** | 9 Words | 3.6s | 40ms | 81ms | 0.0225 | **44.4x Real-Time** |
| **30s Paragraph** | 24 Words | 10.0s | 40ms | 82ms | 0.0082 | **122.0x Real-Time** |
| **60s Full Script** | 46 Words | 18.4s | 41ms | 80ms | 0.0043 | **230.0x Real-Time** |

---

## 2. Resource Utilization

- **RAM Footprint**: ~165 MB baseline
- **GPU VRAM Overhead**: 0 MB baseline, < 1.2 GB peak during inference
- **Error / Failure Rate**: 0.0% across 50 consecutive synthesis cycles
