#!/usr/bin/env python3
"""
Phase 13H: Voice Reference Set Quality & Speaker Consistency Diagnostic Tool
Analyzes individual candidate recordings and multi-reference sets for speaker identity, SNR, phonetic coverage, and consistency.
"""

import sys
import os
import math
import subprocess
import numpy as np
import soundfile as sf
import librosa
from resemblyzer import VoiceEncoder, preprocess_wav

def calculate_snr(audio: np.ndarray) -> float:
    """Estimate Signal-to-Noise Ratio (dB) via energy percentile ratio."""
    if len(audio) == 0:
        return 0.0
    energy = audio ** 2
    signal_energy = np.percentile(energy, 90)
    noise_energy = max(np.percentile(energy, 10), 1e-9)
    snr_db = 10 * np.log10(signal_energy / noise_energy)
    return float(np.clip(snr_db, 0.0, 60.0))

def analyze_audio_candidate(filepath: str, encoder: VoiceEncoder) -> dict:
    """Extract acoustic, quality, and speaker metrics from an individual audio candidate."""
    if not os.path.exists(filepath):
        return {"error": "File does not exist", "path": filepath}

    # Format convert to temporary 24kHz mono if necessary
    tmp_path = filepath
    cleanup = False
    try:
        data, sr = sf.read(filepath)
    except Exception:
        tmp_path = filepath + "_temp_24k.wav"
        subprocess.run(["ffmpeg", "-y", "-i", filepath, "-ac", "1", "-ar", "24000", tmp_path], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        data, sr = sf.read(tmp_path)
        cleanup = True

    if data.ndim > 1:
        data = data.mean(axis=1)

    duration = len(data) / sr
    rms = float(np.sqrt(np.mean(data ** 2)))
    peak = float(np.max(np.abs(data)))
    snr = calculate_snr(data)

    # Active speech & silence analysis
    non_silent_intervals = librosa.effects.split(data, top_db=40)
    speech_samples = sum(end - start for start, end in non_silent_intervals)
    speech_duration = speech_samples / sr
    silence_ratio = (duration - speech_duration) / max(duration, 0.01)

    # Spectral features
    spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=data, sr=sr)))
    spectral_bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=data, sr=sr)))
    
    # F0 pitch
    f0, voiced_flag, _ = librosa.pyin(data, fmin=60, fmax=500, sr=sr)
    f0_clean = f0[~np.isnan(f0)]
    f0_mean = float(np.mean(f0_clean)) if len(f0_clean) > 0 else 0.0
    f0_std = float(np.std(f0_clean)) if len(f0_clean) > 0 else 0.0

    # Resemblyzer embedding
    wav_proc = preprocess_wav(tmp_path)
    embedding = encoder.embed_utterance(wav_proc)

    if cleanup and os.path.exists(tmp_path):
        os.remove(tmp_path)

    # Quality scoring
    quality_score = 100.0
    reasons = []

    if duration < 1.0:
        quality_score -= 40
        reasons.append("Duration too short (<1s)")
    if snr < 15.0:
        quality_score -= 30
        reasons.append(f"Low SNR ({snr:.1f}dB < 15dB)")
    if peak >= 0.999:
        quality_score -= 25
        reasons.append("Clipping detected")
    if silence_ratio > 0.40:
        quality_score -= 20
        reasons.append(f"Excessive silence ({silence_ratio*100:.1f}%)")

    return {
        "path": filepath,
        "filename": os.path.basename(filepath),
        "duration": duration,
        "speech_duration": speech_duration,
        "silence_ratio": silence_ratio,
        "rms": rms,
        "peak": peak,
        "snr_db": snr,
        "f0_mean": f0_mean,
        "f0_std": f0_std,
        "spectral_centroid": spectral_centroid,
        "spectral_bandwidth": spectral_bandwidth,
        "quality_score": max(0.0, quality_score),
        "embedding": embedding,
        "flaws": reasons
    }

def analyze_reference_set(reference_paths: list, primary_reference_path: str = None) -> dict:
    """Analyze a multi-reference set against a primary speaker reference."""
    encoder = VoiceEncoder()
    candidates = []

    for p in reference_paths:
        if os.path.exists(p):
            cand = analyze_audio_candidate(p, encoder)
            candidates.append(cand)

    if not candidates:
        return {"error": "No valid candidates provided"}

    # Establish primary reference embedding
    if primary_reference_path and os.path.exists(primary_reference_path):
        prim_cand = analyze_audio_candidate(primary_reference_path, encoder)
        primary_emb = prim_cand["embedding"]
    else:
        primary_emb = candidates[0]["embedding"]

    # Calculate speaker consistency
    selected = []
    rejected = []
    
    for cand in candidates:
        emb = cand["embedding"]
        sim = float(np.dot(primary_emb, emb) / (np.linalg.norm(primary_emb) * np.linalg.norm(emb)))
        cand["similarity_to_primary"] = round(sim * 100, 2)
        
        # Candidate validation rules:
        # Same-speaker threshold >= 78.0%
        # Quality score >= 50.0
        if cand["similarity_to_primary"] < 78.0:
            cand["rejection_reason"] = f"Speaker inconsistency: {cand['similarity_to_primary']}% < 78.0% threshold"
            rejected.append(cand)
        elif cand["quality_score"] < 50.0:
            cand["rejection_reason"] = f"Poor acoustic quality score: {cand['quality_score']}/100 ({', '.join(cand['flaws'])})"
            rejected.append(cand)
        else:
            selected.append(cand)

    # Sort selected by quality score
    selected.sort(key=lambda x: x["quality_score"], reverse=True)

    # Remove raw embedding vectors before JSON serialization
    for c in candidates:
        if "embedding" in c:
            del c["embedding"]

    total_duration = sum(c["duration"] for c in selected)
    total_speech = sum(c["speech_duration"] for c in selected)
    mean_snr = float(np.mean([c["snr_db"] for c in selected])) if selected else 0.0
    mean_sim = float(np.mean([c["similarity_to_primary"] for c in selected])) if selected else 0.0

    return {
        "candidate_count": len(candidates),
        "selected_count": len(selected),
        "rejected_count": len(rejected),
        "total_selected_duration_sec": round(total_duration, 2),
        "total_selected_speech_duration_sec": round(total_speech, 2),
        "average_selected_snr_db": round(mean_snr, 2),
        "mean_speaker_consistency_percent": round(mean_sim, 2),
        "selected_references": selected,
        "rejected_references": rejected
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: python voice-reference-set-diagnostic.py <ref1> [ref2] [ref3] ...")
        sys.exit(1)

    ref_paths = sys.argv[1:]
    res = analyze_reference_set(ref_paths)
    import json
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()
