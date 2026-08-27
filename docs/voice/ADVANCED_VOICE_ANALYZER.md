# Advanced Reference Voice Analyzer Architecture (Phase 12A)

## 1. Overview & Core Mission

The **Advanced Reference Voice Analyzer** is the foundational subsystem of the Autonomous Voice AI Platform responsible for transforming arbitrary uploaded or recorded reference audio into rigorous, multidimensional acoustic representations and versioned **Voice Profiles**.

Prior to Phase 12A, acoustic metrics were estimated using deterministic hash seeds. Phase 12A replaces this with **production-grade NumPy and FFT signal processing** directly on raw 16-bit PCM waveform samples loaded through `FFmpegMediaProcessor`.

```
Reference Audio (.wav / .mp3 / .flac / .m4a)
           │
           ▼
  ReferenceAudioLoader (16kHz / 24kHz PCM Float32)
           │
 ┌─────────┴────────────────────────────────────────────────────────────────────────┐
 │ MULTI-DIMENSIONAL ACOUSTIC FEATURE EXTRACTION (NumPy / SciPy Signal Processing)   │
 ├──────────────────┬─────────────────┬──────────────────┬──────────────────────────┤
 │ PitchAnalyzer    │ TimbreAnalyzer  │ ProsodyAnalyzer  │ EmotionAnalyzer          │
 │ (Autocorr F0)    │ (FFT + 13 MFCC) │ (Energy + WPM)   │ (Spectral Balance)       │
 └─────────┬────────┴────────┬────────┴────────┬─────────┴──────────┬───────────────┘
           │                 │                 │                    │
           ▼                 ▼                 ▼                    ▼
     StyleAnalyzer ◄────────────────────────────────────────────────┘
     (Expressiveness, Formality, Cadence)
           │
           ▼
  VoiceQualityAnalyzer (SNR, Speech Ratio, Clipping Detection, Speaker Consistency)
           │
     Quality Gate ──► [PASS: ≥ 60 Score] ──► READY (Full Zero-Shot Cloning)
           │      └──► [FAIL: < 60 Score] ──► NEEDS_REVIEW / REJECTED (With Reason)
           │
           ▼
  SpeakerIdentityEncoder (256-D L2-Normalized Spectral Fingerprint)
           │
           ▼
  Versioned VoiceProfile (v1.0.0 / Solarch BaaS Persisted)
```

---

## 2. Signal Processing Subsystems

### 2.1 Reference Audio Loader (`ReferenceAudioLoader`)
- **Direct WAV Inspection**: Extracts mono PCM float32 buffers normalized to `[-1.0, 1.0]`.
- **FFmpeg Ingestion**: Resamples non-WAV formats (.mp3, .m4a, .webm, .flac) to standardized 24kHz / 16kHz mono PCM.
- **Empty & Corrupted File Guard**: Immediately rejects 0-byte or invalid audio headers before downstream processing.

### 2.2 Pitch Analyzer (`PitchAnalyzer`)
- **Algorithm**: Frame-wise autocorrelation with Hanning windowing over 30ms frames and 10ms hops.
- **Search Range**: Valid human fundamental frequency ($F_0$) lag boundaries between 60 Hz and 500 Hz.
- **Extracted Metrics**:
  - `f0_mean` & `f0_median`: Central pitch tendency (Hz)
  - `f0_min`, `f0_max`, `f0_range`: Vocal register span
  - `pitch_variance`: Pitch dynamic variance
  - `contour_samples`: Sampled pitch trajectory points across timeline

### 2.3 Timbre Analyzer (`TimbreAnalyzer`)
- **Algorithm**: Short-Time Fourier Transform (STFT) magnitude spectrum computation.
- **Extracted Metrics**:
  - `spectral_centroid`: Center of mass of frequency spectrum (Hz)
  - `spectral_bandwidth`: Spectral spread around centroid (Hz)
  - `spectral_rolloff`: 85% energy frequency boundary (Hz)
  - `spectral_flatness`: Geometric vs. arithmetic mean ratio (tonality vs. noise)
  - `mfcc_means`: 13 standard Mel-Frequency Cepstral Coefficients computed via log triangular Mel filterbanks and Discrete Cosine Transform (DCT).

### 2.4 Prosody & Rhythm Analyzer (`ProsodyAnalyzer`)
- **Algorithm**: Frame-level Root-Mean-Square (RMS) energy envelopes and syllable nucleus peak tracking.
- **Extracted Metrics**:
  - `speaking_rate_wpm`: Estimated words-per-minute based on syllable peak clustering
  - `pause_duration_sec`: Aggregate silence duration below speech threshold
  - `pause_frequency_ratio`: Ratio of pause transitions to speech timeline
  - `energy_variation`: Coefficient of variation of voiced frame energies
  - `rhythm_score`: Regularity score of inter-syllable peak intervals ($[0.0, 1.0]$)

### 2.5 Style & Emotion Analyzers (`StyleAnalyzer` & `EmotionAnalyzer`)
- **Style Classification**: Expressiveness, formality, and conversational scores derived from $F_0$ dynamics and speaking rate boundaries.
- **Emotion Estimation**: Spectral energy distribution across high-frequency bands ($>3000\text{ Hz}$) combined with pitch variance to categorize emotional tendency (Neutral, Confident, Calm, Energetic, Warm, Hesitant).

---

## 3. Dual-Representation Speaker Identity Architecture

Per user architecture requirements, speaker representations are strictly segmented:

1. **Deterministic Acoustic Fingerprint (`spectral-fingerprint`)**:
   - 256-dimensional $L_2$-normalized vector derived from aggregated spectral moments and subband energies.
   - 100% reproducible for exact audio matches (Cosine similarity = $1.0$).
   - Designed for deduplication, regression testing, profile indexing, and acoustic consistency verification.
2. **Conditioning Reference Audio**:
   - XTTSv2 and downstream zero-shot TTS models are conditioned **directly on the server-side reference audio WAV**, preserving full phase and vocal tract fidelity.
3. **Neural Encoder Slot**:
   - Reserved for future offline neural speaker encoders (e.g. Resemblyzer / ECAPA-TDNN) without altering the API contract.

---

## 4. Quality Gate & Safety Thresholds

The Quality Gate enforces minimum acoustic criteria before a reference sample is permitted for high-fidelity zero-shot cloning:

| Metric | Minimum Threshold | Rationale |
|---|---|---|
| **Quality Score** | $\ge 60.0 / 100$ | Composite score of SNR, speech duration, and consistency |
| **Duration** | $\ge 0.5\text{s}$ (3–10s recommended) | Minimum acoustic duration for voice timbre capture |
| **Signal-to-Noise Ratio (SNR)** | $\ge 15.0\text{ dB}$ | Prevents cloning room echo and background noise |
| **Speaker Consistency** | $\ge 0.70$ | Rejects multi-speaker overlap or inconsistent acoustic environments |
| **Speech Ratio** | $\ge 20\%$ | Ensures audio is not predominantly dead silence |
| **Clipping** | $< 0.5\%$ clipped frames | Prevents harmonic distortion from blown-out microphone input |

---

## 5. API Routes Reference

- `POST /v1/voice/upload` — Multipart form upload returning `{ status, audio_path, duration, size_bytes }`.
- `POST /v1/voice/analyze` — Runs full signal analysis pipeline and quality gate evaluation.
- `POST /v1/voice/profile` — Creates versioned `VoiceProfile` and links reference audio.
- `POST /v1/voice/compare` — Computes cosine similarity, pitch delta, and composite similarity between two audio paths.
- `POST /v1/voice/quality` — Standalone quality assessment endpoint.
- `GET /v1/voice/models` — Returns encoder metadata, device capability, and VRAM status.
