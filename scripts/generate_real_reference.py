"""
Generate a real speech reference audio file using Windows SAPI via pyttsx3.
This replaces the synthetic tone test fixture with actual human-like speech.
"""
import pyttsx3
import os
import wave
import subprocess
import json

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures")
OUTPUT_PATH = os.path.join(FIXTURES_DIR, "real_speech_reference.wav")
SAMPLE_SPEECH_PATH = os.path.join(FIXTURES_DIR, "sample_speech.wav")

def generate_reference():
    print("=== Generating Real Speech Reference Audio ===")
    
    engine = pyttsx3.init()
    
    # Configure for clear speech
    engine.setProperty('rate', 150)  # Words per minute
    engine.setProperty('volume', 0.9)
    
    # List available voices
    voices = engine.getProperty('voices')
    print(f"Available voices: {len(voices)}")
    for i, v in enumerate(voices):
        print(f"  [{i}] {v.name} ({v.id})")
    
    # Use the first available voice
    if voices:
        engine.setProperty('voice', voices[0].id)
        print(f"Selected voice: {voices[0].name}")
    
    # Generate the reference speech
    text = "Hello, this is a real voice cloning test. The system should reproduce this voice accurately."
    print(f"Text: {text}")
    print(f"Output: {OUTPUT_PATH}")
    
    engine.save_to_file(text, OUTPUT_PATH)
    engine.runAndWait()
    
    if os.path.exists(OUTPUT_PATH) and os.path.getsize(OUTPUT_PATH) > 1000:
        print(f"Generated: {os.path.getsize(OUTPUT_PATH)} bytes")
        
        # Probe it
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", OUTPUT_PATH],
            capture_output=True, text=True
        )
        info = json.loads(probe.stdout)
        duration = float(info["format"]["duration"])
        sr = int(info["streams"][0]["sample_rate"])
        ch = int(info["streams"][0]["channels"])
        print(f"Duration: {duration:.2f}s")
        print(f"Sample Rate: {sr}")
        print(f"Channels: {ch}")
        
        # Convert to 24kHz mono 16-bit for XTTS compatibility
        normalized_path = os.path.join(FIXTURES_DIR, "real_speech_reference_24k.wav")
        subprocess.run([
            "ffmpeg", "-y", "-i", OUTPUT_PATH,
            "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le",
            normalized_path
        ], capture_output=True, text=True, check=True)
        
        if os.path.exists(normalized_path):
            print(f"Normalized (24kHz mono): {os.path.getsize(normalized_path)} bytes")
        
        # Also create a proper sample_speech.wav replacement
        subprocess.run([
            "ffmpeg", "-y", "-i", OUTPUT_PATH,
            "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le",
            SAMPLE_SPEECH_PATH
        ], capture_output=True, text=True, check=True)
        print(f"Replaced sample_speech.wav: {os.path.getsize(SAMPLE_SPEECH_PATH)} bytes")
        
        print("\n=== REFERENCE AUDIO GENERATION COMPLETE ===")
        return True
    else:
        print("ERROR: Failed to generate reference audio")
        return False

if __name__ == "__main__":
    generate_reference()
