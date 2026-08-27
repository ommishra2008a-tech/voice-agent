# REAL-TIME AUDIO LIP-SYNC & VISEME ARCHITECTURE

**Date:** 2026-08-24  
**Layer:** TypeScript React Three Fiber Frontend + Python DSP Acoustic Feature Extraction  

---

## 1. Pipeline Architecture

```
[Synthesized WAV Audio / HTML5 Audio Element]
                    │
                    ▼
       [Web Audio API AnalyserNode]
          (128-point Real-time FFT)
                    │
                    ├─────────────────────────┐
                    ▼                         ▼
          [RMS Audio Energy]          [Spectral Energy Bands]
       (Amplitude 0.0 to 1.0)        - Low: 100 Hz - 500 Hz
                    │                - Mid: 500 Hz - 1,800 Hz
                    │                - High: 1,800 Hz - 4,000 Hz
                    ▼                         │
         [Spatial 3D Waveform &               ▼
             Aura Glow Scale]         [Dominant Band Viseme Mapper]
                                            │
                                            ▼
                                  ┌───────────────────┐
                                  │ Viseme Dictionary │
                                  │  - A (Open/Mid)   │
                                  │  - E (Wide/High)  │
                                  │  - I (Narrow/High)│
                                  │  - O (Round/Low)  │
                                  │  - U (Pucker/Low) │
                                  │  - SILENCE (Idle) │
                                  └───────────────────┘
                                            │
                                            ▼
                            [React Three Fiber Mesh Morphing]
                            - mouthRef.current.scale.y (Open)
                            - mouthRef.current.scale.x (Wide)
                            - Eye blink & head posture tracking
```

---

## 2. Python DSP Analysis Fallback (`/v1/speech/lipsync`)

When pre-computed viseme tracks are required for synchronized video export:
- Audio WAV files are analyzed at 30 FPS.
- Hanning-windowed FFT extracts sub-band energy ratios to generate deterministic `LipSyncFrame` timelines with timestamps, mouth opening, mouth width, and intensity values.
