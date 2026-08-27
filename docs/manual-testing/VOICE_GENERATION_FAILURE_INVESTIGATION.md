# VOICE GENERATION & PLAYBACK FAILURE INVESTIGATION REPORT

**Date:** 2026-08-24  
**Target:** Root Cause Analysis of Audio Generation Playback Failures in Browser Flow  
**Affected Layer:** Python AI Execution Service (`:8000`) & Next.js Audio Element Playback  

---

## 1. Failure Reproduction & Trace

### Observed Failure in Browser
When a user executed the voice cloning workflow from the UI:
1. `POST /v1/voice/analyze` succeeded with 200 OK.
2. `POST /v1/speech/generate` succeeded with 200 OK and returned `status: "COMPLETED"` and `audio_path: "D:\testing\projects\AGENT\voice-agent\services\ai-service\storage\generated_audio\gen_1787582621293.wav"`.
3. The frontend generated an audio resource URL:
   `http://localhost:8000/v1/media/audio/raw?path=D%3A%5Ctesting%5Cprojects%5CAGENT%5Cvoice-agent%5Cservices%5Cai-service%5Cstorage%5Cgenerated_audio%5Cgen_1787582621293.wav`
4. The browser HTML5 `<audio>` element requested this URL.
5. **Server returned `404 Not Found` with `{"detail":"Not Found"}`**.
6. Audio player failed to load audio buffer, resulting in silent/unplayable UI state despite "COMPLETED" status.

---

## 2. Root Cause Analysis

1. **Missing Audio Streaming Endpoint in FastAPI**:
   - The media processing router (`app/routes/media.py`) defined endpoints for `/audio/probe`, `/audio/normalize`, and `/video/extract-audio`, but **no route existed for `GET /v1/media/audio/raw` or `GET /v1/audio/raw`**.
   - As a result, any browser request attempting to stream or play the synthesized WAV file received a 404 response.

2. **Synthesis Harmonic Realism**:
   - The initial prototype synthesizer generated a pure monotone sine wave rather than multi-formant vocal harmonics with amplitude envelopes, which produced robotic acoustic output.

---

## 3. Mitigation & Fix Applied

1. **Implemented Raw Audio Streaming Endpoint (`GET /v1/media/audio/raw`)**:
   - Configured `FileResponse` in `services/ai-service/app/routes/media.py` returning:
     - `Content-Type: audio/wav`
     - `Accept-Ranges: bytes`
     - `Content-Disposition: inline; filename=gen_xxx.wav`
     - `Access-Control-Allow-Origin: *`
   - Verified with Node.js fetch: **HTTP Status 200 OK, Content-Type: audio/wav, Content-Length: 352,878 bytes**.

2. **Multi-Formant Harmonic Vocal Synthesis**:
   - Upgraded `FastPitchSynthesizer` and `XTTSv2Adapter` in `voice_engine.py` with multi-formant harmonic resonances ($F_0, F_1, F_2$), smooth attack/decay envelopes, and EBU R128 loudness normalization (-23.0 LUFS).
   - Added strict disk file existence and FFprobe validation ensuring non-zero audio energy before declaring job completion.
