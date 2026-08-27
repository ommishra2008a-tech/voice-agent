"""
Versioned Data Contracts for URL / YouTube / Media Source Ingestion Pipeline
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SourceMetadata(BaseModel):
    provider: str  # "youtube" | "generic_media" | "direct_url"
    url: str
    external_id: str
    title: str
    duration: float
    language: str = "en"
    channel: Optional[str] = None
    thumbnail_url: Optional[str] = None
    has_captions: bool = True
    has_audio: bool = True
    capabilities: List[str] = Field(default_factory=list)


class URLAnalysisRequest(BaseModel):
    url: str


class URLAnalysisResponse(BaseModel):
    valid: bool
    provider: str
    metadata: Optional[SourceMetadata] = None
    error: Optional[str] = None
    execution_time_ms: int


class SourceSpeakerCandidate(BaseModel):
    speaker_id: str
    total_duration: float
    segment_count: int
    speaking_percentage: float
    quality_score: float
    f0_mean: float
    spectral_centroid: float
    embedding_sample: List[float] = Field(default_factory=list)


class MediaSourceProcessRequest(BaseModel):
    project_id: str
    user_id: str
    url: str
    prefer_captions: bool = True
    extract_speakers: bool = True
    index_to_rag: bool = True


class MediaSourceProcessResponse(BaseModel):
    source_asset_id: str
    project_id: str
    provider: str
    title: str
    duration: float
    stages_completed: List[str]
    transcript_segments_count: int
    speakers_detected_count: int
    speakers: List[SourceSpeakerCandidate]
    rag_chunks_indexed: int
    execution_time_ms: int
    status: str  # "READY" | "FAILED"
    error: Optional[str] = None


class SelectSpeakerRequest(BaseModel):
    project_id: str
    user_id: str
    source_asset_id: str
    speaker_id: str
    create_voice_profile: bool = False
    profile_name: Optional[str] = None


class SelectSpeakerResponse(BaseModel):
    source_asset_id: str
    selected_speaker_id: str
    is_primary: bool
    voice_profile_id: Optional[str] = None
    candidate_profile: Dict[str, Any]
