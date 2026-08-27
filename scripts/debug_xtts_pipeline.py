"""
XTTS v2 Pipeline Diagnostic Script
Tests the complete voice generation pipeline from reference audio to final output.
Run: python scripts/debug_xtts_pipeline.py
"""
import os
import sys
import json
import time
import wave
import struct
import subprocess
import numpy as np

# Paths
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
AI_SERVICE_DIR = os.path.join(PROJECT_ROOT, "services", "ai-service")
FIXTURES_DIR = os.path.join(PROJECT_ROOT, "tests", "fixtures")
OUTPUT_DIR = os.path.join(AI_SERVICE_DIR, "storage", "generated_audio")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Add ai-service to path
sys.path.insert(0, AI_SERVICE_DIR)

PYTHON_API = "http://localhost:8000"


def classify_audio(file_path):
    """Classify audio content using waveform analysis."""
    with wave.open(file_path, 'rb') as wf:
        sr = wf.getframerate()
        nch = wf.getnchannels()
        nsamp = wf.getnframes()
        raw = wf.readframes(nsamp)

    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    if len(samples) == 0:
        return {"classification": "SILENCE", "valid_speech": False}

    rms = float(np.sqrt(np.mean(samples ** 2)))
    peak = float(np.max(np.abs(samples)))
    unique_vals = len(np.unique(samples))

    if peak == 0:
        return {"classification": "SILENCE", "valid_speech": False, "rms": 0}

    zcr = float(np.sum(np.abs(np.diff(np.sign(samples))) > 0) / len(samples))

    fft_vals = np.abs(np.fft.rfft(samples))
    freqs = np.fft.rfftfreq(len(samples), 1.0 / sr)
    total_energy = float(np.sum(fft_vals))
    centroid = float(np.sum(freqs * fft_vals) / total_energy) if total_energy > 0 else 0
    bandwidth = float(np.sqrt(np.sum(((freqs - centroid) ** 2) * fft_vals) / total_energy)) if total_energy > 0 else 0

    threshold = peak * 0.01
    silence_ratio = float(np.sum(np.abs(samples) < threshold) / len(samples))

    result = {
        "duration_sec": round(nsamp / sr, 2),
        "sample_rate": sr,
        "channels": nch,
        "rms": round(rms, 1),
        "peak": round(peak, 0),
        "zcr": round(zcr, 4),
        "unique_values": unique_vals,
        "spectral_centroid": round(centroid, 1),
        "spectral_bandwidth": round(bandwidth, 1),
        "silence_ratio": round(silence_ratio, 3),
    }

    if unique_vals < 10:
        result["classification"] = "CONSTANT_SIGNAL"
        result["valid_speech"] = False
    elif silence_ratio > 0.98:
        result["classification"] = "SILENCE"
        result["valid_speech"] = False
    elif bandwidth < 200 and zcr < 0.02:
        result["classification"] = "TONE_ONLY"
        result["valid_speech"] = False
    elif bandwidth > 400 and zcr > 0.04 and unique_vals > 3000:
        result["classification"] = "VALID_SPEECH"
        result["valid_speech"] = True
    else:
        result["classification"] = "UNKNOWN"
        result["valid_speech"] = False

    return result


def probe_audio(file_path):
    """Run ffprobe on an audio file."""
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", file_path],
            capture_output=True, text=True, timeout=10
        )
        return json.loads(r.stdout)
    except Exception as e:
        return {"error": str(e)}


def test_via_api(text, language="en", model="xtts-v2"):
    """Test generation via the FastAPI endpoint."""
    import urllib.request
    payload = json.dumps({
        "project_id": "debug",
        "user_id": "debug",
        "voice_profile_id": "debug_anchor",
        "text": text,
        "language": language,
        "model": model,
        "sample_rate": 24000
    }).encode()

    req = urllib.request.Request(
        f"{PYTHON_API}/v1/speech/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
            return data
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}


def run_stt(audio_path):
    """Run STT on generated audio via API."""
    try:
        import urllib.request
        payload = json.dumps({"audio_path": audio_path, "language": "en"}).encode()
        req = urllib.request.Request(
            f"{PYTHON_API}/v1/speech/stt",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"error": str(e)}



def main():
    print("=" * 80)
    print("  XTTS v2 PIPELINE DIAGNOSTIC SCRIPT")
    print("=" * 80)

    # ── STAGE 1: Reference Audio ──
    print("\n── STAGE 1: REFERENCE AUDIO ──")
    ref_candidates = [
        os.path.join(FIXTURES_DIR, "real_speech_reference_24k.wav"),
        os.path.join(FIXTURES_DIR, "real_speech_reference.wav"),
        os.path.join(FIXTURES_DIR, "sample_speech.wav"),
    ]

    ref_audio = None
    for p in ref_candidates:
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            ref_audio = p
            break

    if not ref_audio:
        print("FAIL: No reference audio found")
        return

    print(f"Path: {ref_audio}")
    print(f"Size: {os.path.getsize(ref_audio)} bytes")

    ref_class = classify_audio(ref_audio)
    print(f"Duration: {ref_class.get('duration_sec')}s")
    print(f"Sample Rate: {ref_class.get('sample_rate')}")
    print(f"RMS: {ref_class.get('rms')}")
    print(f"Spectral Centroid: {ref_class.get('spectral_centroid')} Hz")
    print(f"Spectral Bandwidth: {ref_class.get('spectral_bandwidth')} Hz")
    print(f"Zero Crossing Rate: {ref_class.get('zcr')}")
    print(f"Classification: {ref_class.get('classification')}")
    print(f"Valid Speech: {ref_class.get('valid_speech')}")

    if not ref_class.get("valid_speech"):
        print("\n⚠ WARNING: Reference audio is NOT classified as valid speech!")
        print("  This may affect voice cloning quality.")

    # ── STAGE 2: Direct Provider Test ──
    print("\n── STAGE 2: DIRECT PROVIDER TEST (XTTSv2Adapter) ──")
    test_text = "Hello, this is a real voice cloning test."

    try:
        os.chdir(AI_SERVICE_DIR)
        from app.providers.voice_engine import VoiceEngineRegistry, AudioValidator
        from app.contracts.voice_generation import VoiceGenerationRequest

        engine = VoiceEngineRegistry.get_engine("xtts-v2")
        direct_output = os.path.join(OUTPUT_DIR, "debug_xtts_direct.wav")

        req = VoiceGenerationRequest(
            project_id="debug", user_id="debug", voice_profile_id="debug_anchor",
            text=test_text, language="en", model="xtts-v2", sample_rate=24000
        )

        start = time.time()
        res = engine.synthesize(req, direct_output)
        elapsed = int((time.time() - start) * 1000)

        print(f"Status: {res.status}")
        print(f"Audio Path: {res.audio_path}")
        print(f"Duration: {res.duration}s")
        print(f"Latency: {elapsed}ms")
        print(f"Model: {res.model}")

        if res.error:
            print(f"Error: {res.error}")

        if res.status == "COMPLETED" and os.path.exists(res.audio_path):
            gen_class = classify_audio(res.audio_path)
            print(f"File Size: {os.path.getsize(res.audio_path)} bytes")
            print(f"RMS: {gen_class.get('rms')}")
            print(f"Spectral Centroid: {gen_class.get('spectral_centroid')} Hz")
            print(f"Spectral Bandwidth: {gen_class.get('spectral_bandwidth')} Hz")
            print(f"Classification: {gen_class.get('classification')}")
            print(f"Valid Speech: {gen_class.get('valid_speech')}")

            provider_speech = gen_class.get("valid_speech", False)
        else:
            provider_speech = False
            print("FAIL: No output file generated")

    except Exception as e:
        print(f"FAIL: Provider error: {e}")
        import traceback
        traceback.print_exc()
        provider_speech = False

    # ── STAGE 3: FastAPI Test ──
    print("\n── STAGE 3: FASTAPI ENDPOINT TEST ──")
    api_result = test_via_api(test_text, "en", "xtts-v2")
    api_speech = False

    if api_result.get("status") == "COMPLETED":
        api_audio = api_result.get("audio_path", "")
        print(f"Status: COMPLETED")
        print(f"Audio Path: {api_audio}")
        print(f"Duration: {api_result.get('duration')}s")

        if os.path.exists(api_audio):
            api_class = classify_audio(api_audio)
            print(f"File Size: {os.path.getsize(api_audio)} bytes")
            print(f"Classification: {api_class.get('classification')}")
            print(f"Valid Speech: {api_class.get('valid_speech')}")
            api_speech = api_class.get("valid_speech", False)
        else:
            print(f"FAIL: Audio file not found at {api_audio}")
    else:
        print(f"Status: FAILED")
        print(f"Error: {api_result.get('error') or api_result.get('detail')}")

    # ── STAGE 4: STT Validation ──
    print("\n── STAGE 4: STT VALIDATION ──")
    if provider_speech and os.path.exists(direct_output):
        stt = run_stt(direct_output)
        if "error" not in stt:
            print(f"Transcript: {stt.get('text', stt.get('transcript', 'N/A'))}")
        else:
            print(f"STT Error: {stt.get('error')}")
    else:
        print("SKIPPED: No valid speech output to transcribe")

    # ── VERDICT ──
    print("\n" + "=" * 80)
    print("  VERDICT")
    print("=" * 80)
    print(f"\nProvider Direct:  {'PASS — SPEECH' if provider_speech else 'FAIL'}")
    print(f"FastAPI:          {'PASS — SPEECH' if api_speech else 'FAIL'}")
    print(f"Reference Valid:  {'YES' if ref_class.get('valid_speech') else 'NO (tone/synthetic)'}")

    if provider_speech and api_speech:
        print("\n✔ REAL VOICE GENERATION VERIFIED")
    elif provider_speech and not api_speech:
        print("\n✖ Fault Boundary: FastAPI endpoint or request contract")
    elif not provider_speech:
        print("\n✖ Fault Boundary: XTTSv2 Provider / Model")
        if res and res.error:
            print(f"  Root Cause: {res.error}")


if __name__ == "__main__":
    main()
