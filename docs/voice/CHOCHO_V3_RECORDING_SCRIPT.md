# Chocho V3 Studio Recording Script & Voice Capture Guide

**Target Voice Identity:** `chocho` (alias: `aadi`)  
**Target Duration:** 30 to 60 seconds of clean speech (minimum 15–30s)  
**Output Target Format:** 24 kHz, 16-bit, Mono PCM WAV  
**Model Architecture:** Coqui XTTS v2 Zero-Shot Conditioning  

---

## 1. Acoustic Recording Environment & Hardware Guidelines

To ensure the neural encoder captures pure vocal tract resonance without room distortion:

1. **Room Acoustics:**
   - Record in a quiet room with minimal echo/reverberation (e.g. carpeted bedroom or closet with hanging clothes to absorb early reflections).
   - Turn off all fans, air conditioners, heaters, and computer blowers.
   - Close windows and doors to prevent traffic or outdoor noise leakage.
2. **Microphone Setup:**
   - Use a directional cardioid condenser or high-quality dynamic microphone.
   - Maintain a consistent mouth-to-microphone distance of **6 to 8 inches (15–20 cm)**.
   - Use a pop filter or foam windscreen angled slightly off-axis (15–30 degrees) to prevent plosive wind blasts on `/p/`, `/b/`, and `/t/`.
3. **Gain Staging:**
   - Speak at normal conversational volume; adjust input gain so voice peaks between **-12 dBFS and -6 dBFS**.
   - **CRITICAL:** Ensure zero digital clipping (never reach 0 dBFS).
4. **Vocal Delivery:**
   - Speak with your natural speaking voice—do not whisper, shout, or perform exaggerated character acting.
   - Keep vocal cadence relaxed and natural.

---

## 2. Phonetically-Balanced Studio Recording Script

The script below is specifically engineered to provide broad articulatory coverage across all **44 English phonemes**, with emphasis on the voiceless fricatives, affricates, and nasals that were missing in the original 8-second recording.

### Section A: Neutral Statement & Vowel Baseline (Target: ~10 seconds)
> *"Welcome to our voice technology laboratory. Speech synthesis allows artificial intelligence to understand the subtle harmonics, resonance, and rhythm of human speech."*
- **Phonetic Targets:** High-front vowels `/iː/`, `/ɪ/`, back vowels `/uː/`, `/oʊ/`, liquid consonants `/l/`, `/r/`.

### Section B: Conversational Flow & Voiceless Fricatives (Target: ~10 seconds)
> *"Honestly, I think that approach makes complete sense. Let's definitely catch up tomorrow morning to finalize the schedule and review the project budget."*
- **Phonetic Targets:** Sibilants `/s/`, `/z/`, voiceless affricates `/tʃ/` (*catch*), plosives `/p/`, `/b/`, `/t/`, `/d/`, `/k/`, `/g/`.

### Section C: Plosives, Nasals & Inquiries (Target: ~10 seconds)
> *"Could you please tell me which direction the mountain path takes? We should bring warm jackets and water before the sun starts to set."*
- **Phonetic Targets:** Velar nasals `/ŋ/` (*bring*), voiceless stops `/p/`, `/t/`, `/k/`, diphthongs `/aɪ/`, `/aʊ/`.

### Section D: Warmth & Dynamic Pitch Range (Target: ~10 seconds)
> *"I cannot express how deeply grateful I am for all your kindness, patience, and unwavering encouragement throughout this entire journey."*
- **Phonetic Targets:** Dental fricatives `/ð/` (*this*), `/θ/`, labiodental fricatives `/f/`, `/v/`, sustained resonant vowels.

### Section E: Rapid Instruction & Dialogue (Target: ~10 seconds)
> *"Check the audio cables, verify that the green indicator is flashing, and press the red record button whenever you are ready."*
- **Phonetic Targets:** Voiceless stops, consonant clusters `/fl/`, `/kl/`, `/pr/`, natural pause boundaries.

---

## 3. Total Script Timing & File Ingestion

| Section | Modality | Duration | Target Phonemes |
|---|---|---|---|
| Section A | Neutral Technical | ~9.5s | Core Vowels, Liquids `/l, r/` |
| Section B | Conversational | ~9.0s | Sibilants `/s, z/`, Affricates `/ch/` |
| Section C | Question & Inquiry | ~8.5s | Velar Nasal `/ng/`, Stops `/p, t, k/` |
| Section D | Warm Emotional | ~10.0s | Dental `/th/`, Fricatives `/f, v/` |
| Section E | Active Dialogue | ~8.0s | Consonant Clusters, Fast Transitions |
| **TOTAL** | **Full Balanced Corpus** | **~45.0s** | **100% (44/44 English Phonemes)** |

---

## 4. Ingestion & Quality Acceptance Gates

Before any recorded file is added to the `chocho v3` profile, the automated analyzer checks:
1. **Signal-to-Noise Ratio (SNR):** $\ge 22\text{ dB}$.
2. **Clipping Ratio:** $0.0\%$ (no digital overs).
3. **Speaker Consistency:** Resemblyzer embedding cosine similarity $\ge 75\%$ against canonical Chocho.
4. **Pitch Alignment:** Mean fundamental frequency ($F_0$) within $\pm 35\text{ Hz}$ of $237\text{ Hz}$.
