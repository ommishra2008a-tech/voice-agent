# Phase 13H Multi-Reference Speaker Conditioning Experiments

**Date:** August 2026  
**Target Voice:** `chocho`  
**Model:** XTTS v2 (`TTS==0.22.0`)  
**Hardware:** NVIDIA GeForce RTX 3050 6GB Laptop GPU  

---

## 1. Experimental Configurations (Canonical Benchmark)

**Sentence:** *"Welcome to the voice AI studio, where neural speech synthesis brings natural voices to life."*

| Configuration | Ref Count | Total Duration | Latency | Resemblyzer Sim | MFCC Sim | F0 Std | Intelligibility |
|---|---|---|---|---|---|---|---|
| **REF-A (Canonical Single v1)** | 1 | 8.21s | 10.93s | 78.82% | 0.9924 | 39.4 Hz | 100% |
| **REF-B (Best Single Segment)** | 1 | 7.80s | 10.31s | 80.09% | 0.9948 | 45.3 Hz | 100% |
| **REF-C (2-Reference Set)** | 2 | 8.41s | 9.82s | 77.48% | 0.9864 | 46.8 Hz | 100% |
| **REF-D (3-Reference Set)** | 3 | 16.21s | 8.57s | 78.21% | 0.9853 | 32.0 Hz | 100% |
| **REF-E (4-Reference Set)** | 4 | 22.51s | 5.95s | 78.49% | 0.9802 | 26.1 Hz | 100% |
| **REF-F (5-Reference Set v2)** | **5** | **30.72s** | **8.16s** | **83.77%** | **0.9896** | **53.4 Hz** | **100%** |

**Canonical Finding:** REF-F (5-Reference Set) achieves **83.77% speaker similarity**, delivering a **+4.95% boost** over the canonical single-reference baseline.

---

## 2. Multi-Text Consistency Benchmark (10 Diverse Sentences)

| Text Modality | Single-Ref v1 Sim | Multi-Ref v2 Sim | Delta | Faster-Whisper ASR |
|---|---|---|---|---|
| `text_01_statement` | 75.28% | 78.08% | **+2.80%** | 100% Intelligible |
| `text_02_question` | 79.38% | 79.84% | **+0.46%** | 100% Intelligible |
| `text_03_conversational` | 77.88% | 77.08% | -0.80% | 100% Intelligible |
| `text_04_long` | 76.47% | 79.78% | **+3.31%** | 100% Intelligible |
| `text_05_comma_heavy` | 79.51% | 80.54% | **+1.03%** | 100% Intelligible |
| `text_06_calm` | 78.63% | 78.82% | **+0.19%** | 100% Intelligible |
| `text_07_energetic` | 75.11% | 75.56% | **+0.45%** | 100% Intelligible |
| `text_08_emotional` | 75.66% | 79.94% | **+4.28%** | 100% Intelligible |
| `text_09_multi_clause` | 78.49% | 77.91% | -0.58% | 100% Intelligible |
| `text_10_dialogue` | 76.21% | 77.69% | **+1.48%** | 100% Intelligible |
| **Mean Across Sentences** | **77.26%** | **78.52%** | **+1.26%** | **100% Word Accuracy** |

---

## 3. Summary of Gains & Verification

1. **Speaker Identity:** Multi-reference conditioning increases mean similarity from 77.26% to 78.52% across 10 modalities, and reaches 83.77% on canonical text.
2. **Prosody & Naturalness:** Pitch inflection is preserved with mean F0 std > 38 Hz.
3. **ASR Intelligibility:** Zero word drops or audio artifacts across all 20 generated test utterances.
4. **Matched Listening Pairs:** Generated and saved under `storage/ab_listening/phase13h/`.
