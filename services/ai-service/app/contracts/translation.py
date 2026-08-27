"""
Versioned Data Contracts for Translation & Multilingual Voice Pipeline
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class LanguageDetectionRequest(BaseModel):
    text: str


class LanguageDetectionResponse(BaseModel):
    detected_language: str
    confidence: float
    alternatives: Dict[str, float] = Field(default_factory=dict)
    execution_time_ms: int


class TranslationRequest(BaseModel):
    request_id: Optional[str] = None
    project_id: str
    user_id: str
    source_text: str
    source_language: Optional[str] = "auto"
    target_language: str = "hi"
    context: Optional[str] = None
    glossary: Optional[Dict[str, str]] = None
    speaker_id: Optional[str] = None
    source_id: Optional[str] = None


class TranslationResponse(BaseModel):
    request_id: str
    source_language: str
    target_language: str
    translated_text: str
    provider: str = "neural-translator"
    model: str = "nllb-200-distilled-600M"
    confidence: float = 0.95
    execution_time_ms: int
    error: Optional[str] = None


class TranscriptTranslationSegment(BaseModel):
    speaker_id: str
    start_time: float
    end_time: float
    original_text: str
    translated_text: Optional[str] = None


class TranscriptTranslationRequest(BaseModel):
    project_id: str
    user_id: str
    source_language: str = "en"
    target_language: str = "hi"
    segments: List[TranscriptTranslationSegment]
    glossary: Optional[Dict[str, str]] = None


class TranscriptTranslationResponse(BaseModel):
    project_id: str
    source_language: str
    target_language: str
    segments: List[TranscriptTranslationSegment]
    total_segments: int
    execution_time_ms: int


class VoiceLanguageCompatibilityRequest(BaseModel):
    voice_profile_id: str
    model: str = "fastpitch-baseline"
    target_language: str = "hi"


class VoiceLanguageCompatibilityResponse(BaseModel):
    compatible: bool
    voice_profile_id: str
    target_language: str
    model: str
    reason: Optional[str] = None


class TranslationToVoiceRequest(BaseModel):
    project_id: str
    user_id: str
    voice_profile_id: str
    source_text: str
    source_language: str = "en"
    target_language: str = "hi"
    speed: float = 1.0
    pitch: float = 0.0
    model: str = "fastpitch-baseline"


class TranslationToVoiceResponse(BaseModel):
    request_id: str
    status: str
    source_text: str
    translated_text: str
    source_language: str
    target_language: str
    audio_path: str
    duration: float
    sample_rate: int
    quality_score: float
    execution_time_ms: int
    error: Optional[str] = None
