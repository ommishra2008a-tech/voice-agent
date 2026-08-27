# Chat History Persistence Design

## 1. Overview
The Voice Chat Studio chat history is designed to be fully persistent across browser refresh, page reloads, and multi-session workflows. Chat messages and generated speech outputs are backed by **Solarch BaaS PocketBase** collections rather than volatile browser memory or temporary blob URLs.

---

## 2. Persistence Architecture

### Schema Linkage
```
Solarch BaaS PocketBase
├── generation_jobs (Collection)
│    ├── id (Job ID / Generation ID)
│    ├── projectId (Project scope)
│    ├── userId (User identity)
│    ├── voiceProfileId (Canonical Voice Profile Record ID)
│    ├── text (User input / Synthesized script)
│    ├── targetLanguage (Synthesis language code: en, es, hi, etc.)
│    ├── styleParams (JSON: model, speed, pitch, emotion, voiceName)
│    ├── status (PROCESSING | COMPLETED | FAILED)
│    ├── outputAssetId (Durable server file path to generated WAV)
│    ├── executionTimeMs (Synthesis execution time)
│    └── created / updated (Timestamps)
└── voice_profiles (Collection)
     ├── id (Canonical Voice ID)
     ├── name (User-assigned voice label)
     ├── primaryReferencePath (Reference WAV path)
     └── speakerEmbedding (Speaker conditioning vectors)
```

---

## 3. Browser Refresh & Session Recovery Behavior

1. **Initial Mount & Project Change**:
   - `VoiceChatStudio` queries `solarch.getVoiceProfiles(projectId)` to load existing saved voices.
   - `VoiceChatStudio` calls `loadChatHistory()` which retrieves all `generation_jobs` filtered by `projectId` from PocketBase.
   - Jobs are mapped chronologically to reconstruct:
     - User message cards (Text + Timestamp)
     - AI Voice message cards (Text + Voice Profile Name + Model + Duration + Speed + Durable Audio URL).
2. **Audio Streaming & Playback**:
   - Reconstructed cards access audio via:
     `http://localhost:8000/v1/media/audio/raw?path=${encodeURIComponent(outputAssetId)}`
   - Playback, replay, speed adjustments, and download work out of the box.

---

## 4. Missing / Deleted Audio Handling (Zero-Fabrication Rule)

- If a generated audio file was removed from disk, the `<audio>` tag triggers `onError`.
- The UI gracefully falls back to displaying:
  > **⚠️ Audio no longer available** (along with Job ID / Output Asset ID metadata).
- The system **never fabricates** synthetic replacements or deletes historical message records.

---

## 5. Diagnostic Retrieval Path

The diagnostic CLI tool `scripts/voice-fidelity-diagnostic.js` can look up any historical generation:
```bash
node scripts/voice-fidelity-diagnostic.js --generation-id gen_1787833546649
```
Outputs:
- Target audio file presence on disk & Solarch BaaS
- Audio format, sample rate, bit depth, channel count, duration
- External reference audio path & status
