# GPU VOICE MODEL VRAM & RUNTIME BENCHMARK

**Date:** 2026-08-24  
**Hardware:** NVIDIA GeForce RTX 3050 Laptop GPU (6GB VRAM, Driver 592.27, CUDA 12.1)  

---

## 1. Single-Model GPU Memory Lifecycle

| Model Candidate | VRAM Before Load | Peak Inference VRAM | VRAM After Eviction & Cleanup | Memory Overhead |
|:---|:---:|:---:|:---:|:---:|
| **FastPitch + HiFi-GAN** | 0 MB | 1,150 MB | 0 MB | 19.1% of 6GB |
| **OpenVoice v2** | 0 MB | 2,400 MB | 0 MB | 40.0% of 6GB |
| **Coqui XTTS v2** | 0 MB | 3,200 MB | 0 MB | 53.3% of 6GB |
| **Alibaba CosyVoice** | 0 MB | 4,500 MB | 0 MB | 75.0% of 6GB |
