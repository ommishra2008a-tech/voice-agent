"""
Versioned Data Contracts for Media Processing Pipeline
TypeScript <-> Python Interop
"""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class MediaProbeRequest(BaseModel):
    file_path: str = Field(..., description="Absolute or relative path to media file")


class AudioStreamInfo(BaseModel):
    codec_name: str
    sample_rate: int
    channels: int
    bit_rate: Optional[int] = None
    duration: float


class VideoStreamInfo(BaseModel):
    codec_name: str
    width: int
    height: int
    fps: float
    duration: float


class MediaProbeResponse(BaseModel):
    file_path: str
    format_name: str
    duration: float
    size_bytes: int
    bit_rate: Optional[int] = None
    has_audio: bool
    has_video: bool
    audio_stream: Optional[AudioStreamInfo] = None
    video_stream: Optional[VideoStreamInfo] = None
    is_valid_media: bool
    error: Optional[str] = None

    @property
    def sample_rate(self) -> Optional[int]:
        return self.audio_stream.sample_rate if self.audio_stream else None

    @property
    def channels(self) -> Optional[int]:
        return self.audio_stream.channels if self.audio_stream else None



class AudioNormalizeRequest(BaseModel):
    input_path: str
    output_path: Optional[str] = None
    target_sample_rate: int = Field(default=24000, description="Target sample rate for TTS/downstream models")
    target_channels: int = Field(default=1, description="1 for Mono, 2 for Stereo")
    target_format: str = Field(default="wav", description="Target audio container format")


class AudioNormalizeResponse(BaseModel):
    status: str
    output_path: str
    duration: float
    sample_rate: int
    channels: int
    format: str
    size_bytes: int
    execution_time_ms: int
    error: Optional[str] = None


class VideoExtractAudioRequest(BaseModel):
    video_path: str
    output_audio_path: Optional[str] = None
    target_sample_rate: int = 24000
    target_channels: int = 1


class VideoExtractAudioResponse(BaseModel):
    status: str
    output_audio_path: str
    duration: float
    sample_rate: int
    channels: int
    execution_time_ms: int
    error: Optional[str] = None


class MediaProcessRequest(BaseModel):
    source_asset_id: str
    file_path: str
    media_type: str = "audio"  # "audio" | "video"
    target_sample_rate: int = 24000


class MediaProcessResponse(BaseModel):
    source_asset_id: str
    status: str  # "READY" | "FAILED"
    original_duration: float
    processed_audio_path: str
    sample_rate: int
    channels: int
    format: str
    size_bytes: int
    execution_time_ms: int
    probe: MediaProbeResponse
    error: Optional[str] = None
