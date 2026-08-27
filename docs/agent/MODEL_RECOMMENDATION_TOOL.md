# AGENT MODEL RECOMMENDATION TOOL

**Date:** 2026-08-24  
**Target:** Evidence-Grounded Model Selection Tool for Autonomous Voice AI Agent  

---

## 1. Tool Integration Overview

The Autonomous Voice AI Agent invokes `recommend_voice_model` to provide evidence-backed engine recommendations rather than hardcoded assumptions.

### Example Invocations

1. **User Request**: *"Which engine should I use for interactive real-time dialogue in English and Hindi?"*
   - **Agent Call**: `POST /v1/benchmark/recommend {"priority": "latency", "language": "hi", "max_vram_mb": 6000}`
   - **Result**: `fastpitch-baseline` (48ms latency, 1.15GB VRAM, RTF 0.015).

2. **User Request**: *"Which model provides maximum zero-shot voice cloning fidelity?"*
   - **Agent Call**: `POST /v1/benchmark/recommend {"priority": "similarity", "max_vram_mb": 6000}`
   - **Result**: `xtts-v2` (0.94 similarity, 17 languages, 3.2GB VRAM).
