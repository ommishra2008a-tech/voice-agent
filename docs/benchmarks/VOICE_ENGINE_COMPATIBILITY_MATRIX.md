# Voice Engine Multi-Model Compatibility & Conditioning Matrix

This matrix documents the actual conditioning, speaker handling, and parameter support across all four integrated voice engines.

| Engine ID | Reference Audio Required? | Speaker Conditioning Mode | Speaker Identity | Supported Languages | Speed Control | Pitch Control | Energy Control | Zero-Shot Cloner? | Operational Status |
|---|---|---|---|---|---|---|---|---|---|
| **`xtts-v2`** | **YES** | Zero-Shot Speaker Embedding (`speaker_wav`) | Dynamically Cloned from Reference WAV | 17 Languages (en, hi, es, fr, de, it, pt, pl, tr, ru, nl, cs, ar, zh, ja, hu, ko) | **YES** (Native) | **YES** (DSP) | **YES** (DSP) | **YES** | **ACTIVE (Default Cloner)** |
| **`fastpitch-baseline`** | **NO** | Single-Speaker Acoustic Prior | Fixed Female Baseline (LJSpeech dataset) | en, hi, es, fr, de | **YES** (DSP/Native) | **YES** (DSP/Native) | **YES** (DSP) | **NO** (Fixed Baseline) | **ACTIVE (Fast Baseline)** |
| **`openvoice-v2`** | **YES** | Zero-Shot Tone Color Transfer | Cloned from Reference WAV | en, zh, es, fr, ja, ko | **YES** (Native) | **YES** (DSP) | **YES** (DSP) | **YES** | **ACTIVE (Adapter Routed)** |
| **`cosyvoice`** | **YES** | In-Context Learning Prompt | Cloned from Reference WAV | en, zh, yue, ja, ko | **YES** (Native) | **YES** (DSP) | **YES** (DSP) | **YES** | **ACTIVE (Adapter Routed)** |

---

## Speaker Fallback & Integrity Rules

1. **No Silent Fallback to Unrelated Speakers**:
   - If a voice profile has no valid reference audio, `XTTSv2Adapter` returns `status="FAILED"`, `error="ENGINE_REQUIRES_REFERENCE_AUDIO: No valid reference audio found for voice profile"`.
   - It never silently plays an arbitrary built-in voice while claiming to have cloned the selected profile.

2. **Single-Speaker Baseline Transparency**:
   - `fastpitch-baseline` explicitly notes in its metadata: `speaker_type: "SINGLE_SPEAKER_BASELINE (LJSpeech)"`, `zero_shot_cloning: false`.
   - Users selecting FastPitch understand it is an ultra-low latency single-speaker benchmark engine.

3. **Multi-Model Identity Consistency**:
   - `xtts-v2`, `openvoice-v2`, and `cosyvoice` condition on the same reference WAV file when cloning a profile, ensuring speaker identity continuity across text prompts.
