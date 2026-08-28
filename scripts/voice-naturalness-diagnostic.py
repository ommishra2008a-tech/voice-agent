#!/usr/bin/env python3
"""
Voice Naturalness, Prosody & Expressiveness Diagnostic Tool (Phase 13D)
Usage:
    python scripts/voice-naturalness-diagnostic.py --reference REF_PATH --generated GEN_PATH [--expected-text "text"] [--output OUT_JSON]

Measures:
1. Speaker Identity (Resemblyzer cosine similarity)
2. Pitch Dynamics (F0 mean, median, std, IQR, min/max, range, voiced ratio, trajectory variance, contour smoothness)
3. Prosody Dynamics (Speech rate, pause frequency, pause durations, rhythm regularity, nPVI)
4. Energy Dynamics (RMS mean/std, dynamic range dB, crest factor, energy variance)
5. Spectral & Timbre (Centroid, bandwidth, rolloff, flatness, ZCR, MFCC cosine similarity)
6. Intelligibility (Faster-Whisper transcription, word match / WER against expected text)
7. Humanness & Naturalness Scorecard (Robotic artifact penalty, Expressiveness, Naturalness)
"""
import argparse
import os
import sys
import wave
import subprocess
import json
import numpy as np


def probe_audio(path):
    """Probe audio file metadata via ffprobe."""
    try:
        cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", path]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        data = json.loads(res.stdout)
        stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), {})
        fmt = data.get("format", {})
        return {
            "codec": stream.get("codec_name"),
            "sample_rate": int(stream.get("sample_rate", 0)),
            "channels": int(stream.get("channels", 0)),
            "duration_sec": float(fmt.get("duration", 0)),
            "size_bytes": os.path.getsize(path) if os.path.exists(path) else 0,
        }
    except Exception as e:
        return {"error": str(e)}


def convert_to_wav_24k(input_path, output_path):
    """Convert any audio file to 24kHz mono PCM WAV."""
    cmd = ["ffmpeg", "-y", "-i", input_path, "-vn", "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", output_path]
    subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    return os.path.exists(output_path) and os.path.getsize(output_path) > 100


def load_wav_pcm(path):
    """Load WAV file as float32 array in [-1.0, 1.0] range and return samples, sr."""
    with wave.open(path, 'rb') as wf:
        sr = wf.getframerate()
        nch = wf.getnchannels()
        nsamp = wf.getnframes()
        raw = wf.readframes(nsamp)
    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if nch > 1:
        samples = samples[::nch]
    return samples, sr


def compute_f0_yin(samples, sr, fmin=60, fmax=500):
    """
    Compute detailed F0 pitch contour using YIN-based autocorrelation.
    Returns dictionary with rich pitch dynamics metrics.
    """
    frame_len = int(0.030 * sr)  # 30ms frames
    hop = int(0.010 * sr)        # 10ms hop
    tau_min = int(sr / fmax)
    tau_max = min(int(sr / fmin), frame_len)
    
    f0_values = []
    n_frames = max(1, (len(samples) - frame_len) // hop)
    
    for i in range(min(n_frames, 1200)):
        start = i * hop
        frame = samples[start:start + frame_len]
        if len(frame) < frame_len:
            break
            
        # Energy check - skip near-silent frames
        frame_rms = np.sqrt(np.mean(frame ** 2))
        if frame_rms < 0.01:
            continue
            
        # YIN difference function
        d = np.zeros(tau_max)
        for tau in range(tau_min, tau_max):
            diff = frame[:frame_len - tau] - frame[tau:frame_len]
            d[tau] = np.sum(diff ** 2)
            
        # Cumulative mean normalized difference
        d_prime = np.ones(tau_max)
        running = 0.0
        for tau in range(tau_min, tau_max):
            running += d[tau]
            d_prime[tau] = d[tau] * tau / running if running > 0 else 1.0
            
        # Find best candidate
        threshold = 0.15
        best_tau = 0
        for tau in range(tau_min, tau_max):
            if d_prime[tau] < threshold:
                best_tau = tau
                break
        if best_tau == 0 and tau_max > tau_min:
            best_tau = tau_min + np.argmin(d_prime[tau_min:tau_max])
            
        if best_tau > 0:
            f0 = sr / best_tau
            if fmin <= f0 <= fmax:
                f0_values.append(f0)
                
    total_frames = max(1, n_frames)
    voiced_ratio = len(f0_values) / total_frames
    
    if len(f0_values) < 5:
        return {
            "f0_mean": 0.0, "f0_median": 0.0, "f0_std": 0.0, "f0_iqr": 0.0,
            "f0_min": 0.0, "f0_max": 0.0, "f0_range": 0.0,
            "voiced_ratio": round(voiced_ratio, 3),
            "pitch_trajectory_variance": 0.0, "contour_smoothness": 0.0,
            "f0_contour_len": len(f0_values)
        }
        
    f0_arr = np.array(f0_values)
    f0_diff = np.diff(f0_arr)
    q25, q75 = np.percentile(f0_arr, [25, 75])
    
    return {
        "f0_mean": round(float(np.mean(f0_arr)), 2),
        "f0_median": round(float(np.median(f0_arr)), 2),
        "f0_std": round(float(np.std(f0_arr)), 2),
        "f0_iqr": round(float(q75 - q25), 2),
        "f0_min": round(float(np.min(f0_arr)), 2),
        "f0_max": round(float(np.max(f0_arr)), 2),
        "f0_range": round(float(np.max(f0_arr) - np.min(f0_arr)), 2),
        "voiced_ratio": round(voiced_ratio, 3),
        "pitch_trajectory_variance": round(float(np.var(f0_diff)), 2),
        "contour_smoothness": round(float(np.mean(np.abs(f0_diff))), 2),
        "f0_contour_len": len(f0_values)
    }


def compute_prosody_and_pauses(samples, sr, frame_ms=25, hop_ms=10):
    """
    Analyze pauses, speech rate, and rhythmic dynamics.
    """
    duration_sec = len(samples) / sr
    frame_len = int(frame_ms * sr / 1000)
    hop_len = int(hop_ms * sr / 1000)
    
    # Frame-wise RMS energy in dB
    n_frames = max(1, (len(samples) - frame_len) // hop_len)
    energies = []
    for i in range(n_frames):
        st = i * hop_len
        fr = samples[st:st + frame_len]
        rms = np.sqrt(np.mean(fr ** 2))
        energies.append(rms)
    energies = np.array(energies)
    
    max_energy = np.max(energies) if len(energies) > 0 and np.max(energies) > 0 else 1e-4
    silence_thresh = max_energy * 0.05  # 5% of peak energy
    
    is_silent = energies < silence_thresh
    
    # Detect pause segments (continuous silence >= 120ms)
    min_pause_frames = int(120 / hop_ms)  # 12 frames = 120ms
    pauses = []
    current_pause_len = 0
    
    for silent in is_silent:
        if silent:
            current_pause_len += 1
        else:
            if current_pause_len >= min_pause_frames:
                pauses.append(current_pause_len * hop_ms / 1000.0)
            current_pause_len = 0
    if current_pause_len >= min_pause_frames:
        pauses.append(current_pause_len * hop_ms / 1000.0)
        
    total_pause_sec = sum(pauses)
    speech_time_sec = max(0.1, duration_sec - total_pause_sec)
    
    # Normalized pairwise variability index (nPVI) for syllable/segment rhythm
    # High nPVI = expressive stress-timed language (like English)
    # Low nPVI = monotonic/robotic speech
    active_segment_lens = []
    cur_seg = 0
    for silent in is_silent:
        if not silent:
            cur_seg += 1
        else:
            if cur_seg >= 4:  # At least 40ms speech
                active_segment_lens.append(cur_seg * hop_ms)
            cur_seg = 0
    if cur_seg >= 4:
        active_segment_lens.append(cur_seg * hop_ms)
        
    npvi = 0.0
    if len(active_segment_lens) >= 2:
        diffs = []
        for i in range(len(active_segment_lens) - 1):
            d_k = active_segment_lens[i]
            d_k1 = active_segment_lens[i + 1]
            if (d_k + d_k1) > 0:
                diffs.append(abs(d_k - d_k1) / ((d_k + d_k1) / 2.0))
        if diffs:
            npvi = float(100.0 / len(diffs) * np.sum(diffs))
            
    return {
        "duration_sec": round(duration_sec, 2),
        "speech_time_sec": round(speech_time_sec, 2),
        "total_pause_sec": round(total_pause_sec, 2),
        "pause_count": len(pauses),
        "mean_pause_sec": round(float(np.mean(pauses)), 3) if pauses else 0.0,
        "max_pause_sec": round(float(np.max(pauses)), 3) if pauses else 0.0,
        "pause_frequency_per_sec": round(len(pauses) / max(0.5, duration_sec), 3),
        "speech_ratio": round(speech_time_sec / max(0.1, duration_sec), 3),
        "rhythm_npvi": round(npvi, 2),
        "speech_segments_count": len(active_segment_lens)
    }


def compute_energy_dynamics(samples):
    """Compute RMS energy dynamics and crest factor."""
    rms = float(np.sqrt(np.mean(samples ** 2)))
    peak = float(np.max(np.abs(samples))) if len(samples) > 0 else 0.0
    crest_factor = float(peak / (rms + 1e-6))
    
    # Syllable/chunk level energy variation (50ms chunks)
    chunk_size = 1200  # 50ms at 24kHz
    n_chunks = max(1, len(samples) // chunk_size)
    chunk_rms = [float(np.sqrt(np.mean(samples[i*chunk_size:(i+1)*chunk_size] ** 2))) for i in range(n_chunks)]
    chunk_rms = np.array(chunk_rms)
    
    # Dynamic range in dB
    min_rms_floor = max(1e-5, float(np.percentile(chunk_rms, 10)))
    max_rms_peak = max(1e-4, float(np.percentile(chunk_rms, 95)))
    dynamic_range_db = float(20.0 * np.log10(max_rms_peak / min_rms_floor))
    
    return {
        "rms_mean": round(rms, 4),
        "rms_std": round(float(np.std(chunk_rms)), 4),
        "peak": round(peak, 4),
        "crest_factor": round(crest_factor, 2),
        "dynamic_range_db": round(dynamic_range_db, 2),
        "energy_std_to_mean_ratio": round(float(np.std(chunk_rms) / (rms + 1e-6)), 3)
    }


def compute_spectral_timbre(samples, sr, n_mfcc=13):
    """Compute spectral features and MFCCs."""
    fft = np.abs(np.fft.rfft(samples))
    freqs = np.fft.rfftfreq(len(samples), 1.0 / sr)
    total_energy = np.sum(fft)
    if total_energy == 0:
        return {}
        
    centroid = float(np.sum(freqs * fft) / total_energy)
    bandwidth = float(np.sqrt(np.sum(((freqs - centroid) ** 2) * fft) / total_energy))
    cumsum = np.cumsum(fft)
    rolloff_idx = np.searchsorted(cumsum, 0.85 * cumsum[-1])
    rolloff = float(freqs[min(rolloff_idx, len(freqs) - 1)])
    
    # Spectral flatness (geometric mean / arithmetic mean of power spectrum)
    power = (fft ** 2) + 1e-12
    geom_mean = np.exp(np.mean(np.log(power)))
    arith_mean = np.mean(power)
    flatness = float(geom_mean / arith_mean)
    
    zcr = float(np.sum(np.abs(np.diff(np.sign(samples))) > 0) / max(1, len(samples)))
    
    # Mel Filterbank MFCC
    frame_len = int(0.025 * sr)
    hop_len = int(0.010 * sr)
    n_fft = 512
    n_mels = 40
    low_mel = 2595 * np.log10(1 + 0 / 700)
    high_mel = 2595 * np.log10(1 + sr / 2 / 700)
    mel_pts = np.linspace(low_mel, high_mel, n_mels + 2)
    hz_pts = 700 * (10 ** (mel_pts / 2595) - 1)
    bins = np.floor((n_fft + 1) * hz_pts / sr).astype(int)
    fbank = np.zeros((n_mels, n_fft // 2 + 1))
    for m in range(1, n_mels + 1):
        for k in range(bins[m - 1], bins[m]):
            if bins[m] != bins[m - 1]:
                fbank[m - 1, k] = (k - bins[m - 1]) / (bins[m] - bins[m - 1])
        for k in range(bins[m], bins[m + 1]):
            if bins[m + 1] != bins[m]:
                fbank[m - 1, k] = (bins[m + 1] - k) / (bins[m + 1] - bins[m])
                
    n_frames = max(1, (len(samples) - frame_len) // hop_len + 1)
    mfccs = []
    for i in range(min(n_frames, 600)):
        st = i * hop_len
        fr = samples[st:st + frame_len]
        if len(fr) < frame_len:
            fr = np.pad(fr, (0, frame_len - len(fr)))
        fr = fr * np.hamming(frame_len)
        mag = np.abs(np.fft.rfft(fr, n=n_fft))[:n_fft // 2 + 1]
        mel_spec = np.dot(fbank, mag)
        mel_spec = np.where(mel_spec == 0, np.finfo(float).eps, mel_spec)
        log_mel = np.log(mel_spec)
        dct = np.zeros(n_mfcc)
        for j in range(n_mfcc):
            dct[j] = np.sum(log_mel * np.cos(np.pi * j * (2 * np.arange(n_mels) + 1) / (2 * n_mels)))
        mfccs.append(dct)
    mfccs = np.array(mfccs)
    mfcc_mean = np.mean(mfccs, axis=0) if len(mfccs) > 0 else np.zeros(n_mfcc)
    
    return {
        "spectral_centroid": round(centroid, 2),
        "spectral_bandwidth": round(bandwidth, 2),
        "spectral_rolloff": round(rolloff, 2),
        "spectral_flatness": round(flatness, 6),
        "zero_crossing_rate": round(zcr, 5),
        "mfcc_mean": [round(float(x), 4) for x in mfcc_mean]
    }


def compute_resemblyzer_similarity(ref_wav, gen_wav):
    """Compute speaker embedding cosine similarity using Resemblyzer."""
    try:
        from resemblyzer import VoiceEncoder, preprocess_wav
        enc = VoiceEncoder()
        r = enc.embed_utterance(preprocess_wav(ref_wav))
        g = enc.embed_utterance(preprocess_wav(gen_wav))
        sim = float(np.dot(r, g) / (np.linalg.norm(r) * np.linalg.norm(g)))
        return round(sim, 6)
    except Exception as e:
        return f"error: {e}"


def compute_intelligibility_stt(audio_path, expected_text=None):
    """Transcribe audio with Faster-Whisper and calculate word match accuracy."""
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("base", device="cuda" if os.environ.get("CUDA_VISIBLE_DEVICES", "0") != "-1" else "cpu", compute_type="float16" if os.environ.get("CUDA_VISIBLE_DEVICES", "0") != "-1" else "int8")
        segments, info = model.transcribe(audio_path, beam_size=5)
        transcript = " ".join([seg.text.strip() for seg in segments]).strip()
        
        word_accuracy = None
        wer = None
        if expected_text and len(expected_text.strip()) > 0:
            exp_words = [w.lower().strip(".,!?;:\"'") for w in expected_text.split() if w.strip()]
            gen_words = [w.lower().strip(".,!?;:\"'") for w in transcript.split() if w.strip()]
            
            # Simple Levenshtein distance on words
            import difflib
            matcher = difflib.SequenceMatcher(None, exp_words, gen_words)
            word_accuracy = round(float(matcher.ratio() * 100.0), 2)
            wer = round(float((1.0 - matcher.ratio()) * 100.0), 2)
            
        return {
            "transcript": transcript,
            "language": info.language,
            "language_probability": round(float(info.language_probability), 3),
            "word_accuracy_pct": word_accuracy,
            "wer_pct": wer
        }
    except Exception as e:
        return {"transcript": None, "error": str(e), "word_accuracy_pct": None}


def evaluate_humanness_scorecard(f0_data, prosody_data, energy_data, sim_score, stt_data):
    """
    Score humanness, naturalness, prosody and robotic artifacts.
    Produces separate subscores and composite index.
    """
    # 1. Pitch expressiveness (human standard std: 35-80 Hz, IQR: 25-60 Hz)
    f0_std = f0_data.get("f0_std", 0.0)
    f0_iqr = f0_data.get("f0_iqr", 0.0)
    pitch_score = min(100.0, max(0.0, (f0_std / 50.0) * 100.0))
    
    # Monotone / robotic penalty if pitch std < 20 Hz
    robotic_pitch_penalty = max(0.0, (20.0 - f0_std) * 3.5) if f0_std < 20.0 else 0.0
    
    # 2. Rhythm & Prosody expressiveness (nPVI 40-75 is natural conversational English)
    npvi = prosody_data.get("rhythm_npvi", 0.0)
    if npvi >= 35.0:
        rhythm_score = min(100.0, 70.0 + (npvi - 35.0) * 0.8)
    else:
        rhythm_score = max(20.0, (npvi / 35.0) * 70.0)
        
    # 3. Dynamic energy variation (dynamic range > 15 dB is natural)
    dr_db = energy_data.get("dynamic_range_db", 0.0)
    energy_score = min(100.0, max(20.0, (dr_db / 22.0) * 100.0))
    
    # 4. Intelligibility score
    intel_score = stt_data.get("word_accuracy_pct") or 85.0
    
    # 5. Composite Naturalness Score (0-100)
    raw_naturalness = (pitch_score * 0.35 + rhythm_score * 0.35 + energy_score * 0.30) - robotic_pitch_penalty
    composite_naturalness = round(min(100.0, max(10.0, raw_naturalness)), 2)
    
    # Robotic Artifact Level: LOW, MODERATE, HIGH
    if robotic_pitch_penalty > 30 or f0_std < 18.0 or dr_db < 10.0:
        artifact_level = "HIGH (Robotic Monotone Delivery Detected)"
    elif robotic_pitch_penalty > 10 or f0_std < 28.0 or dr_db < 14.0:
        artifact_level = "MODERATE (Some Flatness / Mechanical Rhythm)"
    else:
        artifact_level = "LOW (Natural Dynamic Voice Delivery)"
        
    return {
        "pitch_expressiveness_score": round(pitch_score, 1),
        "rhythm_prosody_score": round(rhythm_score, 1),
        "energy_dynamics_score": round(energy_score, 1),
        "intelligibility_score": round(intel_score, 1),
        "robotic_monotone_penalty": round(robotic_pitch_penalty, 1),
        "robotic_artifact_level": artifact_level,
        "composite_naturalness_score": composite_naturalness
    }


def main():
    parser = argparse.ArgumentParser(description="Voice Naturalness & Prosody Diagnostic Tool")
    parser.add_argument("--reference", required=True, help="Path to reference audio file")
    parser.add_argument("--generated", required=True, help="Path to generated audio file")
    parser.add_argument("--expected-text", default=None, help="Expected transcript text for intelligibility measurement")
    parser.add_argument("--output", default=None, help="Optional output JSON path")
    args = parser.parse_args()

    if not os.path.exists(args.reference):
        print(f"ERROR: Reference audio not found: {args.reference}", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(args.generated):
        print(f"ERROR: Generated audio not found: {args.generated}", file=sys.stderr)
        sys.exit(1)

    tmp_dir = os.path.join(os.path.dirname(args.generated), ".nat_diag_tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    
    ref_wav = os.path.join(tmp_dir, "ref_24k.wav")
    gen_wav = os.path.join(tmp_dir, "gen_24k.wav")
    convert_to_wav_24k(args.reference, ref_wav)
    convert_to_wav_24k(args.generated, gen_wav)
    
    ref_samples, ref_sr = load_wav_pcm(ref_wav)
    gen_samples, gen_sr = load_wav_pcm(gen_wav)
    
    print("=" * 80)
    print("VOICE NATURALNESS, PROSODY & EXPRESSIVENESS DIAGNOSTIC REPORT")
    print("=" * 80)
    
    # 1. Probe info
    ref_meta = probe_audio(args.reference)
    gen_meta = probe_audio(args.generated)
    print(f"\n[FILES]")
    print(f"  Reference: {os.path.basename(args.reference)} ({ref_meta.get('codec')}, {ref_meta.get('sample_rate')}Hz, {ref_meta.get('duration_sec', 0):.2f}s)")
    print(f"  Generated: {os.path.basename(args.generated)} ({gen_meta.get('codec')}, {gen_meta.get('sample_rate')}Hz, {gen_meta.get('duration_sec', 0):.2f}s)")
    
    # 2. Resemblyzer speaker identity
    sim_score = compute_resemblyzer_similarity(ref_wav, gen_wav)
    print(f"\n[SPEAKER IDENTITY]")
    print(f"  Resemblyzer Cosine Similarity: {sim_score} ({sim_score * 100:.2f}% if float else '')" if isinstance(sim_score, float) else f"  Resemblyzer: {sim_score}")
    
    # 3. Pitch dynamics
    ref_f0 = compute_f0_yin(ref_samples, ref_sr)
    gen_f0 = compute_f0_yin(gen_samples, gen_sr)
    print(f"\n[PITCH DYNAMICS (F0)]")
    print(f"  {'Metric':<28} {'Reference':>14} {'Generated':>14} {'Delta':>14}")
    print(f"  {'-'*28} {'-'*14} {'-'*14} {'-'*14}")
    for k in ["f0_mean", "f0_median", "f0_std", "f0_iqr", "f0_min", "f0_max", "f0_range", "voiced_ratio", "pitch_trajectory_variance", "contour_smoothness"]:
        rv = ref_f0.get(k, 0.0)
        gv = gen_f0.get(k, 0.0)
        diff = gv - rv if isinstance(rv, (int, float)) and isinstance(gv, (int, float)) else 0.0
        unit = " Hz" if "f0_" in k and "ratio" not in k and "smoothness" not in k else ""
        print(f"  {k:<28} {f'{rv:.2f}{unit}':>14} {f'{gv:.2f}{unit}':>14} {f'{diff:+.2f}{unit}':>14}")
        
    # 4. Prosody and pauses
    ref_prosody = compute_prosody_and_pauses(ref_samples, ref_sr)
    gen_prosody = compute_prosody_and_pauses(gen_samples, gen_sr)
    print(f"\n[PROSODY & RHYTHM DYNAMICS]")
    print(f"  {'Metric':<28} {'Reference':>14} {'Generated':>14} {'Delta':>14}")
    print(f"  {'-'*28} {'-'*14} {'-'*14} {'-'*14}")
    for k in ["duration_sec", "speech_time_sec", "total_pause_sec", "pause_count", "mean_pause_sec", "pause_frequency_per_sec", "speech_ratio", "rhythm_npvi"]:
        rv = ref_prosody.get(k, 0.0)
        gv = gen_prosody.get(k, 0.0)
        diff = gv - rv if isinstance(rv, (int, float)) and isinstance(gv, (int, float)) else 0.0
        print(f"  {k:<28} {f'{rv:.2f}':>14} {f'{gv:.2f}':>14} {f'{diff:+.2f}':>14}")
        
    # 5. Energy dynamics
    ref_energy = compute_energy_dynamics(ref_samples)
    gen_energy = compute_energy_dynamics(gen_samples)
    print(f"\n[ENERGY & VOLUME DYNAMICS]")
    print(f"  {'Metric':<28} {'Reference':>14} {'Generated':>14} {'Delta':>14}")
    print(f"  {'-'*28} {'-'*14} {'-'*14} {'-'*14}")
    for k in ["rms_mean", "rms_std", "peak", "crest_factor", "dynamic_range_db", "energy_std_to_mean_ratio"]:
        rv = ref_energy.get(k, 0.0)
        gv = gen_energy.get(k, 0.0)
        diff = gv - rv if isinstance(rv, (int, float)) and isinstance(gv, (int, float)) else 0.0
        unit = " dB" if "db" in k else ""
        print(f"  {k:<28} {f'{rv:.2f}{unit}':>14} {f'{gv:.2f}{unit}':>14} {f'{diff:+.2f}{unit}':>14}")
        
    # 6. Spectral & MFCC
    ref_spec = compute_spectral_timbre(ref_samples, ref_sr)
    gen_spec = compute_spectral_timbre(gen_samples, gen_sr)
    ref_m = np.array(ref_spec.get("mfcc_mean", []))
    gen_m = np.array(gen_spec.get("mfcc_mean", []))
    mfcc_cos = float(np.dot(ref_m, gen_m) / (np.linalg.norm(ref_m) * np.linalg.norm(gen_m) + 1e-10)) if len(ref_m) > 0 and len(gen_m) > 0 else 0.0
    print(f"\n[SPECTRAL & TIMBRE]")
    print(f"  Spectral Centroid: Reference={ref_spec.get('spectral_centroid')} Hz, Generated={gen_spec.get('spectral_centroid')} Hz")
    print(f"  Spectral Rolloff:  Reference={ref_spec.get('spectral_rolloff')} Hz, Generated={gen_spec.get('spectral_rolloff')} Hz")
    print(f"  MFCC Cosine Similarity: {mfcc_cos:.4f}")
    
    # 7. Intelligibility STT
    stt_res = compute_intelligibility_stt(gen_wav, args.expected_text)
    print(f"\n[INTELLIGIBILITY (Faster-Whisper)]")
    print(f"  Recognized Transcript: \"{stt_res.get('transcript')}\"")
    if args.expected_text:
        print(f"  Expected Text:         \"{args.expected_text}\"")
        print(f"  Word Match Accuracy:   {stt_res.get('word_accuracy_pct')}%")
        print(f"  Word Error Rate (WER): {stt_res.get('wer_pct')}%")
        
    # 8. Scorecard
    scorecard = evaluate_humanness_scorecard(gen_f0, gen_prosody, gen_energy, sim_score, stt_res)
    print(f"\n[HUMANNESS & NATURALNESS SCORECARD]")
    print(f"  Pitch Expressiveness Score:  {scorecard.get('pitch_expressiveness_score')}/100")
    print(f"  Rhythm & Prosody Score:      {scorecard.get('rhythm_prosody_score')}/100 (nPVI: {gen_prosody.get('rhythm_npvi')})")
    print(f"  Energy Dynamics Score:       {scorecard.get('energy_dynamics_score')}/100 (DynRange: {gen_energy.get('dynamic_range_db')} dB)")
    print(f"  Intelligibility Score:       {scorecard.get('intelligibility_score')}/100")
    print(f"  Robotic Monotone Penalty:    -{scorecard.get('robotic_monotone_penalty')}")
    print(f"  Robotic Artifact Level:      {scorecard.get('robotic_artifact_level')}")
    print(f"  COMPOSITE NATURALNESS SCORE: {scorecard.get('composite_naturalness_score')}/100")
    print("=" * 80)
    
    # Output JSON if requested
    if args.output:
        full_res = {
            "speaker_similarity": sim_score,
            "pitch_dynamics": {
                "reference": ref_f0,
                "generated": gen_f0
            },
            "prosody_dynamics": {
                "reference": ref_prosody,
                "generated": gen_prosody
            },
            "energy_dynamics": {
                "reference": ref_energy,
                "generated": gen_energy
            },
            "spectral_timbre": {
                "reference": ref_spec,
                "generated": gen_spec,
                "mfcc_cosine": mfcc_cos
            },
            "intelligibility": stt_res,
            "scorecard": scorecard
        }
        with open(args.output, "w") as f:
            json.dump(full_res, f, indent=2)
        print(f"\n[DIAGNOSTIC SAVED] {args.output}")


if __name__ == "__main__":
    main()
