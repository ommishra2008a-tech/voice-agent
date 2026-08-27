# Voice Profile Data Contract & Schema Specification

## 1. Overview

A **Voice Profile** is a versioned, persistent acoustic asset stored in the Solarch BaaS database (`voice_profiles` collection) and referenced by the AI synthesis engine for Zero-Shot Voice Cloning, Translation, and Dubbing workflows.

---

## 2. Versioned JSON Schema (`VoiceProfileRecord`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "VoiceProfileRecord",
  "type": "object",
  "required": [
    "projectId",
    "userId",
    "name",
    "speakerId",
    "speakerEmbedding",
    "qualityScore",
    "qualityGatePassed",
    "profileVersion",
    "encoderVersion",
    "analysisVersion",
    "referenceAudioPaths"
  ],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique profile identifier (e.g. vp_5b1f2e610c114230 or Solarch record id)"
    },
    "projectId": { "type": "string" },
    "userId": { "type": "string" },
    "name": { "type": "string", "description": "Human-readable label for the cloned voice" },
    "speakerId": { "type": "string", "default": "speaker_1" },
    "language": { "type": "string", "default": "en" },
    "profileVersion": { "type": "string", "default": "1.0.0" },
    "encoderVersion": { "type": "string", "default": "spectral-fingerprint-v1.0.0" },
    "analysisVersion": { "type": "string", "default": "phase12a" },
    "created": { "type": "string", "format": "date-time" },
    "updated": { "type": "string", "format": "date-time" },
    "qualityScore": { "type": "number", "minimum": 0, "maximum": 100 },
    "qualityGatePassed": { "type": "boolean" },
    "rejectionReason": { "type": ["string", "null"] },
    "referenceAudioPaths": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Server-side absolute paths to normalized 24kHz reference WAV files"
    },
    "speakerEmbedding": {
      "type": "array",
      "items": { "type": "number" },
      "minItems": 256,
      "maxItems": 256,
      "description": "256-D L2-normalized acoustic identity vector"
    },
    "pitchStats": {
      "type": "object",
      "properties": {
        "f0_mean": { "type": "number" },
        "f0_median": { "type": "number" },
        "f0_min": { "type": "number" },
        "f0_max": { "type": "number" },
        "f0_range": { "type": "number" },
        "pitch_variance": { "type": "number" },
        "contour_samples": { "type": "array", "items": { "type": "number" } }
      }
    },
    "timbreCharacteristics": {
      "type": "object",
      "properties": {
        "spectral_centroid": { "type": "number" },
        "spectral_bandwidth": { "type": "number" },
        "spectral_rolloff": { "type": "number" },
        "spectral_flatness": { "type": "number" },
        "mfcc_means": { "type": "array", "items": { "type": "number" }, "minItems": 13, "maxItems": 13 }
      }
    },
    "prosodyProfile": {
      "type": "object",
      "properties": {
        "speaking_rate_wpm": { "type": "number" },
        "pause_duration_sec": { "type": "number" },
        "pause_frequency_ratio": { "type": "number" },
        "pitch_variation": { "type": "number" },
        "energy_variation": { "type": "number" },
        "rhythm_score": { "type": "number" }
      }
    },
    "styleProfile": {
      "type": "object",
      "properties": {
        "conversational_score": { "type": "number" },
        "formality_score": { "type": "number" },
        "expressiveness_score": { "type": "number" },
        "sentence_rhythm": { "type": "string" },
        "speaking_behavior": { "type": "string" }
      }
    },
    "emotionProfile": {
      "type": "object",
      "properties": {
        "primary_emotion": { "type": "string" },
        "confidence": { "type": "number" },
        "emotion_distribution": { "type": "object" },
        "segment_emotions": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "start_time": { "type": "number" },
              "end_time": { "type": "number" },
              "emotion": { "type": "string" },
              "confidence": { "type": "number" }
            }
          }
        }
      }
    }
  }
}
```

---

## 3. Database Persistence in Solarch BaaS

When a user saves an analyzed voice profile in the frontend Studio:
1. `POST /v1/voice/profile` validates the audio sample, computes acoustic metrics, and generates a `vp_<id>` handle.
2. The frontend client sends the profile payload to Solarch via `solarch.createVoiceProfile()`.
3. The newly persisted profile becomes immediately selectable in the **Voice Selector dropdown** and is injected into future `POST /v1/speech/generate` synthesis requests as `voice_profile_id`.
