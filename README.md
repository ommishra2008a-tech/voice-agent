# 🎙️ Voice Agent — Enterprise AI Voice Studio & Zero-Shot Neural Voice Cloner

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?logo=pytorch)](https://pytorch.org/)
[![XTTS v2](https://img.shields.io/badge/XTTS_v2-Zero--Shot_Cloning-792EE5)](https://github.com/coqui-ai/TTS)
[![Solarch BaaS](https://img.shields.io/badge/Solarch_BaaS-PocketBase-4A90E2)](https://github.com/solarch-org)
[![Tests](https://img.shields.io/badge/Tests-30%2F30_Passing-brightgreen)](#automated-testing)

An end-to-end, production-grade **AI Voice Chat Studio** featuring zero-shot neural voice cloning, reference voice analysis via real signal processing ($F_0$, spectral timbre, MFCCs, prosody, emotion, SNR), interactive audible preview workflows, first-class reusable voice profiles, and real-time 3D voice visualization.

---

## 🌟 Key Features

### 1. 🧬 Zero-Shot Voice Cloning & Reusable Voice Profiles
- **First-Class Reusable Voices**: Upload or record audio once to create a permanent voice profile (e.g. *"My Voice"*, *"Podcast Anchor"*).
- **Reference-Free Future Generation**: In future sessions, select the saved voice profile and generate speech without re-uploading original reference files.
- **Listen-Before-Save Preview Flow**: Hear real synthesized speech with new test sentences before committing profiles to durable storage.
- **Quality-Aware Multi-Sample Aggregation**: Combines multiple audio samples using quality and SNR weighting to guarantee optimal cloning fidelity.
- **Incremental Profile Versioning**: Non-destructive profile updates ($v1 \to v2 \to v3$) with complete acoustic history.

### 2. 🔬 Deep Reference Voice Analyzer
- **Fundamental Frequency ($F_0$) Extraction**: Autocorrelation-based pitch tracking, contour analysis, and pitch variance.
- **Timbre & Spectral Characterization**: Real FFT spectral centroid, bandwidth, rolloff, flatness, and 13 MFCC coefficients.
- **Prosody & Rhythm Profiling**: WPM speaking rate, pause frequency ratio, energy envelopes, and rhythm consistency.
- **Acoustic Emotion & Style Detection**: Formality, conversational score, expressiveness, and multi-class emotion probability distributions.
- **Quality Gate Assessment**: Real SNR (dB) estimation, clipping detection, active speech ratio, and pass/fail gate metrics.

### 3. 💬 Central Voice Chat Studio & 3D Visualizer
- **Single Cohesive Interface**: Seamless unified chat, voice input, file attachments, and real-time audio playback.
- **Live 3D Voice Visualizer**: Canvas-based real-time 3D frequency monitors and particle spectrum reacting to speech.
- **Multilingual Translation & Dubbing**: Translate text or dialogue and instantly synthesize in target languages (EN, ES, FR, DE, HI, JA, etc.).
- **Video Speaker Diarization**: Extract distinct speakers from video files and clone individual character voices.

---

## 🏗️ System Architecture

```
                                  ┌───────────────────────────────┐
                                  │      Next.js 14 Frontend      │
                                  │  (VoiceChatStudio / 3D Audio) │
                                  │      http://localhost:3000    │
                                  └───────────────┬───────────────┘
                                                  │
                         ┌────────────────────────┴────────────────────────┐
                         │                                                 │
                         ▼                                                 ▼
        ┌────────────────────────────────┐                ┌─────────────────────────────────┐
        │       Solarch BaaS (8090)      │                │   FastAPI AI ML Engine (8000)   │
        │      (PocketBase Database)     │                │   - Reference Voice Analyzer    │
        │ - User Projects & Records      │                │   - Speaker Identity Encoder    │
        │ - Voice Profiles Manifests     │                │   - Multi-Sample Aggregator     │
        │ - Chat & Attachment History    │                │   - XTTSv2 / OpenVoice / Cosy   │
        └────────────────────────────────┘                └────────────────┬────────────────┘
                                                                           │
                                                          ┌────────────────┴────────────────┐
                                                          ▼                                 ▼
                                              ┌───────────────────────┐         ┌───────────────────────┐
                                              │     Durable Storage   │         │    GPU / CUDA VRAM    │
                                              │ storage/voice_profiles│         │ PyTorch Neural Models │
                                              │ storage/voices        │         │ 24kHz PCM Synthesizer │
                                              └───────────────────────┘         └───────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18.0.0` or later
- **Python**: `3.10` or `3.11`
- **FFmpeg**: Installed and accessible in system `PATH`
- **CUDA / GPU** (Recommended): NVIDIA GPU with CUDA 11.8+ / 12.1+ for real-time neural synthesis

---

### Installation & Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/ommishra2008a-tech/voice-agent.git
cd voice-agent
```

#### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

#### 3. Setup Python AI Backend
```bash
cd services/ai-service
python -m venv venv

# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

#### 4. Setup Next.js Frontend
```bash
cd ../../apps/web
npm install
```

---

### 🏃 Running the Services

#### Start FastAPI AI ML Service (Port 8000)
```bash
# In services/ai-service directory:
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### Start Solarch BaaS (Port 8090)
```bash
# In repository root:
npx solarch-cli serve --port 8090
# or run pocketbase executable:
./pocketbase serve --http 0.0.0.0:8090
```

#### Start Next.js Frontend (Port 3000)
```bash
# In apps/web directory:
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

---

## 📡 API Reference

### Speech Generation & Zero-Shot Cloning
```http
POST /v1/speech/generate
Content-Type: application/json

{
  "project_id": "proj_123",
  "user_id": "user_456",
  "voice_profile_id": "vp_9e5992c687e7412a",
  "text": "Welcome to my channel. This speech is synthesized with my saved voice profile.",
  "model": "xtts-v2",
  "language": "en"
}
```

### Reference Audio Upload
```http
POST /v1/voice/upload
Content-Type: multipart/form-data

file: <audio_file.wav | .mp3 | .m4a | .flac>
```
*Automatically normalizes audio to 24kHz 16-bit mono PCM WAV.*

### Deep Voice Analysis
```http
POST /v1/voice/analyze
Content-Type: application/json

{
  "audio_path": "/path/to/reference.wav",
  "speaker_id": "speaker_1"
}
```

### Audible Clone Preview Before Save
```http
POST /v1/voice/profile/preview
Content-Type: application/json

{
  "audio_path": "/path/to/reference.wav",
  "preview_text": "Hello, this is my saved voice preview.",
  "language": "en",
  "model": "xtts-v2"
}
```

### Save Reusable Voice Profile
```http
POST /v1/voice/profile
Content-Type: application/json

{
  "project_id": "proj_123",
  "user_id": "user_456",
  "name": "My Podcast Voice",
  "audio_paths": ["/path/to/sample1.wav", "/path/to/sample2.wav"],
  "target_speaker_id": "speaker_1",
  "language": "en"
}
```

---

## 🧪 Automated Testing

The repository contains specialized test suites verifying the complete pipeline:

```bash
# 1. Run Core Voice Analyzer Test Suite (20 Tests)
node tests/phase12a-voice-analyzer-tests.js

# 2. Run Reusable Saved Voices & Preview Test Suite (10 Tests)
node tests/phase12a-followup-tests.js

# 3. Run M4A / MP3 / WAV Upload Normalization Check
node tests/test_m4a_upload_normalization.js

# 4. Run Frontend Typecheck
cd apps/web && npx tsc --noEmit
```

**Verification Summary**:
- Core Signal Processing: **20/20 PASSED**
- Reference-Free Reusable Synthesis: **10/10 PASSED**
- M4A Normalization & Analysis: **4/4 PASSED**
- TypeScript Compilation: **0 Errors**

---

## 📁 Repository Structure

```
voice-agent/
├── apps/
│   └── web/                   # Next.js 14 Web Application
│       ├── src/
│       │   ├── app/           # App Router Pages & API routes
│       │   ├── components/    # VoiceChatStudio, 3D Canvas, Waveforms
│       │   └── lib/           # Solarch Client, Audio Engine SDK
├── services/
│   └── ai-service/            # FastAPI ML Specialized Layer
│       ├── app/
│       │   ├── contracts/     # Pydantic Request & Response Schemas
│       │   ├── providers/     # VoiceAnalyzer, XTTSv2, OpenVoice, FFmpeg
│       │   └── routes/        # /speech, /voice, /media, /analysis
│       ├── storage/           # Durable Voice Profiles & Assets
│       └── requirements.txt   # Python Dependencies
├── docs/                      # Technical Documentation & Specs
│   ├── voice/                 # Voice Analyzer & Profile Schemas
│   └── phase-reports/         # Architecture & Implementation Reports
├── tests/                     # Automated Test Suites & Fixtures
├── .env.example               # Environment Configuration Template
├── .gitignore                 # Git Ignore Specifications
└── docker-compose.yml         # Container Deployment Configuration
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
