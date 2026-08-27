import os
import time
import math
import logging
from abc import ABC, abstractmethod
from typing import Optional, List
from app.contracts.speech import STTSegment, STTResponse
from app.providers.model_manager import model_manager
from app.providers.ffmpeg_processor import FFmpegMediaProcessor

logger = logging.getLogger(__name__)


class SpeechRecognizer(ABC):
    @abstractmethod
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        model_size: str = "base",
        beam_size: int = 5
    ) -> STTResponse:
        pass


class FasterWhisperSTTProvider(SpeechRecognizer):
    def __init__(self):
        self.processor = FFmpegMediaProcessor()

    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        model_size: str = "base",
        beam_size: int = 5
    ) -> STTResponse:
        start_time = time.time()
        if not os.path.exists(audio_path):
            return STTResponse(
                status="FAILED",
                full_text="",
                detected_language="unknown",
                language_probability=0.0,
                duration=0.0,
                segments=[],
                execution_time_ms=0,
                model_used=f"faster-whisper-{model_size}",
                error=f"Audio file not found: {audio_path}"
            )

        probe_res = self.processor.probe(audio_path)
        if not probe_res.is_valid_media or probe_res.duration == 0:
            return STTResponse(
                status="FAILED",
                full_text="",
                detected_language="unknown",
                language_probability=0.0,
                duration=0.0,
                segments=[],
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=f"faster-whisper-{model_size}",
                error="Invalid or 0-byte audio file"
            )

        duration = probe_res.duration

        try:
            from faster_whisper import WhisperModel
            device = model_manager.get_device()
            compute_type = "float16" if device == "cuda" else "int8"
            
            # Load model through model manager
            model_key = f"faster_whisper_{model_size}_{device}"
            if model_key not in model_manager.loaded_models:
                try:
                    model = WhisperModel(model_size, device=device, compute_type=compute_type)
                except Exception as cuda_err:
                    logger.warning(f"CUDA Whisper init failed ({cuda_err}), falling back to CPU")
                    model = WhisperModel(model_size, device="cpu", compute_type="int8")
                model_manager.loaded_models[model_key] = model
            else:
                model = model_manager.loaded_models[model_key]

            fw_segments, info = model.transcribe(
                audio_path,
                language=language,
                beam_size=beam_size,
                vad_filter=True
            )

            segments: List[STTSegment] = []
            full_text_parts = []
            for s in fw_segments:
                seg_text = s.text.strip()
                full_text_parts.append(seg_text)
                confidence = round(math.exp(s.avg_logprob), 3) if hasattr(s, "avg_logprob") and s.avg_logprob is not None else 0.95
                segments.append(STTSegment(
                    start_time=round(s.start, 3),
                    end_time=round(s.end, 3),
                    text=seg_text,
                    confidence=max(0.0, min(1.0, confidence))
                ))

            detected_lang = info.language if hasattr(info, "language") else (language or "en")
            lang_prob = info.language_probability if hasattr(info, "language_probability") else 0.99
            full_text = " ".join(full_text_parts)

            return STTResponse(
                status="COMPLETED",
                full_text=full_text,
                detected_language=detected_lang,
                language_probability=round(lang_prob, 3),
                duration=duration,
                segments=segments,
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=f"faster-whisper-{model_size}-{device}"
            )

        except Exception as e:
            logger.error(f"STT transcription failed: {e}", exc_info=True)
            return STTResponse(
                status="FAILED",
                full_text="",
                detected_language="unknown",
                language_probability=0.0,
                duration=duration,
                segments=[],
                execution_time_ms=int((time.time() - start_time) * 1000),
                model_used=f"faster-whisper-{model_size}",
                error=f"Transcription error: {str(e)}"
            )

