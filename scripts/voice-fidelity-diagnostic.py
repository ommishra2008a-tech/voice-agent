#!/usr/bin/env python3
"""
Voice Fidelity Diagnostic Tool
Usage: python scripts/voice-fidelity-diagnostic.py --reference REF_PATH --generated GEN_PATH

Measures:
- Resemblyzer speaker cosine similarity
- F0 pitch distribution comparison
- Spectral centroid, bandwidth, rolloff
- MFCC statistics and cosine similarity
- RMS / energy levels
- Silence and speech ratios
- Intelligibility assessment
- Quality diagnosis
"""
import argparse
import os
import sys
import wave
import subprocess
import json
import numpy as np


def probe_audio(path):
    """Get audio metadata via ffprobe."""
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
            "size_bytes": os.path.getsize(path),
        }
    except Exception as e:
        return {"error": str(e)}


def convert_to_wav(input_path, output_path, sr=24000):
    """Convert any audio to mono WAV."""
    cmd = ["ffmpeg", "-y", "-i", input_path, "-vn", "-ar", str(sr), "-ac", "1", "-c:a", "pcm_s16le", output_path]
    subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    return os.path.exists(output_path)


def load_wav(path):
    """Load WAV as float32."""
    with wave.open(path, 'rb') as wf:
        sr = wf.getframerate()
        nch = wf.getnchannels()
        nsamp = wf.getnframes()
        raw = wf.readframes(nsamp)
    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    if nch > 1:
        samples = samples[::nch]
    return samples, sr


def spectral_features(samples, sr):
    fft = np.abs(np.fft.rfft(samples))
    freqs = np.fft.rfftfreq(len(samples), 1.0 / sr)
    total = np.sum(fft)
    if total == 0:
        return {}
    centroid = float(np.sum(freqs * fft) / total)
    bandwidth = float(np.sqrt(np.sum(((freqs - centroid) ** 2) * fft) / total))
    cumsum = np.cumsum(fft)
    rolloff_idx = np.searchsorted(cumsum, 0.85 * cumsum[-1])
    rolloff = float(freqs[min(rolloff_idx, len(freqs) - 1)])
    rms = float(np.sqrt(np.mean(samples ** 2)))
    peak = float(np.max(np.abs(samples)))
    zcr = float(np.sum(np.abs(np.diff(np.sign(samples))) > 0) / len(samples))
    threshold = peak * 0.02 if peak > 0 else 1
    silence_ratio = float(np.sum(np.abs(samples) < threshold) / len(samples))
    return {
        "spectral_centroid": round(centroid, 2),
        "spectral_bandwidth": round(bandwidth, 2),
        "spectral_rolloff": round(rolloff, 2),
        "rms": round(rms, 2),
        "peak": round(peak, 0),
        "zero_crossing_rate": round(zcr, 5),
        "silence_ratio": round(silence_ratio, 4),
        "speech_ratio": round(1.0 - silence_ratio, 4),
        "duration_sec": round(len(samples) / sr, 3),
    }


def compute_mfcc(samples, sr, n_mfcc=13):
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
    for i in range(min(n_frames, 500)):
        start = i * hop_len
        frame = samples[start:start + frame_len]
        if len(frame) < frame_len:
            frame = np.pad(frame, (0, frame_len - len(frame)))
        frame = frame * np.hamming(frame_len)
        mag = np.abs(np.fft.rfft(frame, n=n_fft))[:n_fft // 2 + 1]
        mel_spec = np.dot(fbank, mag)
        mel_spec = np.where(mel_spec == 0, np.finfo(float).eps, mel_spec)
        log_mel = np.log(mel_spec)
        dct = np.zeros(n_mfcc)
        for j in range(n_mfcc):
            dct[j] = np.sum(log_mel * np.cos(np.pi * j * (2 * np.arange(n_mels) + 1) / (2 * n_mels)))
        mfccs.append(dct)
    mfccs = np.array(mfccs)
    return np.mean(mfccs, axis=0), np.std(mfccs, axis=0)


def compute_f0(samples, sr, fmin=50, fmax=600):
    frame_len = int(0.030 * sr)
    hop = int(0.010 * sr)
    tau_min = int(sr / fmax)
    tau_max = min(int(sr / fmin), frame_len)
    f0s = []
    n_frames = (len(samples) - frame_len) // hop
    for i in range(min(n_frames, 500)):
        start = i * hop
        frame = samples[start:start + frame_len]
        d = np.zeros(tau_max)
        for tau in range(tau_min, tau_max):
            diff = frame[:frame_len - tau] - frame[tau:frame_len]
            d[tau] = np.sum(diff ** 2)
        d_prime = np.ones(tau_max)
        running = 0
        for tau in range(tau_min, tau_max):
            running += d[tau]
            d_prime[tau] = d[tau] * tau / running if running > 0 else 1
        best_tau = tau_min
        for tau in range(tau_min, tau_max):
            if d_prime[tau] < 0.15:
                best_tau = tau
                break
        else:
            best_tau = tau_min + np.argmin(d_prime[tau_min:tau_max])
        if best_tau > 0:
            f0 = sr / best_tau
            if fmin <= f0 <= fmax:
                f0s.append(f0)
    if not f0s:
        return {"f0_mean": 0, "f0_median": 0, "f0_std": 0}
    a = np.array(f0s)
    return {"f0_mean": round(float(np.mean(a)), 2), "f0_median": round(float(np.median(a)), 2),
            "f0_std": round(float(np.std(a)), 2), "f0_min": round(float(np.min(a)), 2),
            "f0_max": round(float(np.max(a)), 2), "voiced_frames": len(f0s)}


def resemblyzer_sim(ref, gen):
    try:
        from resemblyzer import VoiceEncoder, preprocess_wav
        enc = VoiceEncoder()
        r = enc.embed_utterance(preprocess_wav(ref))
        g = enc.embed_utterance(preprocess_wav(gen))
        return round(float(np.dot(r, g) / (np.linalg.norm(r) * np.linalg.norm(g))), 6)
    except ImportError:
        return "resemblyzer not installed"
    except Exception as e:
        return f"error: {e}"


def main():
    parser = argparse.ArgumentParser(description="Voice Fidelity Diagnostic Tool")
    parser.add_argument("--reference", required=True, help="Path to reference audio file")
    parser.add_argument("--generated", required=True, help="Path to generated audio file")
    parser.add_argument("--output", default=None, help="Optional JSON output path")
    args = parser.parse_args()

    if not os.path.exists(args.reference):
        print(f"ERROR: Reference file not found: {args.reference}")
        sys.exit(1)
    if not os.path.exists(args.generated):
        print(f"ERROR: Generated file not found: {args.generated}")
        sys.exit(1)

    tmp_dir = os.path.join(os.path.dirname(args.generated), ".fidelity_tmp")
    os.makedirs(tmp_dir, exist_ok=True)

    ref_wav = os.path.join(tmp_dir, "ref_24k.wav")
    gen_wav = os.path.join(tmp_dir, "gen_24k.wav")
    convert_to_wav(args.reference, ref_wav)
    convert_to_wav(args.generated, gen_wav)

    ref_samples, ref_sr = load_wav(ref_wav)
    gen_samples, gen_sr = load_wav(gen_wav)

    print("=" * 70)
    print("VOICE FIDELITY DIAGNOSTIC REPORT")
    print("=" * 70)

    # File info
    ref_info = probe_audio(args.reference)
    gen_info = probe_audio(args.generated)
    print(f"\n  Reference: {os.path.basename(args.reference)}")
    print(f"    Codec: {ref_info.get('codec')}, SR: {ref_info.get('sample_rate')}, "
          f"Ch: {ref_info.get('channels')}, Duration: {ref_info.get('duration_sec', 0):.2f}s")
    print(f"  Generated: {os.path.basename(args.generated)}")
    print(f"    Codec: {gen_info.get('codec')}, SR: {gen_info.get('sample_rate')}, "
          f"Ch: {gen_info.get('channels')}, Duration: {gen_info.get('duration_sec', 0):.2f}s")

    # Resemblyzer
    sim = resemblyzer_sim(ref_wav, gen_wav)
    print(f"\n  RESEMBLYZER SPEAKER SIMILARITY: {sim}")
    if isinstance(sim, float):
        print(f"  Speaker Similarity: {sim * 100:.2f}%")

    # Spectral
    ref_feat = spectral_features(ref_samples, ref_sr)
    gen_feat = spectral_features(gen_samples, gen_sr)
    print(f"\n  {'Feature':<25} {'Reference':>12} {'Generated':>12} {'Delta':>12}")
    print(f"  {'-' * 25} {'-' * 12} {'-' * 12} {'-' * 12}")
    for k in ref_feat:
        rv, gv = ref_feat.get(k, 0), gen_feat.get(k, 0)
        if isinstance(rv, (int, float)) and isinstance(gv, (int, float)):
            print(f"  {k:<25} {rv:>12.2f} {gv:>12.2f} {gv - rv:>+12.2f}")

    # MFCC
    ref_m, ref_s = compute_mfcc(ref_samples, ref_sr)
    gen_m, gen_s = compute_mfcc(gen_samples, gen_sr)
    mfcc_cos = float(np.dot(ref_m, gen_m) / (np.linalg.norm(ref_m) * np.linalg.norm(gen_m) + 1e-10))
    mfcc_euc = float(np.linalg.norm(ref_m - gen_m))
    print(f"\n  MFCC Cosine Similarity: {mfcc_cos:.4f}")
    print(f"  MFCC Euclidean Distance: {mfcc_euc:.4f}")

    # F0
    ref_f0 = compute_f0(ref_samples, ref_sr)
    gen_f0 = compute_f0(gen_samples, gen_sr)
    print(f"\n  F0 Reference: mean={ref_f0['f0_mean']}, median={ref_f0['f0_median']}, std={ref_f0['f0_std']}")
    print(f"  F0 Generated: mean={gen_f0['f0_mean']}, median={gen_f0['f0_median']}, std={gen_f0['f0_std']}")

    # Diagnosis
    print(f"\n  DIAGNOSIS:")
    if isinstance(sim, float):
        if sim >= 0.85:
            print("    Speaker identity: EXCELLENT (>=85%)")
        elif sim >= 0.75:
            print("    Speaker identity: GOOD (75-85%)")
        elif sim >= 0.65:
            print("    Speaker identity: FAIR (65-75%)")
        else:
            print("    Speaker identity: POOR (<65%)")

    if ref_feat.get("speech_ratio", 0) > 0.3 and gen_feat.get("speech_ratio", 0) > 0.3:
        print("    Intelligibility: PASS (speech detected in both)")
    else:
        print("    Intelligibility: WARNING (low speech ratio)")

    quality = "NATURAL" if abs(ref_f0.get("f0_mean", 0) - gen_f0.get("f0_mean", 0)) < 50 else "PITCH_SHIFTED"
    print(f"    Naturalness: {quality}")

    print("=" * 70)

    if args.output:
        results = {
            "similarity": sim,
            "ref_spectral": ref_feat,
            "gen_spectral": gen_feat,
            "mfcc_cosine": mfcc_cos,
            "ref_f0": ref_f0,
            "gen_f0": gen_f0,
        }
        with open(args.output, "w") as f:
            json.dump(results, f, indent=2)
        print(f"  Results saved to: {args.output}")


if __name__ == "__main__":
    main()
