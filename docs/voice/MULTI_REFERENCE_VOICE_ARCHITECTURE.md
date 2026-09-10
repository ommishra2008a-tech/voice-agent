# Multi-Reference Voice Profile & Conditioning Architecture

**Date:** August 2026  
**Status:** Implemented & Verified in Phase 13H  
**Primary Engine:** XTTS v2 (`TTS==0.22.0`)

---

## 1. Overview & Theoretical Background

In zero-shot voice cloning, a single audio reference limits the speaker conditioning space:
- Short recordings (<10s) lack phonetic coverage.
- Single-utterance prosody can bias the model toward specific pitch inflection rather than the speaker's true timbre centroid.

By supplying multiple clean reference audio clips of the same speaker, XTTS v2 computes:
1. **Per-Reference Speaker Embeddings (`d_vector`, 512-dim):** Extracted across the full audio up to `max_ref_length=30` seconds and averaged across recordings (`speaker_embedding = torch.stack(speaker_embeddings).mean(dim=0)`).
2. **Concatenated GPT Conditioning Latent:** Audio segments are concatenated along the time axis (`full_audio = torch.cat(audios, dim=-1)`), allowing the GPT autoregressive transformer to sample conditioning latents over a richer phonetic landscape.

---

## 2. API & Engine Integration

### Official Coqui TTS Multi-Reference Signature
In `TTS.api.TTS.tts_to_file()`:
```python
# Installed signature accepts single path string OR list of path strings
tts.tts_to_file(
    text=text,
    speaker_wav=["ref_01.wav", "ref_02.wav", "ref_03.wav", "ref_04.wav", "ref_05.wav"],
    language="en",
    file_path=output_path,
    ...
)
```

### Application Adapter Support
In [`services/ai-service/app/providers/voice_engine.py`](file:///d:/testing/projects/AGENT/voice-agent/services/ai-service/app/providers/voice_engine.py):
1. `ReferenceAudioPreprocessor.get_clean_reference(input_audio)` accepts `Union[str, List[str]]` and formats each clip into a 24kHz mono PCM WAV without destructive filtering.
2. `XTTSv2Adapter._resolve_reference_audio()` inspects versioned reference manifests (`reference_set.json`) or multi-reference arrays in Solarch BaaS.

---

## 3. Data Model & Profile Versioning

Multi-reference profiles are versioned hierarchically:
- **Canonical Profile:** `storage/voice_profiles/chocho/` (Historical Single-Reference Baseline v1)
- **Multi-Reference Profile:** `storage/voice_profiles/chocho_v2/` (5-Reference Set Manifest v2)

### `reference_set.json` Schema:
```json
{
  "voice_profile_id": "chocho",
  "profile_version": "v2",
  "reference_set_version": "2.0.0",
  "reference_count": 5,
  "total_reference_duration_sec": 30.72,
  "references": [
    {
      "id": "ref_1",
      "path": ".../ref_01_greeting_7s.wav",
      "sha256": "...",
      "duration_sec": 7.0
    },
    ...
  ]
}
```

---

## 4. Multi-Tenant Security & Cache Invalidation

1. **Ownership Enforcement:** Reference paths are resolved strictly within the authenticated tenant's project and user scope (`VOICE_PROFILE_ACCESS_DENIED`).
2. **Freshness Guarantee:** Conditioning cache is keyed by profile version, reference file SHA256 hashes, and model parameters. Transitioning from v1 to v2 immediately invalidates single-reference cache keys.
