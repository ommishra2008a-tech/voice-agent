"""
Dubbing Timing Engine & Acoustic Lip-Sync Analyzer
Implements controlled timing adaptation, seam crossfading, and viseme extraction.
"""
import os
import math
import wave
import struct
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel


class SegmentTimingDecision(BaseModel):
    segment_id: str
    speaker_id: str
    source_start: float
    source_end: float
    target_duration: float
    generated_duration: float
    speed_ratio_raw: float
    applied_speed_ratio: float
    padding_seconds: float
    trim_seconds: float
    crossfade_ms: int
    adaptation_decision: str  # "PRECISE_FIT" | "SPEED_MODULATED" | "PADDED" | "TRIMMED"
    adapted_audio_path: Optional[str] = None


class LipSyncFrame(BaseModel):
    timestamp_sec: float
    viseme: str  # "A" | "E" | "I" | "O" | "U" | "SILENCE"
    mouth_open: float   # 0.0 to 1.0
    mouth_wide: float   # 0.0 to 1.0
    intensity: float    # 0.0 to 1.0


class DubbingTimingEngine:
    """Computes and executes controlled speed adaptation and crossfading for multi-speaker dubbing."""
    MIN_SAFE_SPEED = 0.90
    MAX_SAFE_SPEED = 1.15
    DEFAULT_CROSSFADE_MS = 40

    @classmethod
    def evaluate_timing(
        cls,
        segment_id: str,
        speaker_id: str,
        source_start: float,
        source_end: float,
        generated_duration: float,
        generated_audio_path: Optional[str] = None
    ) -> SegmentTimingDecision:
        target_dur = max(0.1, round(source_end - source_start, 3))
        gen_dur = max(0.1, round(generated_duration, 3))
        raw_ratio = round(gen_dur / target_dur, 3)

        padding_sec = 0.0
        trim_sec = 0.0
        decision = "PRECISE_FIT"

        if 0.98 <= raw_ratio <= 1.02:
            applied_speed = 1.0
            decision = "PRECISE_FIT"
        elif cls.MIN_SAFE_SPEED <= raw_ratio <= cls.MAX_SAFE_SPEED:
            applied_speed = raw_ratio
            decision = "SPEED_MODULATED"
        elif raw_ratio < cls.MIN_SAFE_SPEED:
            # Audio is noticeably shorter than target slot -> apply minimal safe speed and pad silence
            applied_speed = cls.MIN_SAFE_SPEED
            effective_dur = gen_dur / applied_speed
            padding_sec = round(max(0.0, target_dur - effective_dur), 3)
            decision = "PADDED"
        else:
            # Audio is longer than target slot -> clamp speed to max safe ratio and gently trim tail
            applied_speed = cls.MAX_SAFE_SPEED
            effective_dur = gen_dur / applied_speed
            trim_sec = round(max(0.0, effective_dur - target_dur), 3)
            decision = "TRIMMED"

        return SegmentTimingDecision(
            segment_id=segment_id,
            speaker_id=speaker_id,
            source_start=source_start,
            source_end=source_end,
            target_duration=target_dur,
            generated_duration=gen_dur,
            speed_ratio_raw=raw_ratio,
            applied_speed_ratio=round(applied_speed, 3),
            padding_seconds=padding_sec,
            trim_seconds=trim_sec,
            crossfade_ms=cls.DEFAULT_CROSSFADE_MS,
            adaptation_decision=decision,
            adapted_audio_path=generated_audio_path
        )


class LipSyncAnalyzer:
    """Extracts energy envelope and frequency distribution to generate accurate viseme timelines."""
    VISEMES = ["SILENCE", "A", "E", "I", "O", "U"]

    @classmethod
    def analyze_wav(cls, audio_path: str, fps: int = 30) -> List[LipSyncFrame]:
        if not os.path.exists(audio_path):
            return []

        try:
            with wave.open(audio_path, 'rb') as wf:
                sr = wf.getframerate()
                n_channels = wf.getnchannels()
                n_frames = wf.getnframes()
                raw_data = wf.readframes(n_frames)

            # Unpack 16-bit PCM
            samples = np.frombuffer(raw_data, dtype=np.int16).astype(np.float32)
            if n_channels > 1:
                samples = samples.reshape(-1, n_channels).mean(axis=1)

            # Normalize [-1.0, 1.0]
            max_val = np.max(np.abs(samples)) or 1.0
            samples = samples / max_val

            total_duration = n_frames / sr
            frame_step = int(sr / fps)
            frames: List[LipSyncFrame] = []

            for i in range(0, len(samples) - frame_step, frame_step):
                chunk = samples[i:i + frame_step]
                t_sec = round(i / sr, 3)

                # Compute RMS Energy
                rms = float(np.sqrt(np.mean(chunk**2)))

                if rms < 0.02:
                    frames.append(LipSyncFrame(
                        timestamp_sec=t_sec,
                        viseme="SILENCE",
                        mouth_open=0.0,
                        mouth_wide=0.0,
                        intensity=0.0
                    ))
                    continue

                # Compute simple spectral energy bands via FFT
                fft_vals = np.abs(np.fft.rfft(chunk * np.hanning(len(chunk))))
                freqs = np.fft.rfftfreq(len(chunk), 1.0 / sr)

                low_energy = float(np.sum(fft_vals[(freqs >= 100) & (freqs < 500)]))
                mid_energy = float(np.sum(fft_vals[(freqs >= 500) & (freqs < 1800)]))
                high_energy = float(np.sum(fft_vals[(freqs >= 1800) & (freqs < 4000)]))
                total_band_energy = low_energy + mid_energy + high_energy + 1e-6

                low_ratio = low_energy / total_band_energy
                mid_ratio = mid_energy / total_band_energy
                high_ratio = high_energy / total_band_energy

                # Map dominant energy band to Viseme
                if mid_ratio > 0.45:
                    viseme = "A"
                    mouth_open = min(1.0, rms * 4.5)
                    mouth_wide = 0.5
                elif high_ratio > 0.40:
                    viseme = "E" if high_ratio > 0.60 else "I"
                    mouth_open = min(1.0, rms * 2.5)
                    mouth_wide = min(1.0, rms * 4.0)
                elif low_ratio > 0.50:
                    viseme = "O" if low_ratio > 0.65 else "U"
                    mouth_open = min(1.0, rms * 3.5)
                    mouth_wide = 0.2
                else:
                    viseme = "A"
                    mouth_open = min(1.0, rms * 3.0)
                    mouth_wide = 0.4

                frames.append(LipSyncFrame(
                    timestamp_sec=t_sec,
                    viseme=viseme,
                    mouth_open=round(mouth_open, 2),
                    mouth_wide=round(mouth_wide, 2),
                    intensity=round(min(1.0, rms * 3.0), 2)
                ))

            return frames
        except Exception:
            return []
