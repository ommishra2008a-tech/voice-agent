"""
Versioned Data Contracts for Multi-Dimensional Voice Profile System
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class PitchStats(BaseModel):
    f0_mean: float
    f0_median: float
    f0_min: float
    f0_max: float
    f0_range: float
    pitch_variance: float
    contour_samples: List[float] = Field(default_factory=list)


class TimbreProfile(BaseModel):
    spectral_centroid: float
    spectral_bandwidth: float
    spectral_rolloff: float
    spectral_flatness: float
    mfcc_means: List[float] = Field(default_factory=list)


class ProsodyProfile(BaseModel):
    speaking_rate_wpm: float
    pause_duration_sec: float
    pause_frequency_ratio: float
    pitch_variation: float
    energy_variation: float
    rhythm_score: float


class StyleProfile(BaseModel):
    conversational_score: float  # 0.0 to 1.0
    formality_score: float       # 0.0 to 1.0
    expressiveness_score: float  # 0.0 to 1.0
    sentence_rhythm: str
    speaking_behavior: str


class EmotionSegment(BaseModel):
    start_time: float
    end_time: float
    emotion: str
    confidence: float


class EmotionProfile(BaseModel):
    primary_emotion: str
    confidence: float
    emotion_distribution: Dict[str, float]
    segment_emotions: List[EmotionSegment] = Field(default_factory=list)


class VoiceQualityProfile(BaseModel):
    quality_score: float  # 0 to 100
    speech_duration: float
    speech_ratio: float
    snr_db: float
    clipping_detected: bool
    speaker_consistency: float
    usable_segments: int
    warnings: List[str] = Field(default_factory=list)
    quality_gate_passed: bool


class SpeakerEmbeddingData(BaseModel):
    embedding: List[float]
    dimension: int
    model_name: str
    model_version: str
    execution_time_ms: int


class VoiceAnalysisRequest(BaseModel):
    audio_path: str
    speaker_id: Optional[str] = None
    sample_rate: int = 24000
    min_quality_score: Optional[float] = 60.0
    min_snr_db: Optional[float] = 15.0
    min_consistency: Optional[float] = 0.7


class VoiceAnalysisResponse(BaseModel):
    status: str
    pitch: PitchStats
    timbre: TimbreProfile
    prosody: ProsodyProfile
    style: StyleProfile
    emotion: EmotionProfile
    quality: VoiceQualityProfile
    embedding: SpeakerEmbeddingData
    execution_time_ms: int
    profile_version: str = "1.0.0"
    encoder_version: str = "spectral-fingerprint-v1.0.0"
    analysis_version: str = "phase12a"
    reference_audio_path: Optional[str] = None
    rejection_reason: Optional[str] = None
    error: Optional[str] = None


class VoiceProfileCreateRequest(BaseModel):
    project_id: str
    user_id: str
    name: str
    source_asset_ids: List[str] = Field(default_factory=list)
    audio_paths: List[str]
    target_speaker_id: Optional[str] = "speaker_1"
    language: str = "en"
    min_quality_score: Optional[float] = 60.0
    min_snr_db: Optional[float] = 15.0
    min_consistency: Optional[float] = 0.7
    existing_profile_id: Optional[str] = None
    version: Optional[str] = None
    preview_audio_path: Optional[str] = None


class SampleAcousticDetail(BaseModel):
    sample_index: int
    audio_path: str
    duration: float
    quality_score: float
    snr_db: float
    weight: float


class VoiceProfileCreateResponse(BaseModel):
    status: str  # "READY" | "READY_WITH_LIMITATIONS" | "FAILED" | "NEEDS_REVIEW" | "TEMPORARY" | "PREVIEW_READY"
    readiness_state: str = "READY"
    voice_profile_id: Optional[str] = None
    name: str
    target_speaker_id: str
    language: str
    quality_score: float
    quality_gate_passed: bool
    pitch: PitchStats
    timbre: TimbreProfile
    prosody: ProsodyProfile
    style: StyleProfile
    emotion: EmotionProfile
    embedding: SpeakerEmbeddingData
    usable_samples_count: int
    total_speech_duration: float
    execution_time_ms: int
    profile_version: str = "1.0.0"
    encoder_version: str = "spectral-fingerprint-v1.0.0"
    analysis_version: str = "phase12a"
    reference_audio_paths: List[str] = Field(default_factory=list)
    primary_reference_path: Optional[str] = None
    preview_audio_url: Optional[str] = None
    supported_engines: List[str] = Field(default_factory=lambda: ["xtts-v2", "openvoice-v2", "cosyvoice"])
    samples_details: List[SampleAcousticDetail] = Field(default_factory=list)
    created_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    error: Optional[str] = None


class VoiceProfilePreviewRequest(BaseModel):
    audio_path: Optional[str] = None
    voice_profile_id: Optional[str] = None
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    preview_text: Optional[str] = "Hello, this is my saved voice preview."
    language: Optional[str] = "en"
    model: Optional[str] = "xtts-v2"
    speaker_id: Optional[str] = "speaker_1"
    speed: Optional[float] = 1.0


class VoiceProfilePreviewResponse(BaseModel):
    status: str  # "PREVIEW_READY" | "FAILED"
    readiness_state: str = "PREVIEW_READY"
    preview_audio_path: str
    preview_audio_url: str
    preview_text: str
    duration: float
    valid_speech: bool
    quality_score: float
    similarity_score: float
    model_used: str = "xtts-v2"
    reference_audio_path: str
    execution_time_ms: int
    error: Optional[str] = None


class VoiceProfileDetailResponse(BaseModel):
    status: str
    readiness_state: str
    voice_profile_id: str
    name: str
    language: str
    quality_score: float
    profile_version: str
    encoder_version: str
    analysis_version: str
    reference_audio_paths: List[str]
    primary_reference_path: Optional[str]
    preview_audio_url: Optional[str]
    supported_engines: List[str]
    pitch: PitchStats
    timbre: TimbreProfile
    prosody: ProsodyProfile
    style: StyleProfile
    emotion: EmotionProfile
    created_at: Optional[str]


class VoiceCompareRequest(BaseModel):
    reference_audio_path: str
    candidate_audio_path: str


class VoiceCompareResponse(BaseModel):
    status: str
    embedding_cosine_similarity: float
    pitch_similarity: float
    timbre_similarity: float
    prosody_similarity: float
    composite_similarity_score: float
    is_same_speaker: bool
    confidence: float
    execution_time_ms: int
    error: Optional[str] = None


class VoiceQualityRequest(BaseModel):
    audio_path: str
    min_speech_duration: float = 1.0
    min_quality_score: Optional[float] = 60.0
    min_snr_db: Optional[float] = 15.0
    min_consistency: Optional[float] = 0.7


class VoiceQualityResponse(BaseModel):
    status: str
    quality: VoiceQualityProfile
    execution_time_ms: int
    error: Optional[str] = None

