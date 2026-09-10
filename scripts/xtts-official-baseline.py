#!/usr/bin/env python3
"""
Phase 13G: Minimal Isolated Official Coqui XTTS v2 Baseline
Direct official invocation with ZERO application wrappers.
"""

import sys
import os
import time
import hashlib
import json
import torch
import soundfile as sf
from TTS.api import TTS

def sha256_file(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def main():
    print("=" * 80)
    print("PHASE 13G: ISOLATED OFFICIAL COQUI XTTS v2 DIRECT BASELINE")
    print("=" * 80)

    # Reference file (Direct raw reference, un-preprocessed by our app)
    ref_audio = r"D:\downlods_new\aadi.m4a"
    if not os.path.exists(ref_audio):
        ref_audio = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "chocho_raw_24k.wav"))

    benchmark_text = "Welcome to the voice AI studio, where neural speech synthesis brings natural voices to life."
    lang = "en"

    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tests", "fidelity-optimization"))
    os.makedirs(out_dir, exist_ok=True)
    out_wav = os.path.join(out_dir, "official_xtts_baseline.wav")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading official Coqui TTS model on {device}...")
    t_load_0 = time.time()
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
    t_load = time.time() - t_load_0
    print(f"Model loaded in {t_load:.2f}s")

    print(f"\nSynthesizing with official API defaults...")
    print(f"  Reference Audio: {ref_audio}")
    print(f"  Text: \"{benchmark_text}\"")
    print(f"  Language: {lang}")
    print(f"  Output Path: {out_wav}")

    # Official direct invocation
    t_inf_0 = time.time()
    tts.tts_to_file(
        text=benchmark_text,
        speaker_wav=ref_audio,
        language=lang,
        file_path=out_wav,
        split_sentences=True  # Official default
    )
    t_inf = time.time() - t_inf_0

    data, sr = sf.read(out_wav)
    dur = len(data) / sr
    out_hash = sha256_file(out_wav)
    ref_hash = sha256_file(ref_audio) if os.path.exists(ref_audio) else "N/A"

    print("\n" + "=" * 80)
    print("OFFICIAL XTTS v2 DIRECT BASELINE COMPLETED:")
    print(f"  Duration: {dur:.2f}s")
    print(f"  Sample Rate: {sr} Hz")
    print(f"  Inference Time: {t_inf:.2f}s")
    print(f"  Output SHA256: {out_hash[:16]}...")
    print(f"  Reference SHA256: {ref_hash[:16]}...")
    print("=" * 80)

if __name__ == "__main__":
    main()
