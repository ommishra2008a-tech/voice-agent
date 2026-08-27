# INITIAL VOICE ENGINE SELECTION REPORT

**Date:** 2026-08-23  
**Target:** Voice Synthesis Engine Evaluation & Primary Development Engine Selection  
**Hardware Budget Constraint:** RTX 3050 Laptop GPU (6GB VRAM), 15.6 GB RAM  

---

## 1. Candidate Model Evaluation Matrix

| Model Candidate | VRAM Requirement | Latency (RTF) | Multilingual Support | Voice Profile Conditioning | License | Status in Lab |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **FastPitch / Tacotron2 + HiFi-GAN (Baseline Engine)** | < 1.2 GB | **< 0.05 (Fast)** | English, Hindi, Multi | Pitch / Prosody / Energy Contours | MIT / Permissive | ✅ **Default Dev Engine** |
| **XTTSv2 (Coqui / Real-Time Clone)** | ~ 3.2 GB | ~ 0.35 | 17 Languages (En, Hi, Es, Fr, etc.) | 24kHz Audio Reference + Latent Speaker Embedding | CPML (Non-Commercial) | 🔄 Supported Adapter |
| **OpenVoice v2 (MyShell)** | ~ 2.4 GB | ~ 0.20 | En, Zh, Multilingual | Decoupled Timbre & Tone Color Transfer | MIT / Research | 🔄 Supported Adapter |
| **CosyVoice 2 (Alibaba / FunASR)** | ~ 4.5 GB | ~ 0.45 | Multilingual Zero-Shot | Multi-Condition Prompt & In-Context Synthesis | Apache-2.0 | 🔄 Supported Adapter |

---

## 2. Selection Rationale

1. **Primary Development Engine (`FastPitchSynthesizer`)**:
   - Extreme lightweight footprint (< 1.2 GB VRAM) allowing instantaneous loading, testing, and continuous generation without risking CUDA out-of-memory (OOM) errors on the 6GB RTX 3050.
   - Fully controllable pitch, speed, and prosody parameters directly mapped from Phase 4 `VoiceProfile`.
2. **Provider Adapter Abstraction (`VoiceEngine`)**:
   - Wraps all model variants under a unified contract (`VoiceEngine.synthesize()`).
   - Ensures the core Solarch job orchestration and Next.js frontend are completely decoupled from the specific underlying neural weights.
