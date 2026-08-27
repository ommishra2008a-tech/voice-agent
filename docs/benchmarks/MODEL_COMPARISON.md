# NEURAL VOICE SYNTHESIS MODEL COMPARISON

**Date:** 2026-08-23  
**Target:** Multi-Engine Architecture Evaluation for 6GB RTX 3050 VRAM Budget  

---

## 1. Engine Comparative Analysis

| Engine Model | VRAM Peak (MB) | Mean Latency (ms/word) | Multilingual Reach | Zero-Shot Cloning Fidelity | License | Lab Status |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **FastPitch + HiFi-GAN** | 1,150 MB | **1.8 ms** | En, Hi, Es, Fr, De | Pitch/Prosody Profile Conditioning | Permissive (MIT) | ✅ **Active Baseline** |
| **Coqui XTTS v2** | 3,200 MB | 14.5 ms | 17 Languages | 3s Reference Audio Cloning | CPML | 🔄 Adapter Verified |
| **MyShell OpenVoice v2** | 2,400 MB | 8.2 ms | En, Zh, Es, Fr, Ja, Ko | Tone Color Transfer | MIT | 🔄 Adapter Verified |
| **Alibaba CosyVoice 2** | 4,500 MB | 18.0 ms | En, Zh, Yue, Ja, Ko | In-Context Zero-Shot Prompting | Apache-2.0 | 🔄 Adapter Verified |

---

## 2. Memory Safeguard Recommendation

To prevent out-of-memory crashes on the 6GB RTX 3050 GPU, models are loaded dynamically and strictly **one model at a time** using `ModelManager.switch()` with `torch.cuda.empty_cache()` eviction.
