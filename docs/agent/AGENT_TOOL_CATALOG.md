# AGENT TOOL REGISTRY CATALOG

**Date:** 2026-08-24  
**Target:** Deterministic Tool Definitions and Schemas  

---

## 1. Registered Tools

| Tool Name | Category | Description | Primary Inputs | Output Reference |
|:---|:---:|:---|:---|:---|
| `process_media_url` | SOURCE | Ingests URL, extracts captions, diarizes speakers, indexes to RAG | `url`, `project_id`, `user_id` | `source_asset_id`, `speakers` |
| `get_source_metadata` | SOURCE | Probes URL for metadata and duration | `url` | `provider`, `title`, `duration` |
| `select_speaker` | AUDIO | Selects speaker from source asset as voice candidate | `source_asset_id`, `speaker_id` | `voice_profile_id`, `candidate_profile` |
| `search_knowledge` | RAG | Performs 384-D vector retrieval with speaker filtering | `query`, `project_id`, `speaker_filter` | `results`, `citations` |
| `translate_text` | LANGUAGE | Translates text with terminology glossary support | `source_text`, `target_language` | `translated_text`, `confidence` |
| `generate_speech` | GENERATION | Generates 24kHz Mono WAV speech conditioned on voice profile | `text`, `voice_profile_id`, `language` | `audio_path`, `duration` |
| `evaluate_generated_audio` | GENERATION | Scores similarity, pitch correlation, and intelligibility | `ref_path`, `gen_path` | `overall_quality_score` |
