# Voice AI Chat Studio UI Architecture

## 1. Design Overview

The Autonomous Voice AI Studio is organized around a consumer-first paradigm that mimics a high-performance conversational AI assistant while powering zero-shot neural voice cloning under the hood.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              TOP HEADER                                │
│ [Logo] VOICE AI STUDIO PRO   Project: [Alpha ▾]   [3D/2D]   [Sign Out] │
├────────────────────────────────────────────────────────────────────────┤
│ [Home]   [Voices]   [Translate]   [Dub]   [Library]   [About]   [Lab]  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Hierarchy

```
Dashboard.tsx (Orchestrator)
 ├── LabScene.tsx (3D Spatial Room & Rainbow Trail - Background Layer)
 ├── VoiceChatStudio.tsx (Floating Foreground Chat Studio)
 │    ├── Voice Reference Bar (Active Voice Pill & Change Button)
 │    ├── Conversational Voice Stream (User & AI Audio Cards)
 │    │    ├── Animated Simulated Waveform
 │    │    ├── HTML5 Audio Player & Replay Controls
 │    │    └── Download WAV & Telemetry Badges
 │    ├── Chat Composer
 │    │    ├── '+' Action Button (VoiceAttachmentModal)
 │    │    ├── Multiline Expanding Textarea
 │    │    ├── Language Selector (EN, HI, ES, FR, DE, JA)
 │    │    ├── Voice Tuning Popover (Speed, Pitch)
 │    │    └── Big Generate Button
 │    └── VoiceAttachmentModal.tsx
 │         ├── Tab 1: Add Audio (Analyze -> Voice Ready -> Save)
 │         ├── Tab 2: Record Voice (MediaRecorder Mic Stream -> Preview -> Save)
 │         ├── Tab 3: Add Video (Diarization -> Speaker Selection -> Save)
 │         ├── Tab 4: Add Script (Text/Document Ingestion -> Inject to Composer)
 │         └── Tab 5: Saved Voices (Visual Voice Picker)
 ├── MyVoicesLibrary.tsx (Consumer Voice Cards & Quality Badges)
 ├── TranslationStudio.tsx (NLLB-200 Multilingual Studio)
 ├── DubbingStudio.tsx (Multi-Speaker Diarization & Dubbing)
 ├── MediaSourceLab.tsx (YouTube & Media Normalization)
 ├── AboutSection.tsx (Human-Readable Architecture Guide)
 └── AdvancedLab.tsx (Expert Diagnostic Matrix & Benchmarks)
```

---

## 3. Audio Streaming Protocol

- **Audio Playback Route**: `GET /v1/media/audio/raw?path=<url_encoded_path>`
- **Response Headers**:
  - `Content-Type: audio/wav`
  - `Accept-Ranges: bytes`
  - `Content-Length: <file_size_bytes>`
  - `Access-Control-Allow-Origin: *`
