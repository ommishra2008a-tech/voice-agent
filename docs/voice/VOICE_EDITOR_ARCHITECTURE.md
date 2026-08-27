# ADVANCED VOICE EDITOR & A/B COMPARISON ARCHITECTURE

**Date:** 2026-08-24  
**Layer:** Next.js 14 React Workbench + Solarch Collections + Python Neural Inference  

---

## 1. Engine Capability Matrix & Parameter Enforcement

To maintain strict truth in parameter controls, the Voice Editor disables unsupported sliders based on the selected synthesis engine:

| Engine | Speed Control | Pitch Modulation | Energy Control | Emotion Style | Zero-Shot Cloner | In-Context Prompts |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| `fastpitch-baseline` | **Active** | **Active (-10 to +10 st)** | **Active (0.5x to 1.5x)** | **Active** | Default Vocoder | N/A |
| `xtts-v2` | **Active** | *Engine Ref Bound* | *Engine Ref Bound* | *Via Ref Voice* | **Primary** | N/A |
| `openvoice-v2` | **Active** | **Active** | *Engine Ref Bound* | *Tone Color* | **Tone Color Cloner** | N/A |
| `cosyvoice` | **Active** | *Engine Ref Bound* | *Engine Ref Bound* | **Active** | Prompt Bound | **Primary** |

---

## 2. Voice Profile Link & Preset Storage

1. **Reset to Profile Baseline**: Retrieves verified `voice_profiles` from Solarch and resets pitch to `0 st`, speed to `1.0x`, and energy to `1.0x` while preserving the underlying 256-D speaker embedding.
2. **Project-Scoped Presets**: Custom parameter configurations are serialized into `projects.settings.presets` in Solarch, enabling seamless cross-device sharing without duplicate database tables.
3. **Dual-Track A/B Testing**: Side-by-side execution with identical evaluation scripts computing similarity delta, latency overhead, and VRAM deltas in real time.
