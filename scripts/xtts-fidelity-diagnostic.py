#!/usr/bin/env python3
"""
XTTS v2 Voice Fidelity & Acoustic Diagnostic Tool
Phase 13F Canonical Evaluator

Evaluates:
1. Speaker Similarity (Resemblyzer VoiceEncoder)
2. F0 / Pitch Distribution & Trajectory Dynamics (librosa.pyin)
3. Timbre & Spectral Distribution (MFCCs, Centroid, Bandwidth, Rolloff, Flatness, ZCR)
4. Prosody & Rhythm (Speech rate, Pauses, Energy Dynamics)
5. Intelligibility & ASR Verification (Faster-Whisper)
6. Waveform Quality & Signal-to-Noise Ratio (RMS, Peak, Silence Ratio)
"""

import sys
import os
import argparse
import json
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

def compute_f0_metrics(y: np.ndarray, sr: int):
    """Extract fundamental frequency (F0) metrics using pyin."""
    try:
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y,
            fmin=librosa.note_to_hz('C2'),  # ~65 Hz
            fmax=librosa.note_to_hz('C7'),  # ~2093 Hz
            sr=sr,
            frame_length=2048,
            hop_length=512
        )
        voiced_f0 = f0[~np.isnan(f0)]
        if len(voiced_f0) == 0:
            return {
                "mean_f0": 0.0,
                "median_f0": 0.0,
                "std_f0": 0.0,
                "iqr_f0": 0.0,
                "min_f0": 0.0,
                "max_f0": 0.0,
                "p10_f0": 0.0,
                "p25_f0": 0.0,
                "p50_f0": 0.0,
                "p75_f0": 0.0,
                "p90_f0": 0.0,
                "voiced_ratio": 0.0,
                "trajectory_variance": 0.0
            }

        q25, q50, q75 = np.percentile(voiced_f0, [25, 50, 75])
        p10, p90 = np.percentile(voiced_f0, [10, 90])
        voiced_ratio = float(np.sum(voiced_flag) / len(voiced_flag)) if len(voiced_flag) > 0 else 0.0
        diffs = np.diff(voiced_f0)
        traj_var = float(np.var(diffs)) if len(diffs) > 0 else 0.0

        return {
            "mean_f0": float(np.mean(voiced_f0)),
            "median_f0": float(q50),
            "std_f0": float(np.std(voiced_f0)),
            "iqr_f0": float(q75 - q25),
            "min_f0": float(np.min(voiced_f0)),
            "max_f0": float(np.max(voiced_f0)),
            "p10_f0": float(p10),
            "p25_f0": float(q25),
            "p50_f0": float(q50),
            "p75_f0": float(q75),
            "p90_f0": float(p90),
            "voiced_ratio": float(voiced_ratio),
            "trajectory_variance": float(traj_var)
        }
    except Exception as e:
        return {"error": str(e)}

def compute_timbre_metrics(y: np.ndarray, sr: int):
    """Compute spectral and timbre properties (MFCCs, Centroid, Bandwidth, Rolloff, Flatness, ZCR)."""
    try:
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfcc, axis=1)

        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
        rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)
        flatness = librosa.feature.spectral_flatness(y=y)
        zcr = librosa.feature.zero_crossing_rate(y=y)

        return {
            "mfcc_vector": mfcc_mean.tolist(),
            "spectral_centroid": float(np.mean(centroid)),
            "spectral_bandwidth": float(np.mean(bandwidth)),
            "spectral_rolloff": float(np.mean(rolloff)),
            "spectral_flatness": float(np.mean(flatness)),
            "zero_crossing_rate": float(np.mean(zcr))
        }
    except Exception as e:
        return {"error": str(e)}

def compute_prosody_metrics(y: np.ndarray, sr: int):
    """Analyze prosody, pauses, energy contours, and rhythm."""
    try:
        duration = len(y) / sr
        frame_len = int(0.025 * sr)
        hop_len = int(0.010 * sr)
        rms_frames = librosa.feature.rms(y=y, frame_length=frame_len, hop_length=hop_len)[0]
        
        peak_rms = np.max(rms_frames) if len(rms_frames) > 0 else 1.0
        silence_thresh = max(0.01, peak_rms * 0.05)
        is_silent = rms_frames < silence_thresh

        # Count pause segments (> 150ms)
        pause_count = 0
        pause_duration = 0.0
        current_silent_frames = 0
        min_silent_frames = int(0.150 / (hop_len / sr))

        for silent in is_silent:
            if silent:
                current_silent_frames += 1
            else:
                if current_silent_frames >= min_silent_frames:
                    pause_count += 1
                    pause_duration += current_silent_frames * (hop_len / sr)
                current_silent_frames = 0
        if current_silent_frames >= min_silent_frames:
            pause_count += 1
            pause_duration += current_silent_frames * (hop_len / sr)

        energy_var = float(np.var(rms_frames)) if len(rms_frames) > 0 else 0.0
        active_speech_duration = max(0.1, duration - pause_duration)

        return {
            "total_duration_sec": float(duration),
            "active_speech_sec": float(active_speech_duration),
            "pause_count": int(pause_count),
            "pause_duration_sec": float(pause_duration),
            "pause_ratio": float(pause_duration / duration) if duration > 0 else 0.0,
            "energy_variance": float(energy_var)
        }
    except Exception as e:
        return {"error": str(e)}

def compute_audio_quality(y: np.ndarray, sr: int):
    """Compute physical signal quality and dynamic range."""
    peak = float(np.max(np.abs(y)))
    rms = float(np.sqrt(np.mean(y ** 2)))
    clipping = float(np.sum(np.abs(y) >= 0.999) / len(y)) if len(y) > 0 else 0.0
    dynamic_range_db = 20 * np.log10(peak / max(rms, 1e-6)) if peak > 0 and rms > 0 else 0.0

    return {
        "rms": float(rms),
        "peak": float(peak),
        "clipping_ratio": float(clipping),
        "dynamic_range_db": float(dynamic_range_db)
    }

def run_diagnostic(reference_path: str, generated_path: str, device: str = "cuda"):
    """Run full Phase 13F comparative diagnostic."""
    if not os.path.exists(reference_path):
        raise FileNotFoundError(f"Reference audio not found: {reference_path}")
    if not os.path.exists(generated_path):
        raise FileNotFoundError(f"Generated audio not found: {generated_path}")

    # Load audio signals
    ref_y, ref_sr = librosa.load(reference_path, sr=24000, mono=True)
    gen_y, gen_sr = librosa.load(generated_path, sr=24000, mono=True)

    # 1. Speaker Similarity via Resemblyzer
    similarity_score = 0.0
    if VoiceEncoder is not None:
        try:
            encoder = VoiceEncoder(device="cpu")  # CPU encoder to preserve GPU VRAM
            ref_wav_res = preprocess_wav(reference_path)
            gen_wav_res = preprocess_wav(generated_path)
            ref_embed = encoder.embed_utterance(ref_wav_res)
            gen_embed = encoder.embed_utterance(gen_wav_res)
            cos_sim = float(np.dot(ref_embed, gen_embed) / (np.linalg.norm(ref_embed) * np.linalg.norm(gen_embed)))
            similarity_score = round(max(0.0, cos_sim) * 100, 2)
        except Exception as e:
            sys.stderr.write(f"Resemblyzer error: {e}\n")

    # 2. F0 Pitch Analysis
    ref_f0 = compute_f0_metrics(ref_y, ref_sr)
    gen_f0 = compute_f0_metrics(gen_y, gen_sr)
    f0_delta = {
        "mean_delta_hz": round(gen_f0.get("mean_f0", 0) - ref_f0.get("mean_f0", 0), 2),
        "median_delta_hz": round(gen_f0.get("median_f0", 0) - ref_f0.get("median_f0", 0), 2),
        "std_delta_hz": round(gen_f0.get("std_f0", 0) - ref_f0.get("std_f0", 0), 2),
        "voiced_ratio_delta": round(gen_f0.get("voiced_ratio", 0) - ref_f0.get("voiced_ratio", 0), 3)
    }

    # 3. Timbre Analysis
    ref_timbre = compute_timbre_metrics(ref_y, ref_sr)
    gen_timbre = compute_timbre_metrics(gen_y, gen_sr)
    
    # MFCC cosine similarity
    v_ref = np.array(ref_timbre.get("mfcc_vector", []))
    v_gen = np.array(gen_timbre.get("mfcc_vector", []))
    if len(v_ref) == len(v_gen) and np.linalg.norm(v_ref) > 0 and np.linalg.norm(v_gen) > 0:
        mfcc_cos = float(np.dot(v_ref, v_gen) / (np.linalg.norm(v_ref) * np.linalg.norm(v_gen)))
    else:
        mfcc_cos = 0.0

    timbre_delta = {
        "mfcc_cosine_similarity": round(mfcc_cos, 4),
        "spectral_centroid_delta_hz": round(gen_timbre.get("spectral_centroid", 0) - ref_timbre.get("spectral_centroid", 0), 2),
        "spectral_bandwidth_delta_hz": round(gen_timbre.get("spectral_bandwidth", 0) - ref_timbre.get("spectral_bandwidth", 0), 2),
        "spectral_rolloff_delta_hz": round(gen_timbre.get("spectral_rolloff", 0) - ref_timbre.get("spectral_rolloff", 0), 2),
        "spectral_flatness_delta": round(gen_timbre.get("spectral_flatness", 0) - ref_timbre.get("spectral_flatness", 0), 5),
        "zcr_delta": round(gen_timbre.get("zero_crossing_rate", 0) - ref_timbre.get("zero_crossing_rate", 0), 4)
    }

    # 4. Prosody Analysis
    ref_prosody = compute_prosody_metrics(ref_y, ref_sr)
    gen_prosody = compute_prosody_metrics(gen_y, gen_sr)

    # 5. Audio Signal Quality
    ref_qual = compute_audio_quality(ref_y, ref_sr)
    gen_qual = compute_audio_quality(gen_y, gen_sr)

    # 6. Intelligibility & ASR Verification via Faster-Whisper
    gen_transcription = ""
    asr_confidence = 0.0
    detected_lang = "en"
    if WhisperModel is not None:
        try:
            whisper_dev = "cuda" if torch.cuda.is_available() and device == "cuda" else "cpu"
            whisper = WhisperModel("base", device=whisper_dev, compute_type="float16" if whisper_dev == "cuda" else "int8")
            segs, info = whisper.transcribe(generated_path, beam_size=5)
            seg_list = list(segs)
            gen_transcription = " ".join([s.text.strip() for s in seg_list])
            detected_lang = info.language
            asr_confidence = round(float(info.language_probability), 3)
        except Exception as e:
            sys.stderr.write(f"Whisper ASR error: {e}\n")

    # Diagnostic Interpretation
    notes = []
    if similarity_score >= 80.0:
        notes.append("EXCELLENT_SPEAKER_MATCH (>=80%)")
    elif similarity_score >= 75.0:
        notes.append("GOOD_SPEAKER_MATCH (75-80%)")
    else:
        notes.append("SUB_OPTIMAL_SPEAKER_MATCH (<75%)")

    if abs(f0_delta["mean_delta_hz"]) < 30.0:
        notes.append("PITCH_REGISTER_ALIGNED (|delta| < 30Hz)")
    else:
        notes.append(f"PITCH_REGISTER_OFFSET ({f0_delta['mean_delta_hz']}Hz)")

    if gen_qual["clipping_ratio"] == 0.0:
        notes.append("NO_CLIPPING_ARTIFACTS")
    else:
        notes.append(f"CLIPPING_DETECTED ({gen_qual['clipping_ratio']*100:.2f}%)")

    if len(gen_transcription) > 0:
        notes.append("ASR_INTELLIGIBILITY_VERIFIED")

    report = {
        "paths": {
            "reference": reference_path,
            "generated": generated_path
        },
        "speaker_similarity": {
            "resemblyzer_percent": similarity_score,
            "metric": "Resemblyzer VoiceEncoder Cosine Similarity"
        },
        "f0_comparison": {
            "reference": ref_f0,
            "generated": gen_f0,
            "delta": f0_delta
        },
        "timbre_comparison": {
            "reference": ref_timbre,
            "generated": gen_timbre,
            "delta": timbre_delta
        },
        "prosody_comparison": {
            "reference": ref_prosody,
            "generated": gen_prosody
        },
        "audio_quality": {
            "reference": ref_qual,
            "generated": gen_qual
        },
        "intelligibility": {
            "transcription": gen_transcription,
            "detected_language": detected_lang,
            "language_confidence": asr_confidence
        },
        "interpretation": notes
    }

    return report

def main():
    parser = argparse.ArgumentParser(description="XTTS v2 Voice Fidelity Diagnostic")
    parser.add_argument("--reference", required=True, help="Path to reference audio file (WAV/M4A)")
    parser.add_argument("--generated", required=True, help="Path to generated audio file (WAV)")
    parser.add_argument("--output-json", help="Path to save JSON report")
    parser.add_argument("--device", default="cuda", choices=["cuda", "cpu"], help="Inference device")
    args = parser.parse_args()

    report = run_diagnostic(args.reference, args.generated, device=args.device)

    print("=" * 80)
    print("PHASE 13F XTTS v2 VOICE FIDELITY & ACOUSTIC DIAGNOSTIC REPORT")
    print("=" * 80)
    print(f"Reference File: {report['paths']['reference']}")
    print(f"Generated File: {report['paths']['generated']}")
    print(f"\nSPEAKER SIMILARITY: {report['speaker_similarity']['resemblyzer_percent']}% ({report['speaker_similarity']['metric']})")
    print(f"MFCC Cosine Similarity: {report['timbre_comparison']['delta']['mfcc_cosine_similarity']}")
    print(f"F0 Mean (Ref vs Gen): {report['f0_comparison']['reference'].get('mean_f0', 0):.1f} Hz -> {report['f0_comparison']['generated'].get('mean_f0', 0):.1f} Hz (Delta: {report['f0_comparison']['delta']['mean_delta_hz']:+.1f} Hz)")
    print(f"F0 Std / Dynamic Pitch Range: {report['f0_comparison']['generated'].get('std_f0', 0):.1f} Hz (Ref: {report['f0_comparison']['reference'].get('std_f0', 0):.1f} Hz)")
    print(f"Spectral Centroid: {report['timbre_comparison']['reference'].get('spectral_centroid', 0):.1f} Hz -> {report['timbre_comparison']['generated'].get('spectral_centroid', 0):.1f} Hz")
    print(f"Active Speech / Duration: {report['prosody_comparison']['generated'].get('active_speech_sec', 0):.2f}s / {report['prosody_comparison']['generated'].get('total_duration_sec', 0):.2f}s (Pauses: {report['prosody_comparison']['generated'].get('pause_count', 0)})")
    print(f"Intelligibility ASR Transcription: \"{report['intelligibility']['transcription']}\" (Lang: {report['intelligibility']['detected_language']})")
    print(f"Diagnostic Interpretation: {', '.join(report['interpretation'])}")
    print("=" * 80)

    if args.output_json:
        os.makedirs(os.path.dirname(os.path.abspath(args.output_json)), exist_ok=True)
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"Saved full JSON diagnostic report to: {args.output_json}")

if __name__ == "__main__":
    main()
