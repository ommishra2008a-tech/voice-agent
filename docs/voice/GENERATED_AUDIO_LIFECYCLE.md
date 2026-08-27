# Generated Audio Lifecycle & Asset Management

## 1. Lifecycle Stages

```
User Prompt (Text + Voice Profile)
  │
  ▼
1. Solarch Job Creation (`status: "PROCESSING"`)
  │
  ▼
2. AI Service Synthesis (`POST /v1/speech/generate`)
  │   - Audio rendered to: `storage/generated_audio/gen_{timestamp}.wav`
  │
  ▼
3. Solarch Record Completion (`status: "COMPLETED"`, `outputAssetId: path`)
  │
  ▼
4. Frontend Audio Presentation (`/v1/media/audio/raw?path=...`)
  │
  ▼
5. Persistent Rehydration on Page Refresh / Next Session
```

---

## 2. Target Audio Recovery Status: `gen_1787833546649`

### Verification Results:
- **Identifier**: `gen_1787833546649`
- **Location 1**: `D:\testing\projects\AGENT\voice-agent\services\ai-service\storage\generated_audio\gen_1787833546649.wav`
- **Location 2**: `D:\downlods_new\gen_1787833546649.wav`
- **File Size**: 113,228 bytes (~110.6 KB)
- **Duration**: 2.36 seconds
- **Sample Rate**: 24,000 Hz
- **Channels**: 1 (Mono PCM WAV)
- **Status**: **RECOVERED & READY FOR DIAGNOSTIC EVALUATION**

---

## 3. Diagnostic Tool Usage

To run fidelity diagnostics and asset verification:
```bash
node scripts/voice-fidelity-diagnostic.js --generation-id gen_1787833546649 --reference "D:\downlods_new\aadi.m4a" --generated "D:\downlods_new\ai aadi.wav"
```
Supports:
- `--generation-id`: Looks up by filename or Solarch record ID
- `--reference`: Points to ground-truth human recording
- `--generated`: Points to AI generated output for direct acoustic comparison
