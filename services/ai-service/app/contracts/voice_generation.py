"""
Versioned Data Contracts for Voice Generation Engine & Post-Synthesis Evaluation
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class VoiceGenerationRequest(BaseModel):
    request_id: Optional[str] = None
    project_id: str
    user_id: str
    voice_profile_id: str
    reference_audio_path: Optional[str] = None
    text: str
    language: str = "en"  # "en" | "hi" | "es" | "fr" | etc.
    speed: float = 1.0     # 0.5 to 2.0
    pitch: float = 0.0     # -10.0 to +10.0 semitones
    style: Optional[str] = "natural"
    emotion: Optional[str] = "neutral"
    model: str = "fastpitch-baseline"  # "fastpitch-baseline" | "xtts-v2" | "openvoice-v2" | "cosyvoice"
    output_format: str = "wav"
    sample_rate: int = 24000


class VoiceGenerationResponse(BaseModel):
    request_id: str
    status: str  # "COMPLETED" | "FAILED"
    audio_path: str
    duration: float
    sample_rate: int
    channels: int
    format: str
    quality_score: float
    model: str
    model_version: str
    execution_time_ms: int
    error: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GeneratedVoiceEvaluation(BaseModel):
    generated_audio_path: str
    reference_audio_path: str
    speaker_embedding_similarity: float
    pitch_correlation: float
    timbre_spectral_match: float
    prosody_similarity: float
    intelligibility_score: float
    overall_quality_score: float
    is_identity_preserved: bool
    evaluation_passed: bool
    execution_time_ms: int


class ABEvaluationRequest(BaseModel):
    evaluation_id: str
    evaluator_id: str
    reference_audio_path: str
    generated_audio_path: str
    identity_similarity_score: float  # 1.0 to 5.0
    naturalness_score: float           # 1.0 to 5.0
    pronunciation_clarity_score: float # 1.0 to 5.0
    overall_rating: float              # 1.0 to 5.0
    notes: Optional[str] = None


class ABEvaluationResponse(BaseModel):
    evaluation_id: str
    status: str
    recorded_at: str
    average_score: float
    evaluation_metadata: Dict[str, Any]
