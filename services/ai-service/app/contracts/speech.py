"""
Versioned Data Contracts for Speech Pipeline (VAD, STT, Diarization, Alignment)
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class VADSegment(BaseModel):
    start_time: float
    end_time: float
    confidence: float = 1.0


class VADRequest(BaseModel):
    audio_path: str
    threshold: float = 0.5


class VADResponse(BaseModel):
    status: str
    speech_segments: List[VADSegment]
    total_speech_duration: float
    total_audio_duration: float
    speech_ratio: float
    execution_time_ms: int
    error: Optional[str] = None


class STTSegment(BaseModel):
    start_time: float
    end_time: float
    text: str
    confidence: float = 1.0
    speaker_id: Optional[str] = None


class STTRequest(BaseModel):
    audio_path: str
    language: Optional[str] = None  # None for auto-detect
    model_size: str = "base"  # "tiny" | "base" | "small" | "medium" | "large-v3"
    beam_size: int = 5


class STTResponse(BaseModel):
    status: str
    full_text: str
    detected_language: str
    language_probability: float
    duration: float
    segments: List[STTSegment]
    execution_time_ms: int
    model_used: str
    error: Optional[str] = None


class SpeakerSegment(BaseModel):
    speaker_id: str
    start_time: float
    end_time: float
    confidence: float = 1.0


class DiarizeRequest(BaseModel):
    audio_path: str
    expected_speakers: Optional[int] = None
    min_speakers: int = 1
    max_speakers: int = 8


class DiarizeResponse(BaseModel):
    status: str
    speaker_count: int
    speakers: List[str]
    segments: List[SpeakerSegment]
    execution_time_ms: int
    error: Optional[str] = None


class SpeakerAttributedSegment(BaseModel):
    speaker_id: str
    start_time: float
    end_time: float
    text: str
    confidence: float = 1.0


class SpeechProcessRequest(BaseModel):
    source_asset_id: str
    audio_path: str
    language: Optional[str] = None
    expected_speakers: Optional[int] = None
    model_size: str = "base"


class SpeechProcessResponse(BaseModel):
    source_asset_id: str
    status: str  # "COMPLETED" | "FAILED"
    full_text: str
    detected_language: str
    duration: float
    speech_duration: float
    speaker_count: int
    speakers: List[str]
    vad_segments: List[VADSegment]
    diarization_segments: List[SpeakerSegment]
    attributed_transcript: List[SpeakerAttributedSegment]
    execution_time_ms: int
    model_vram_mb: Optional[int] = None
    error: Optional[str] = None
