#!/usr/bin/env python3
"""
Phase 13J: Chocho Studio Reference Set Analyzer
Comprehensive audio signal quality, speaker consistency, and phonetic coverage analyzer.
"""

import sys
import os
import json
import time
import hashlib
import numpy as np
import soundfile as sf
import librosa
import torch

try:
    from resemblyzer import VoiceEncoder, preprocess_wav
except ImportError:
    VoiceEncoder = None

try:
    from faster_whisper import WhisperModel
except ImportError:
    WhisperModel = None

def sha256_file(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

class ReferenceAudioAnalyzer:
    def __init__(self, canonical_ref_path: str, device: str = "cpu"):
        self.canonical_ref_path = os.path.abspath(canonical_ref_path)
        self.device = device
        self.encoder = VoiceEncoder(device) if VoiceEncoder is not None else None
        self.whisper = WhisperModel("base", device=device, compute_type="int8") if WhisperModel is not None else None
        
        # Precompute canonical reference embedding & metrics
        if not os.path.exists(self.canonical_ref_path):
            raise FileNotFoundError(f"Canonical reference not found: {self.canonical_ref_path}")
        
        self.canonical_wav = preprocess_wav(self.canonical_ref_path) if self.encoder else None
        self.canonical_embed = self.encoder.embed_utterance(self.canonical_wav) if self.encoder else None
        
        y_can, sr_can = librosa.load(self.canonical_ref_path, sr=24000)
        f0_can, _, _ = librosa.pyin(y_can, fmin=65, fmax=2093, sr=sr_can)
        vf0_can = f0_can[~np.isnan(f0_can)]
        self.canonical_f0_mean = float(np.mean(vf0_can)) if len(vf0_can) > 0 else 237.0

    def analyze_audio_quality(self, file_path: str) -> dict:
        y, sr = librosa.load(file_path, sr=24000)
        dur = len(y) / sr
        peak = float(np.max(np.abs(y)))
        rms = float(np.sqrt(np.mean(y ** 2)))
        clipping_ratio = float(np.sum(np.abs(y) >= 0.999) / len(y)) if len(y) > 0 else 0.0
        dynamic_range_db = float(20 * np.log10(peak / max(rms, 1e-6))) if peak > 0 and rms > 0 else 0.0

        # Frame-level RMS for silence & SNR estimation
        hop_len = int(0.010 * sr)
        frame_len = int(0.025 * sr)
        rms_frames = librosa.feature.rms(y=y, frame_length=frame_len, hop_length=hop_len)[0]
        silence_thresh = max(0.005, peak * 0.05)
        silent_frames = rms_frames < silence_thresh
        silence_ratio = float(np.sum(silent_frames) / len(silent_frames)) if len(silent_frames) > 0 else 0.0
        active_speech_sec = float(dur * (1.0 - silence_ratio))

        # Estimated SNR
        noise_floor = np.percentile(rms_frames, 10) if len(rms_frames) > 0 else 1e-5
        speech_level = np.percentile(rms_frames, 90) if len(rms_frames) > 0 else 1.0
        estimated_snr_db = float(20 * np.log10(max(speech_level, 1e-5) / max(noise_floor, 1e-6)))

        # Spectral timbre metrics
        centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
        rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)))
        flatness = float(np.mean(librosa.feature.spectral_flatness(y=y)))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=y)))

        # F0 pitch metrics
        try:
            f0, voiced_flag, _ = librosa.pyin(y, fmin=65, fmax=2093, sr=sr)
            voiced_f0 = f0[~np.isnan(f0)]
            if len(voiced_f0) > 0:
                f0_mean = float(np.mean(voiced_f0))
                f0_std = float(np.std(voiced_f0))
                f0_min = float(np.min(voiced_f0))
                f0_max = float(np.max(voiced_f0))
                f0_range = float(f0_max - f0_min)
                voiced_ratio = float(np.sum(voiced_flag) / len(voiced_flag))
            else:
                f0_mean, f0_std, f0_min, f0_max, f0_range, voiced_ratio = 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
        except Exception:
            f0_mean, f0_std, f0_min, f0_max, f0_range, voiced_ratio = 0.0, 0.0, 0.0, 0.0, 0.0, 0.0

        # Formant peaks (F1, F2, F3)
        fft = np.abs(np.fft.rfft(y))
        freqs = np.fft.rfftfreq(len(y), 1.0 / sr)
        peaks = []
        for f_low, f_high in [(200, 1000), (1000, 2500), (2500, 4000)]:
            idx_range = np.where((freqs >= f_low) & (freqs <= f_high))[0]
            if len(idx_range) > 0:
                peak_idx = idx_range[np.argmax(fft[idx_range])]
                peaks.append(float(freqs[peak_idx]))
            else:
                peaks.append(0.0)

        return {
            "total_duration_sec": round(dur, 3),
            "active_speech_sec": round(active_speech_sec, 3),
            "silence_ratio": round(silence_ratio, 3),
            "peak": round(peak, 4),
            "rms": round(rms, 4),
            "clipping_ratio": round(clipping_ratio, 5),
            "dynamic_range_db": round(dynamic_range_db, 1),
            "estimated_snr_db": round(estimated_snr_db, 1),
            "spectral_centroid_hz": round(centroid, 1),
            "spectral_bandwidth_hz": round(bandwidth, 1),
            "spectral_rolloff_hz": round(rolloff, 1),
            "spectral_flatness": round(flatness, 6),
            "zero_crossing_rate": round(zcr, 4),
            "f0_mean_hz": round(f0_mean, 1),
            "f0_std_hz": round(f0_std, 1),
            "f0_min_hz": round(f0_min, 1),
            "f0_max_hz": round(f0_max, 1),
            "f0_range_hz": round(f0_range, 1),
            "voiced_ratio": round(voiced_ratio, 3),
            "estimated_formants_hz": {
                "F1": round(peaks[0], 1),
                "F2": round(peaks[1], 1),
                "F3": round(peaks[2], 1)
            }
        }

    def evaluate_speaker_consistency(self, file_path: str, quality_metrics: dict) -> dict:
        if not self.encoder or self.canonical_embed is None:
            return {"similarity": 0.0, "status": "EVALUATOR_UNAVAILABLE"}
        
        try:
            w = preprocess_wav(file_path)
            e = self.encoder.embed_utterance(w)
            sim = float(np.dot(self.canonical_embed, e) / (np.linalg.norm(self.canonical_embed) * np.linalg.norm(e))) * 100
        except Exception as err:
            return {"similarity": 0.0, "status": "EXTRACTION_ERROR", "error": str(err)}

        f0_delta = abs(quality_metrics["f0_mean_hz"] - self.canonical_f0_mean)
        
        # Rejection Criteria:
        rejection_reasons = []
        if sim < 75.0:
            rejection_reasons.append(f"Resemblyzer similarity below 75% threshold ({sim:.2f}%)")
        if f0_delta > 50.0:
            rejection_reasons.append(f"Fundamental pitch mismatch ({quality_metrics['f0_mean_hz']} Hz vs canonical {self.canonical_f0_mean:.1f} Hz, delta={f0_delta:.1f} Hz)")
        if quality_metrics["clipping_ratio"] > 0.01:
            rejection_reasons.append(f"Severe clipping detected ({quality_metrics['clipping_ratio']*100:.2f}%)")
        if quality_metrics["total_duration_sec"] < 1.0:
            rejection_reasons.append("Audio clip shorter than 1.0 second")

        is_consistent = len(rejection_reasons) == 0
        return {
            "resemblyzer_similarity_percent": round(sim, 2),
            "canonical_f0_mean_hz": round(self.canonical_f0_mean, 1),
            "f0_delta_hz": round(f0_delta, 1),
            "is_speaker_consistent": is_consistent,
            "rejection_reasons": rejection_reasons
        }

    def analyze_phonetic_content(self, file_path: str) -> dict:
        if not self.whisper:
            return {"transcription": "", "detected_language": "unknown", "phoneme_coverage": {}}

        try:
            segs, info = self.whisper.transcribe(file_path, beam_size=5)
            trans = " ".join([s.text.strip() for s in segs])
            lang = info.language
        except Exception as e:
            return {"transcription": "", "detected_language": "error", "error": str(e)}

        words = [w.lower().strip(".,!?:;\"'") for w in trans.split() if w.strip()]
        
        # Heuristic English phoneme mapping
        vowels_found = set()
        consonants_found = set()
        
        phoneme_patterns = {
            "vowels": {
                "/iː/": ["ee", "ea", "me", "meet", "we", "he"],
                "/ɪ/": ["i", "is", "in", "it", "with", "this"],
                "/e/": ["e", "hello", "delighted", "very"],
                "/æ/": ["a", "am", "caluva", "and", "plan"],
                "/ɑː/": ["ar", "calm", "father"],
                "/ɔː/": ["al", "all", "warm", "walk"],
                "/ʊ/": ["oo", "good", "would", "could", "put"],
                "/uː/": ["oo", "you", "to", "who", "two"],
                "/aɪ/": ["i", "ai", "like", "time", "my"],
                "/aʊ/": ["ou", "ow", "out", "now", "how"],
                "/oʊ/": ["o", "hello", "so", "also", "go"]
            },
            "consonants": {
                "/p/": ["p", "person", "plan", "put"],
                "/b/": ["b", "be", "before", "good"],
                "/t/": ["t", "to", "meet", "time"],
                "/d/": ["d", "delighted", "and", "do"],
                "/k/": ["k", "c", "caluva", "like", "could"],
                "/g/": ["g", "good", "go", "great"],
                "/f/": ["f", "follow", "first", "for"],
                "/v/": ["v", "caluva", "very", "voice"],
                "/θ/": ["th", "think", "thursday"],
                "/ð/": ["th", "this", "that", "the", "with"],
                "/s/": ["s", "so", "this", "see"],
                "/z/": ["z", "s", "is", "as", "pleased"],
                "/ʃ/": ["sh", "she", "shadow", "speech"],
                "/h/": ["h", "hello", "he", "how"],
                "/m/": ["m", "meet", "me", "am"],
                "/n/": ["n", "and", "in", "now"],
                "/l/": ["l", "hello", "caluva", "like"],
                "/r/": ["r", "very", "right", "record"],
                "/w/": ["w", "we", "will", "with"],
                "/j/": ["y", "you", "yeah", "yes"]
            }
        }

        full_text_lower = trans.lower()
        for p_sym, triggers in phoneme_patterns["vowels"].items():
            if any(t in full_text_lower for t in triggers):
                vowels_found.add(p_sym)
        for p_sym, triggers in phoneme_patterns["consonants"].items():
            if any(t in full_text_lower for t in triggers):
                consonants_found.add(p_sym)

        total_standard_phonemes = 44
        total_found = len(vowels_found) + len(consonants_found)
        coverage_percent = round((total_found / total_standard_phonemes) * 100, 1)

        return {
            "transcription": trans,
            "detected_language": lang,
            "word_count": len(words),
            "vowels_present": sorted(list(vowels_found)),
            "consonants_present": sorted(list(consonants_found)),
            "phoneme_count": total_found,
            "coverage_percent": coverage_percent
        }

    def process_candidate(self, file_path: str) -> dict:
        abs_p = os.path.abspath(file_path)
        sha = sha256_file(abs_p)
        quality = self.analyze_audio_quality(abs_p)
        consistency = self.evaluate_speaker_consistency(abs_p, quality)
        phonetics = self.analyze_phonetic_content(abs_p)

        # Calculate composite suitability score (0-100)
        # 40% speaker similarity + 25% SNR + 20% pitch dynamics + 15% phonetic coverage
        norm_sim = min(100.0, max(0.0, (consistency.get("resemblyzer_similarity_percent", 0.0) - 70.0) / 0.20))
        norm_snr = min(100.0, max(0.0, quality["estimated_snr_db"] * 3.0))
        norm_f0 = min(100.0, max(0.0, quality["f0_std_hz"] * 1.5))
        norm_phon = min(100.0, phonetics.get("coverage_percent", 0.0) * 2.0)

        composite_score = round(
            0.40 * norm_sim +
            0.25 * norm_snr +
            0.20 * norm_f0 +
            0.15 * norm_phon,
            2
        ) if consistency["is_speaker_consistent"] else 0.0

        return {
            "file_path": abs_p,
            "file_name": os.path.basename(abs_p),
            "sha256": sha,
            "quality": quality,
            "consistency": consistency,
            "phonetics": phonetics,
            "composite_score": composite_score,
            "status": "ACCEPTED" if consistency["is_speaker_consistent"] else "REJECTED"
        }

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Chocho Reference Set Analyzer")
    parser.add_argument("--canonical", default="tests/fidelity-optimization/ref_raw_24k.wav", help="Path to canonical reference WAV")
    parser.add_argument("--input-files", nargs="+", help="List of candidate audio files or directories to analyze")
    parser.add_argument("--output-json", default="storage/fidelity/chocho-reference-analysis.json", help="Path to save output JSON")
    args = parser.parse_args()

    analyzer = ReferenceAudioAnalyzer(args.canonical)

    candidates = []
    if args.input_files:
        for inp in args.input_files:
            if os.path.isdir(inp):
                for f in sorted(os.listdir(inp)):
                    if f.endswith(".wav") or f.endswith(".m4a"):
                        candidates.append(os.path.join(inp, f))
            elif os.path.isfile(inp):
                candidates.append(inp)

    results = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "canonical_reference": analyzer.canonical_ref_path,
        "canonical_sha256": sha256_file(analyzer.canonical_ref_path),
        "total_analyzed": len(candidates),
        "accepted": [],
        "rejected": []
    }

    print("=" * 80)
    print("PHASE 13J: CHOCHO REFERENCE SET ANALYZER")
    print("=" * 80)

    for c_path in candidates:
        res = analyzer.process_candidate(c_path)
        if res["status"] == "ACCEPTED":
            results["accepted"].append(res)
            print(f"  [ACCEPTED] {res['file_name']} (Sim={res['consistency']['resemblyzer_similarity_percent']}%, F0={res['quality']['f0_mean_hz']}Hz, Score={res['composite_score']})")
        else:
            results["rejected"].append(res)
            print(f"  [REJECTED] {res['file_name']} Reasons: {', '.join(res['consistency']['rejection_reasons'])}")

    # Sort accepted by composite score descending
    results["accepted"] = sorted(results["accepted"], key=lambda x: x["composite_score"], reverse=True)

    os.makedirs(os.path.dirname(os.path.abspath(args.output_json)), exist_ok=True)
    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\nAnalysis complete. Accepted: {len(results['accepted'])} | Rejected: {len(results['rejected'])}")
    print(f"Results saved to: {args.output_json}")

if __name__ == "__main__":
    main()
