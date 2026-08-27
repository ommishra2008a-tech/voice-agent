"""
FFmpeg & FFprobe Concrete Media Processor Implementation
"""
import os
import time
import json
import subprocess
import shutil
from typing import Optional, Dict, Any
from app.providers.audio_processor import (
    MediaProbeProvider,
    AudioProcessorProvider,
    AudioExtractorProvider
)
from app.contracts.media import (
    MediaProbeResponse,
    AudioStreamInfo,
    VideoStreamInfo,
    AudioNormalizeResponse,
    VideoExtractAudioResponse
)


class FFmpegMediaProcessor(MediaProbeProvider, AudioProcessorProvider, AudioExtractorProvider):
    def __init__(self):
        self._ensure_path()
        self.ffmpeg_bin = self._resolve_bin("ffmpeg")
        self.ffprobe_bin = self._resolve_bin("ffprobe")

    def _ensure_path(self):
        custom_paths = [r"C:\ffmpeg", r"C:\ffmpeg\bin"]
        current_path = os.environ.get("PATH", "")
        for cp in custom_paths:
            if os.path.exists(cp) and cp not in current_path:
                os.environ["PATH"] = cp + os.pathsep + os.environ["PATH"]

    def _resolve_bin(self, name: str) -> str:
        # Check standard PATH
        found = shutil.which(name)
        if found:
            return found

        # Check explicit paths
        common_paths = [
            r"C:\ffmpeg",
            r"C:\ffmpeg\bin",
            r"C:\ProgramData\chocolatey\bin",
            r"C:\ffmpeg\extracted"
        ]
        for cp in common_paths:
            candidate = os.path.join(cp, f"{name}.exe")
            if os.path.exists(candidate):
                return candidate

        return name

    def probe(self, file_path: str) -> MediaProbeResponse:
        if not os.path.exists(file_path):
            return MediaProbeResponse(
                file_path=file_path,
                format_name="unknown",
                duration=0.0,
                size_bytes=0,
                has_audio=False,
                has_video=False,
                is_valid_media=False,
                error=f"File not found: {file_path}"
            )

        size_bytes = os.path.getsize(file_path)
        if size_bytes == 0:
            return MediaProbeResponse(
                file_path=file_path,
                format_name="unknown",
                duration=0.0,
                size_bytes=0,
                has_audio=False,
                has_video=False,
                is_valid_media=False,
                error="File is empty (0 bytes)"
            )

        cmd = [
            self.ffprobe_bin,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path
        ]

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=15)
            data = json.loads(res.stdout)
            format_info = data.get("format", {})
            streams = data.get("streams", [])

            has_audio = False
            has_video = False
            audio_stream_info = None
            video_stream_info = None

            for s in streams:
                codec_type = s.get("codec_type")
                if codec_type == "audio" and not has_audio:
                    has_audio = True
                    audio_stream_info = AudioStreamInfo(
                        codec_name=s.get("codec_name", "unknown"),
                        sample_rate=int(s.get("sample_rate", 0)),
                        channels=int(s.get("channels", 1)),
                        bit_rate=int(s.get("bit_rate")) if s.get("bit_rate") else None,
                        duration=float(s.get("duration") or format_info.get("duration") or 0.0)
                    )
                elif codec_type == "video" and not has_video:
                    has_video = True
                    fps_val = 0.0
                    fps_str = s.get("r_frame_rate", "0/1")
                    if "/" in fps_str:
                        num, den = fps_str.split("/")
                        if float(den) > 0:
                            fps_val = float(num) / float(den)
                    video_stream_info = VideoStreamInfo(
                        codec_name=s.get("codec_name", "unknown"),
                        width=int(s.get("width", 0)),
                        height=int(s.get("height", 0)),
                        fps=fps_val,
                        duration=float(s.get("duration") or format_info.get("duration") or 0.0)
                    )

            duration = float(format_info.get("duration", 0.0))
            if duration == 0.0:
                if audio_stream_info and audio_stream_info.duration > 0:
                    duration = audio_stream_info.duration
                elif video_stream_info and video_stream_info.duration > 0:
                    duration = video_stream_info.duration

            return MediaProbeResponse(
                file_path=file_path,
                format_name=format_info.get("format_name", "unknown"),
                duration=duration,
                size_bytes=size_bytes,
                bit_rate=int(format_info.get("bit_rate")) if format_info.get("bit_rate") else None,
                has_audio=has_audio,
                has_video=has_video,
                audio_stream=audio_stream_info,
                video_stream=video_stream_info,
                is_valid_media=(has_audio or has_video)
            )

        except subprocess.TimeoutExpired:
            return MediaProbeResponse(
                file_path=file_path,
                format_name="unknown",
                duration=0.0,
                size_bytes=size_bytes,
                has_audio=False,
                has_video=False,
                is_valid_media=False,
                error="ffprobe command timed out"
            )
        except Exception as e:
            return MediaProbeResponse(
                file_path=file_path,
                format_name="unknown",
                duration=0.0,
                size_bytes=size_bytes,
                has_audio=False,
                has_video=False,
                is_valid_media=False,
                error=f"ffprobe failed: {str(e)}"
            )

    def normalize_audio(
        self,
        input_path: str,
        output_path: Optional[str] = None,
        target_sample_rate: int = 24000,
        target_channels: int = 1,
        target_format: str = "wav"
    ) -> AudioNormalizeResponse:
        start_time = time.time()
        if not output_path:
            base, _ = os.path.splitext(input_path)
            output_path = f"{base}_normalized_{target_sample_rate}hz.{target_format}"

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        cmd = [
            self.ffmpeg_bin,
            "-y",
            "-i", input_path,
            "-vn",
            "-ar", str(target_sample_rate),
            "-ac", str(target_channels),
            "-c:a", "pcm_s16le",
            output_path
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=30)
            exec_time = int((time.time() - start_time) * 1000)
            probe_res = self.probe(output_path)

            return AudioNormalizeResponse(
                status="COMPLETED",
                output_path=output_path,
                duration=probe_res.duration,
                sample_rate=target_sample_rate,
                channels=target_channels,
                format=target_format,
                size_bytes=probe_res.size_bytes,
                execution_time_ms=exec_time
            )
        except Exception as e:
            return AudioNormalizeResponse(
                status="FAILED",
                output_path=output_path or "",
                duration=0.0,
                sample_rate=0,
                channels=0,
                format=target_format,
                size_bytes=0,
                execution_time_ms=int((time.time() - start_time) * 1000),
                error=str(e)
            )

    def extract_audio_from_video(
        self,
        video_path: str,
        output_audio_path: Optional[str] = None,
        target_sample_rate: int = 24000,
        target_channels: int = 1
    ) -> VideoExtractAudioResponse:
        start_time = time.time()
        if not output_audio_path:
            base, _ = os.path.splitext(video_path)
            output_audio_path = f"{base}_extracted_audio.wav"

        os.makedirs(os.path.dirname(os.path.abspath(output_audio_path)), exist_ok=True)

        cmd = [
            self.ffmpeg_bin,
            "-y",
            "-i", video_path,
            "-vn",
            "-ar", str(target_sample_rate),
            "-ac", str(target_channels),
            "-c:a", "pcm_s16le",
            output_audio_path
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=60)
            exec_time = int((time.time() - start_time) * 1000)
            probe_res = self.probe(output_audio_path)

            return VideoExtractAudioResponse(
                status="COMPLETED",
                output_audio_path=output_audio_path,
                duration=probe_res.duration,
                sample_rate=target_sample_rate,
                channels=target_channels,
                execution_time_ms=exec_time
            )
        except Exception as e:
            return VideoExtractAudioResponse(
                status="FAILED",
                output_audio_path=output_audio_path or "",
                duration=0.0,
                sample_rate=0,
                channels=0,
                execution_time_ms=int((time.time() - start_time) * 1000),
                error=str(e)
            )
