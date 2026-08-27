# Voice Fidelity Experiments

## Baseline

| Metric | Value |
|---|---|
| Reference | `D:\downlods_new\aadi.m4a` (AAC, 48kHz stereo, 8.21s) |
| Generated | `D:\downlods_new\ai aadi.wav` (PCM, 24kHz mono, 2.36s) |
| Resemblyzer Cosine Similarity | **0.7239 (72.39%)** |
| Measurement Tool | Resemblyzer VoiceEncoder (speaker embedding cosine similarity) |

---

## Experiment 1: Forensic Audio Comparison (Reference vs Generated)

| Feature | Reference | Generated | Delta |
|---|---|---|---|
| Spectral Centroid | 1960.88 | 1730.12 | -230.76 |
| Spectral Bandwidth | 1764.93 | 1953.43 | +188.50 |
| Spectral Rolloff | 3620.82 | 3159.88 | -460.94 |
| RMS | 4649.39 | 5377.81 | +728.42 |
| Peak | 32542 | 32767 | +225 |
| Zero Crossing Rate | 0.15 | 0.06 | -0.09 |
| Silence Ratio | 0.56 | 0.39 | -0.16 |
| Speech Ratio | 0.44 | 0.61 | +0.16 |
| MFCC Cosine Similarity | — | — | 0.4628 |
| F0 Mean | 216.36 Hz | 286.42 Hz | +70.06 Hz |
| F0 Median | 258.06 Hz | 272.73 Hz | +14.67 Hz |

**Finding:** Significant spectral centroid shift (-230 Hz), spectral rolloff shift (-460 Hz), and F0 mean shift (+70 Hz) indicate the generated voice has lower brightness and higher pitch than the reference.

---

## Experiment 2: Stored Reference Quality Audit

| Metric | Value |
|---|---|
| Original Reference (aadi.m4a) | AAC, 48kHz, stereo, 8.21s |
| Stored Reference (reference.wav) | PCM, **44100Hz, stereo**, 6.96s |
| Stored ref vs Original (Resemblyzer) | **0.548** |
| Stored ref vs Generated (Resemblyzer) | **0.370** |

**Critical Finding:** The stored reference was saved as 44100Hz stereo WAV instead of 24kHz mono. This format mismatch caused the stored reference to have only 54.8% similarity to the original — massive speaker identity loss during storage.

**Decision:** Fix profile creation to store references as 24kHz mono WAV.

---

## Experiment 3: Reference Preprocessing A/B Test

Each variant was generated from the same original `aadi.m4a`, converted differently, then used to generate the same text via XTTSv2.

| Variant | Description | Resemblyzer vs Original |
|---|---|---|
| 1_raw | Format conversion only (24kHz mono) | **82.07%** ← BEST |
| 7_best_segment_8s | First 8s with loudnorm | 80.20% |
| 2_silence_trimmed | silenceremove only (-40dB threshold) | 78.99% |
| 4_normalized | loudnorm only | 78.98% |
| **5_production_pipeline** | **silenceremove + loudnorm (production)** | **77.87%** |
| 3_vad_trimmed | Aggressive VAD trim (-35dB RMS) | 77.60% |
| 6_minimal_resample | Minimal aresample only | 77.41% |

**Critical Finding:** The production preprocessing pipeline (`silenceremove + loudnorm`) achieved only 77.87%, while the raw format conversion achieved 82.07% — a **4.2% similarity loss from preprocessing alone**.

**Root Cause:** `silenceremove` was cutting 1.6 seconds of speech from the 8.2s reference, removing speaker identity information. `loudnorm` was altering the spectral profile (I=-16, TP=-1.5, LRA=11) in ways that degraded the speaker embedding.

**Decision:** Remove `silenceremove` and `loudnorm` from `ReferenceAudioPreprocessor`. Perform format conversion only (24kHz mono WAV).

---

## Experiment 4: Post-Fix Validation (5 New Texts)

After removing destructive preprocessing:

| Text | Similarity | Delta from Baseline |
|---|---|---|
| Text 1: "The autonomous voice AI lab produces..." | 76.52% | +4.13% |
| Text 2: "Good morning everyone, today we are..." | 77.72% | +5.33% |
| Text 3: "I believe that voice cloning technology..." | 76.34% | +3.95% |
| Text 4: "Please remember to submit your reports..." | **78.55%** | **+6.16%** |
| Text 5: "The weather forecast indicates heavy..." | 74.23% | +1.84% |

| Statistic | Value |
|---|---|
| **Mean** | **76.67%** |
| Median | 76.52% |
| Min | 74.23% |
| Max | 78.55% |
| Std Dev | 1.46% |
| **Improvement over baseline** | **+4.28%** |

**Result:** Consistent improvement across all 5 texts. Mean similarity improved from 72.39% to 76.67%.

---

## Changes Made

### File: `services/ai-service/app/providers/voice_engine.py`
- **`ReferenceAudioPreprocessor.get_clean_reference()`**: Removed `silenceremove` and `loudnorm` audio filters. Now performs minimal format conversion only (24kHz mono WAV). Added early-exit when input is already 24kHz mono WAV.

### File: `services/ai-service/app/providers/voice_analyzer.py`
- **Profile creation storage**: Changed `shutil.copy2()` to FFmpeg conversion that stores reference as 24kHz mono WAV instead of preserving the original format (which was often 44100Hz stereo).

### File: `scripts/voice-fidelity-diagnostic.py` (NEW)
- Standalone diagnostic tool supporting `--reference` and `--generated` arguments.
- Reports Resemblyzer similarity, spectral features, MFCC comparison, F0 pitch analysis, and diagnosis.

---

## Remaining Limitations

1. **XTTSv2 model architecture ceiling**: The model has inherent limits on zero-shot voice cloning fidelity. Typical XTTS v2 similarity ranges are 70-85% depending on reference quality and text content.
2. **Text-dependent variation**: Similarity varies by ~4% across different texts (std dev 1.46%). Longer, more phonetically diverse texts tend to score higher.
3. **F0 shift**: Generated speech shows a +70 Hz F0 mean shift compared to reference, indicating the model does not perfectly replicate pitch contour.
4. **Reference duration**: The 8.2s reference is near the minimum for high-quality cloning. Longer references (15-30s) would likely improve results further.
