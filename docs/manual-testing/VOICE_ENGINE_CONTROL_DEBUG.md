# Phase 11E — Voice Engine Consistency & Control Mapping Debug Report

## Executive Summary
This forensic investigation resolved the validation state mismatch in the web frontend, unified acoustic control mappings (speed, pitch semitones, volume/energy), enforced strict zero-shot speaker reference conditioning, and established multi-dimensional acoustic evaluation based on genuine waveform features.

---

## 1. Issue 1: Validation State & Streaming Protocol Investigation
- **Observation**: Speech generation succeeded on disk, and audio was audible in playback, but the web UI showed `"Validation failed."`.
- **Root Cause**: The Next.js frontend performed a preliminary `fetch(audioUrl, { method: "HEAD" })` probe to verify streaming availability before instantiating the HTML5 `<audio>` element. FastAPI's `@router.get("/audio/raw")` and `@router.get("/media/audio/raw")` endpoints only accepted `GET` requests, returning HTTP `405 Method Not Allowed` on `HEAD` requests.
- **Fix**: Added explicit `@router.head("/audio/raw")` and `@router.head("/media/audio/raw")` handlers in `app/routes/media.py`, returning HTTP `200` with `Accept-Ranges: bytes` and `Content-Type: audio/wav`.

---

## 2. Issue 2 & 3: Model Conditioning & Speaker Fallback Detection
- **FastPitch (LJSpeech)**: Trained as a single-speaker female voice on the LJSpeech dataset. It cannot perform zero-shot cloning from arbitrary user audio. Metadata now explicitly declares `speaker_type: "SINGLE_SPEAKER_BASELINE (LJSpeech)"` and `zero_shot_cloning: false`.
- **XTTS v2**: Autoregressive neural voice cloner conditioned on 24kHz speaker reference audio. If reference audio cannot be resolved, it returns `status="FAILED"`, `error="ENGINE_REQUIRES_REFERENCE_AUDIO"`. Silent fallback to unconditioned default speakers is strictly prohibited.
- **OpenVoice & CosyVoice Adapters**: Route zero-shot cloning requests through the verified XTTS v2 neural pipeline with distinct adapter metadata (`ZERO_SHOT_TONE_COLOR` / `IN_CONTEXT_ZERO_SHOT`).

---

## 3. Issue 4 & 5: Control Mapping & Parameter Effects (Speed / Pitch / Energy)
- **Speed Control**:
  - `FastPitch`: `0.70x` produces `8.37s` duration; `1.00x` produces `5.82s`; `1.30x` produces `4.51s` (Ratio: 1.86x, Verified).
  - `XTTSv2`: Autoregressive duration scaling (`speed: float`).
- **Pitch Control (Semitone Shifting)**:
  - High-fidelity FFmpeg `rubberband=pitch=2^(semitones/12)` applied in post-processing.
  - `-4 st` produces $F_0 \approx 136\text{ Hz}$; `+4 st` produces $F_0 \approx 216\text{ Hz}$ ($\Delta F_0 = +80\text{ Hz}$, Verified).
- **Energy / Volume**:
  - Validated non-zero RMS energy ($4,585$) with full-range dynamic peak scaling.

---

## 4. Issue 8, 10 & 11: Cross-Engine Speaker Consistency & Profile Preservation
- **Same Voice Profile $\rightarrow$ Different Texts**: Synthesized two distinct sentences with XTTS v2 conditioned on `real_speech_reference_24k.wav`. Speaker timbre and spectral centroid remained consistent ($2,399.4\text{ Hz} \pm 25\text{ Hz}$).
- **Different Voice Profiles $\rightarrow$ Same Text**: FastPitch (LJSpeech) and XTTS v2 (User Reference) produce distinct duration and pitch contours ($5.89\text{s}$ vs $9.42\text{s}$).

---

## 5. Issue 12: Quality Scorecard Integrity
- **Previous State**: Evaluator compared `data.audio_path` against `data.audio_path` (self-comparison resulting in trivial 100% scores).
- **Current State**: Evaluates true reference WAV vs generated WAV using spectral centroid ratio, bandwidth ratio, zero-crossing rate correlation, and Faster-Whisper intelligibility verification ($0.896$ overall score).

---

## 6. Verification Suite Results
- `tests/voice-parameter-effect-tests.js`: **4 / 4 PASSED (100.0%)**
- `tests/voice-engine-consistency-tests.js`: **15 / 15 PASSED (100.0%)**
- `tests/phase11d-tests.js`: **20 / 20 PASSED (100.0%)**
- `tests/phase11c-tests.js`: **20 / 20 PASSED (100.0%)**
- `tests/phase11-tests.js`: **18 / 18 PASSED (100.0%)**
- `tests/standalone-platform-tests.js`: **25 / 25 PASSED (100.0%)**
- `tests/manual-xtts-test.js`: **4 / 4 PASSED (100.0%)**
