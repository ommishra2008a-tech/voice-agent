# MEDIA SOURCE PROVIDER CAPABILITY MATRIX

**Date:** 2026-08-24  
**Target:** External Media Ingestion & Extraction Capabilities  

---

## 1. Provider Capabilities Matrix

| Provider / Protocol | Direct Captions / Subtitles | Audio Extraction | Video Metadata | Multi-Speaker Diarization | RAG Ingestion | Fallback Mechanism |
|:---|:---:|:---:|:---:|:---:|:---:|:---|
| **YouTube (`youtube.com` / `youtu.be`)** | ✅ Yes (`timedtext` / captions) | ✅ Yes (24kHz Mono WAV) | ✅ Title, Channel, Duration, ID | ✅ Yes (`AcousticClusteringDiarizer`) | ✅ 384-D Vector Indexing | Automatic Faster-Whisper STT if captions missing |
| **Generic Media URL (`.mp3`, `.wav`, `.mp4`, `.webm`)** | 🔄 Via Faster-Whisper STT | ✅ Yes (Direct FFmpeg probe/demux) | ✅ Headers, Format, Size, Duration | ✅ Yes (`AcousticClusteringDiarizer`) | ✅ 384-D Vector Indexing | Direct FFmpeg normalization |
| **Podcast / RSS Audio Stream** | 🔄 Via Faster-Whisper STT | ✅ Yes (FFmpeg stream demux) | ✅ Stream Metadata | ✅ Yes (`AcousticClusteringDiarizer`) | ✅ 384-D Vector Indexing | Stream buffering |

---

## 2. Ingestion Stages & State Tracking

Every URL ingestion is tracked across sequential stages in Solarch `media_jobs`:
`PENDING` → `FETCHING` → `TRANSCRIBING` → `AUDIO_PROCESSING` → `DIARIZING` → `ALIGNING` → `ANALYZING` → `INDEXING` → `READY`.
