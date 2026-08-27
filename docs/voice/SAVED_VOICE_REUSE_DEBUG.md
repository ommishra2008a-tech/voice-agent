# SAVED VOICE REUSE & HIGH-FIDELITY CLONE OPTIMIZATION

## 1. Root Cause Analysis

### Problem Observed
1. Voice **"aadi"** was created and saved in the UI.
2. In later sessions or upon re-selecting "aadi", generated speech sounded like a generic default voice instead of the user's reference audio.

### Architectural Root Causes Identified:
1. **ID Disconnect Between Solarch BaaS & Python Storage**:
   - The Python backend created and indexed voice profiles under unique generated IDs (`vp_<uuid>`), saving audio to `storage/voice_profiles/vp_<uuid>/reference.wav`.
   - When the frontend persisted the profile into Solarch PocketBase, PocketBase assigned its own record ID (e.g. `20a9bc489f0a4f5`), and the frontend subsequent calls passed `voice_profile_id = "20a9bc489f0a4f5"`.
   - The backend was looking for `storage/voice_profiles/20a9bc489f0a4f5/reference.wav`, which did not exist on disk.
2. **Silent Fallback to Default Test Fixtures**:
   - When reference audio resolution failed in `_resolve_reference_audio`, the search paths fell back to `tests/fixtures/real_speech_reference_24k.wav` or `sample_speech.wav`.
   - As a result, XTTS v2 silently synthesized speech conditioned on the fixture sample rather than failing explicitly or using the user's actual voice.
3. **Missing Direct Reference Linkage in Generation Payloads**:
   - `VoiceGenerationRequest` only received `voice_profile_id` without explicit `reference_audio_path`, preventing the backend from resolving durable paths directly stored in Solarch records.

---

## 2. Technical Fixes Implemented

### 1. `ReferenceAudioPreprocessor` (High-Fidelity Audio Conditioning)
- Added `ReferenceAudioPreprocessor` to `app/providers/voice_engine.py`.
- Trims non-speech / dead silence using energy VAD (`silenceremove`).
- Converts and normalizes audio to 24000 Hz 16-bit mono PCM with peak volume normalization (`-1.0 dBFS`).
- Caches pristine preprocessed audio as `{profile_dir}/reference_clean_24k.wav` for optimal XTTS v2 speaker conditioning.

### 2. Multi-Stage Reference Resolution without Generic Fallbacks
Updated `XTTSv2Adapter._resolve_reference_audio`:
1. **Explicit Reference Path**: Direct inspection of `req.reference_audio_path` if passed from frontend Solarch record.
2. **Direct File Path**: Inspection if `voice_profile_id` is an absolute/relative audio file path.
3. **Durable Profile Manifest**: Reads `storage/voice_profiles/{voice_profile_id}/profile.json` (`primary_reference_path` or `reference_audio_paths`).
4. **Direct Storage Candidates**: Checks `storage/voice_profiles/{id}/reference.wav`, `sample_1.wav`, `storage/voices/{id}.wav`.
5. **Solarch BaaS HTTP Lookup**: Queries PocketBase API `GET /api/collections/voice_profiles/records/{id}` and filter query by name `filter=(name='{name}')` to resolve `primaryReferencePath`.
6. **Subdirectory Manifest Scan**: Scans all `storage/voice_profiles/*/profile.json` manifests matching `name` or `voice_profile_id`.
7. **Strict Non-Fallback Policy**: If reference cannot be resolved, returns `None` and fails with `400 Bad Request` + `VOICE_REFERENCE_UNAVAILABLE`. **NO DEFAULT OR FIXTURE FALLBACK IS PERMITTED.**

### 3. Frontend Persistence & Direct Linkage (`VoiceChatStudio.tsx`)
- `VoiceChatStudio.tsx` stores active voice profile ID, name, and `primaryReferencePath` in `localStorage`.
- `loadProfiles()` restores the active saved voice on page refresh.
- `handleSendMessage()` passes both `voice_profile_id` and `reference_audio_path: selectedProfile?.primaryReferencePath`.

### 4. Single-Speaker Engine Compatibility Enforcement
- `FastPitchSynthesizer.synthesize()` explicitly validates that custom voice profiles are rejected with `VOICE_PROFILE_NOT_SUPPORTED_BY_ENGINE`.

---

## 3. End-to-End Verification

Automated test suite `tests/phase12b-saved-voice-reuse-test.js` executed 6/6 tests with 100% pass rate:
- **TEST-12B-01**: Saved Voice Profile "aadi" creation and storage linkage $\to$ **PASSED**
- **TEST-12B-02**: Sentence A synthesis using only `voice_profile_id` (no re-upload) $\to$ **PASSED** (Duration: 2.73s, Cloned: `reference_clean_24k.wav`)
- **TEST-12B-03**: Sentence B synthesis across re-selection (no re-upload) $\to$ **PASSED** (Duration: 3.29s, Cloned: `reference_clean_24k.wav`)
- **TEST-12B-04**: Sentence C synthesis via profile name "aadi" resolution $\to$ **PASSED** (Duration: 4.13s, Cloned: `reference_clean_24k.wav`)
- **TEST-12B-05**: Strict rejection of missing reference (`VOICE_REFERENCE_UNAVAILABLE`) $\to$ **PASSED**
- **TEST-12B-06**: FastPitch custom profile rejection (`VOICE_PROFILE_NOT_SUPPORTED_BY_ENGINE`) $\to$ **PASSED**
