import sys
import os
import subprocess
import json
import torch
import soundfile as sf
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "ai-service")))

def main():
    m4a_path = r"D:\downlods_new\aadi.m4a"
    fixtures_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures"))
    os.makedirs(fixtures_dir, exist_ok=True)
    raw_24k_path = os.path.join(fixtures_dir, "aadi_raw_24k.wav")

    cmd = ["ffmpeg", "-y", "-i", m4a_path, "-ac", "1", "-ar", "24000", "-f", "wav", raw_24k_path]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    data, sr = sf.read(raw_24k_path)
    dur = len(data) / sr
    rms = float(np.sqrt(np.mean(data**2)))
    peak = float(np.max(np.abs(data)))
    print(f"Decoded aadi.m4a -> {raw_24k_path}")
    print(f"Sample rate: {sr} Hz, Channels: 1, Samples: {len(data)}, Duration: {dur:.2f}s")
    print(f"RMS: {rms:.4f}, Peak: {peak:.4f}")

    # Transcribe with Faster-Whisper
    try:
        from faster_whisper import WhisperModel
        whisper = WhisperModel("base", device="cuda" if torch.cuda.is_available() else "cpu", compute_type="float16" if torch.cuda.is_available() else "int8")
        segments, info = whisper.transcribe(raw_24k_path, beam_size=5)
        seg_list = list(segments)
        text = " ".join([s.text.strip() for s in seg_list])
        print(f"Detected Language: {info.language} ({info.language_probability:.2f})")
        print(f"Reference Transcription: \"{text}\"")
        for i, s in enumerate(seg_list):
            print(f"  Segment {i+1}: [{s.start:.2f}s - {s.end:.2f}s] \"{s.text.strip()}\"")
    except Exception as e:
        print(f"Faster-Whisper error: {e}")

if __name__ == "__main__":
    main()
