# Reference Audio Quality Guidelines & Acoustic Standards

## 1. Optimal Reference Characteristics for Zero-Shot Cloning

To achieve studio-quality zero-shot neural voice cloning with XTTSv2 and the platform's multi-model engines, reference audio should satisfy the following criteria:

| Parameter | Ideal Target | Acceptable Range | Unacceptable (Rejected) |
|---|---|---|---|
| **Duration** | 4.0 – 8.0 seconds | 2.0 – 15.0 seconds | $< 0.5$ seconds or 0-byte |
| **Sample Rate** | 24,000 Hz / 48,000 Hz | 16,000 Hz – 48,000 Hz | $< 8,000$ Hz |
| **Channels** | Mono | Stereo (downmixed to Mono) | Corrupted channel interleave |
| **SNR** | $> 30\text{ dB}$ | $15 – 30\text{ dB}$ | $< 10\text{ dB}$ (Heavy noise) |
| **Speech Content** | Continuous fluent sentences | Conversational phrases | Single isolated words / gasps |
| **Background Noise** | Studio silence ($<-50\text{ dBFS}$) | Mild room acoustics | Music, crowd chatter, fan hum |
| **Dynamic Range** | Peaks at $-3\text{ dBFS}$ | $-12\text{ dBFS}$ to $-1\text{ dBFS}$ | Digital clipping ($>0.5\%$ frames) |

---

## 2. Common Acoustic Artifacts & Mitigations

### 2.1 Multi-Speaker Contamination
- **Symptom**: Low speaker consistency score ($<0.70$), erratic $F_0$ distribution jumps.
- **Cause**: Multiple people talking simultaneously or overlapping conversation.
- **Mitigation**: Use single-speaker isolated clips or run diarization before profile generation.

### 2.2 Reverb & Room Echo
- **Symptom**: Spectral flatness degradation, inflated pause energy floor.
- **Cause**: Recording in an untreated hard-walled room with distant microphone placement.
- **Mitigation**: Position microphone within 15–20 cm of speaker with directional cardioid pickup.

### 2.3 Microphone Clipping & Saturation
- **Symptom**: Flat-topped waveform peaks at $\pm 32767$, severe harmonic distortion.
- **Cause**: Gain set too high on audio interface or speaking too loudly.
- **Mitigation**: Adjust input gain so peak level remains below $-3\text{ dBFS}$.
