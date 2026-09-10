# Chocho Voice Profile: Reference Set Library (v2)

**Voice Profile ID:** `chocho`  
**Profile Version:** `v2`  
**Base Source Audio:** `aadi.m4a` / `chocho_raw_24k.wav`  
**Candidate Evaluation:** `scripts/voice-reference-set-diagnostic.py`

---

## 1. Candidate Audio Audit & Speaker Verification

| Candidate File | Speaker F0 Mean | Resemblyzer vs Chocho | Verification Decision | Reason |
|---|---|---|---|---|
| `chocho_raw_24k.wav` | 258.3 Hz | **100.0%** | **ACCEPTED** | Primary genuine speaker baseline. |
| `human.m4a` | 123.8 Hz | **74.93%** | **REJECTED** | Foreign male speaker (F0 ~124 Hz vs 258 Hz; similarity < 78.0%). |

---

## 2. Chocho v2 5-Reference Set Composition

| Reference ID | File | Duration | Utterance Content / Acoustic Focus | SNR |
|---|---|---|---|---|
| `ref_1` | `ref_01_greeting_7s.wav` | 7.00s | *"Hello, I am Caluva."* (Greeting clause, natural cadence) | 28.4 dB |
| `ref_2` | `ref_02_followup_2s.wav` | 1.41s | *"I am with you."* (Followup phrase, high speech density) | 26.9 dB |
| `ref_3` | `ref_03_clean_full_7.8s.wav` | 7.80s | Full clean trimmed speech window (0.2s - 8.0s) | 29.1 dB |
| `ref_4` | `ref_04_core_formant_6.3s.wav` | 6.30s | Core sustained vowel formant window (0.5s - 6.8s) | 29.8 dB |
| `ref_5` | `ref_05_formant_eq_8.2s.wav` | 8.21s | 2.5kHz Formant clarity tuned reference | 30.2 dB |
| **Total Set** | **5 Clips** | **30.72s** | **Full Phonetic & Acoustic Coverage** | **28.9 dB** |

---

## 3. Storage Hierarchy & Version Compatibility

- `storage/voice_profiles/chocho/` -> Historical single-reference baseline (v1).
- `storage/voice_profiles/chocho_v2/reference_set.json` -> 5-reference manifest with per-file SHA256 hashes and measured metrics.
