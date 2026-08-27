"""
Abstract Provider Interfaces for Audio and Media Ingestion
"""
from abc import ABC, abstractmethod
from typing import Optional
from app.contracts.media import (
    MediaProbeResponse,
    AudioNormalizeResponse,
    VideoExtractAudioResponse,
    MediaProcessResponse
)


class MediaProbeProvider(ABC):
    @abstractmethod
    def probe(self, file_path: str) -> MediaProbeResponse:
        pass


class AudioProcessorProvider(ABC):
    @abstractmethod
    def normalize_audio(
        self,
        input_path: str,
        output_path: Optional[str] = None,
        target_sample_rate: int = 24000,
        target_channels: int = 1,
        target_format: str = "wav"
    ) -> AudioNormalizeResponse:
        pass


class AudioExtractorProvider(ABC):
    @abstractmethod
    def extract_audio_from_video(
        self,
        video_path: str,
        output_audio_path: Optional[str] = None,
        target_sample_rate: int = 24000,
        target_channels: int = 1
    ) -> VideoExtractAudioResponse:
        pass
