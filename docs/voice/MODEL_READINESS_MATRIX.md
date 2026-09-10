# Voice Model Readiness Matrix (Phase 13E Audit)

**Generated:** August 2026  
**Environment:** Windows 11, NVIDIA GeForce RTX 3050 Laptop GPU (6GB VRAM, CUDA 12.1), Python 3.11.6, PyTorch 2.5.1+cu121  
**Audit Status:** Fully Verified & Audited

---

## 1. Executive Summary & Model Matrix

| Model Name | Engine ID | Package Installed | Weights Available | Backend Adapter | Status | Real Inference Verified | Zero-Shot Voice Cloning | Notes / Blockers |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **XTTS v2** | `xtts-v2` | `TTS 0.22.0` | `~1.8GB` (Local AppData) | `XTTSv2Adapter` | **READY** | YES (CUDA GPU) | **YES** | Multi-lingual zero-shot voice cloning with reference audio conditioning. |
| **FastPitch** | `fastpitch-baseline` | `TTS 0.22.0` | `~350MB` (Local AppData) | `FastPitchSynthesizer` | **READY** | YES (CUDA GPU) | **NO** | Single-speaker baseline synthesis (LJSpeech dataset). Rejects non-baseline voice profiles. |
| **OpenVoice v2** | `openvoice-v2` | Not Installed | Missing | `OpenVoiceAdapter` | **UNAVAILABLE** | NO | NO (Blocked) | Package `openvoice` / `se_extractor` and model weights not installed. No silent fallback. |
| **CosyVoice** | `cosyvoice` | Not Installed | Missing | `CosyVoiceAdapter` | **UNAVAILABLE** | NO | NO (Blocked) | Package `cosyvoice` and ~4.5GB checkpoint not installed. Exceeds single-process 6GB VRAM budget. |

---

## 2. Detailed Engine Audits

### 2.1 XTTS v2 (`xtts-v2`)
- **Provider / Architecture:** Coqui TTS / GPT2-based autoregressive acoustic model + HiFi-GAN vocoder.
- **Weights Location:** `C:\Users\HP\AppData\Local\tts\tts_models--multilingual--multi-dataset--xtts_v2`
- **Files Verified:** `model.pth`, `dvae.pth`, `mel_stats.pth`, `speakers_xtts.pth`, `vocab.json`, `config.json`.
- **Runtime Performance:**
  - VRAM Consumption: ~1823 MB loaded, ~1936 MB peak generation.
  - Real-Time Factor (RTF): ~0.86 on RTX 3050.
  - Signal Validation: RMS ~4767.6, Spectral Centroid ~2507 Hz, Faster-Whisper transcription confirmed 100% intelligible.
- **Voice Profile Compatibility:** Fully compatible with user reference audio profiles (e.g. `aadi.m4a` / 24kHz WAV).

### 2.2 FastPitch Baseline (`fastpitch-baseline`)
- **Provider / Architecture:** Coqui TTS FastPitch (FastSpeech variant) + HiFi-GAN v2 vocoder.
- **Weights Location:** `C:\Users\HP\AppData\Local\tts\tts_models--en--ljspeech--fast_pitch` & `vocoder_models--en--ljspeech--hifigan_v2`.
- **Phonemization Fix:** Gruut phonemizer patched with safe tie-bar character replacement (`\u0361`, `\u035c`, IPA ligatures) ensuring 100% vocabulary coverage on Windows.
- **Runtime Performance:**
  - VRAM Consumption: ~427 MB.
  - Real-Time Factor (RTF): ~0.086 on RTX 3050.
  - Signal Validation: RMS ~4644.9, Spectral Centroid ~4335 Hz, clear natural American English baseline speech.
- **Voice Profile Compatibility:** Baseline LJSpeech single speaker only. Blocks custom zero-shot cloning requests with explicit `VOICE_PROFILE_NOT_SUPPORTED_BY_ENGINE` error.

### 2.3 OpenVoice v2 (`openvoice-v2`)
- **Provider / Architecture:** MyShell OpenVoice (Tone Color Converter + Base TTS).
- **Audit Findings:**
  - `openvoice` and `se_extractor` packages are not distributed via standard PyPI and require direct Git compilation and external dependencies (`silero_vad`, `whisper-timestamped`, `wavmark`).
  - Base environment does not contain OpenVoice weights (~500MB checkpoints).
- **Fallback Elimination:** Previous stub that passed requests to XTTS v2 has been removed. Adapter strictly raises `MODEL_UNAVAILABLE` with metadata `silentFallback: False`.

### 2.4 CosyVoice (`cosyvoice`)
- **Provider / Architecture:** Alibaba FunAudioLLM (In-Context Flow Matching TTS).
- **Audit Findings:**
  - Requires `cosyvoice`, `modelscope`, `HyperPyYAML`, `diffusers`, and `onnxruntime-gpu`.
  - Model weights (~2.8GB - 4.5GB) are not downloaded.
  - VRAM Requirement: CosyVoice requires ~4.5GB VRAM. Loading alongside XTTS on a 6GB GPU would trigger CUDA Out-Of-Memory unless strict process isolation or worker execution is implemented.
- **Fallback Elimination:** Previous stub forwarding to XTTS v2 removed. Adapter strictly returns `MODEL_UNAVAILABLE` with metadata `silentFallback: False`.

---

## 3. GPU VRAM & Lifecycle Management

- **Model Residency Policy:** The system enforces a single active neural synthesis model in VRAM at any given time (`ModelManager` singleton).
- **Switching Procedure:**
  1. `model_manager.switch(new_model_key)` is invoked.
  2. Active model reference is detached and deleted from `loaded_models`.
  3. `gc.collect()` and `torch.cuda.empty_cache()` are executed.
  4. New model is initialized and cached.
- **Lifecycle Verification:** Automated test verified switching `XTTS v2 -> FastPitch -> XTTS v2` without memory leaks or VRAM exhaustion.
