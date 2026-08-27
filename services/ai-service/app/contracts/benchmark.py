"""
Versioned Data Contracts for Voice Model Benchmarking & Advanced Quality Lab
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ModelBenchmarkRequest(BaseModel):
    project_id: str
    user_id: str
    model: str  # "fastpitch-baseline" | "xtts-v2" | "openvoice-v2" | "cosyvoice"
    reference_audio_path: str
    test_text: str
    language: str = "en"
    voice_profile_id: Optional[str] = None


class ModelBenchmarkResponse(BaseModel):
    benchmark_id: str
    model: str
    language: str
    audio_path: str
    duration: float
    execution_time_ms: int
    rtf: float
    vram_peak_mb: float
    vram_cleaned_mb: float
    speaker_similarity: float
    pitch_correlation: float
    timbre_match: float
    prosody_match: float
    intelligibility_score: float
    naturalness_score: float
    artifacts_detected: List[str] = Field(default_factory=list)
    overall_quality_score: float
    passed: bool


class ModelComparisonRequest(BaseModel):
    project_id: str
    user_id: str
    models: List[str] = ["fastpitch-baseline", "xtts-v2", "openvoice-v2"]
    reference_audio_path: str
    test_text: str
    language: str = "en"


class ModelComparisonResponse(BaseModel):
    benchmark_results: List[ModelBenchmarkResponse]
    best_similarity_model: str
    lowest_latency_model: str
    lowest_vram_model: str
    recommended_model: str
    tradeoff_summary: str


class ModelRecommendationRequest(BaseModel):
    language: str = "en"
    max_vram_mb: float = 6000.0  # 6GB budget on RTX 3050
    priority: str = "balanced"  # "latency" | "similarity" | "balanced" | "multilingual"


class ModelRecommendationResponse(BaseModel):
    recommended_model: str
    alternative_model: str
    rationale: str
    metrics: Dict[str, Any]


class LongFormSynthesisRequest(BaseModel):
    project_id: str
    user_id: str
    voice_profile_id: str
    long_script: str
    language: str = "en"
    model: str = "fastpitch-baseline"
    chunk_size_words: int = 25


class LongFormSynthesisResponse(BaseModel):
    output_audio_path: str
    total_duration: float
    chunks_synthesized: int
    seams_crossfaded: int
    execution_time_ms: int
    quality_score: float
    status: str
