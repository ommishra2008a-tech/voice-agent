import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException

from app.contracts.speech import (
    VADRequest,
    VADResponse,
    STTRequest,
    STTResponse,
    DiarizeRequest,
    DiarizeResponse,
    SpeechProcessRequest,
    SpeechProcessResponse
)
from app.providers.vad_provider import EnergySileroVADProvider
from app.providers.stt_provider import FasterWhisperSTTProvider
from app.providers.diarization_provider import AcousticClusteringDiarizer
from app.providers.alignment_provider import TranscriptSpeakerAligner
from app.providers.model_manager import model_manager

router = APIRouter(prefix="/v1/speech", tags=["Speech Pipeline"])

vad_provider = EnergySileroVADProvider()
stt_provider = FasterWhisperSTTProvider()
diarize_provider = AcousticClusteringDiarizer()
aligner = TranscriptSpeakerAligner()


@router.post("/vad", response_model=VADResponse)
def detect_voice_activity(req: VADRequest):
    res = vad_provider.detect_speech(req.audio_path, threshold=req.threshold)
    if res.status == "FAILED":
        raise HTTPException(status_code=400, detail=res.error or "VAD processing failed")
    return res


@router.post("/stt", response_model=STTResponse)
def transcribe_audio(req: STTRequest):
    res = stt_provider.transcribe(
        audio_path=req.audio_path,
        language=req.language,
        model_size=req.model_size,
        beam_size=req.beam_size
    )
    if res.status == "FAILED":
        raise HTTPException(status_code=400, detail=res.error or "STT transcription failed")
    return res


@router.post("/diarize", response_model=DiarizeResponse)
def diarize_audio(req: DiarizeRequest):
    res = diarize_provider.diarize(
        audio_path=req.audio_path,
        expected_speakers=req.expected_speakers,
        min_speakers=req.min_speakers,
        max_speakers=req.max_speakers
    )
    if res.status == "FAILED":
        raise HTTPException(status_code=400, detail=res.error or "Diarization failed")
    return res


@router.post("/process", response_model=SpeechProcessResponse)
def process_full_speech_pipeline(req: SpeechProcessRequest):
    start_time = time.time()

    # 1. Voice Activity Detection
    vad_res = vad_provider.detect_speech(req.audio_path)
    if vad_res.status == "FAILED":
        return SpeechProcessResponse(
            source_asset_id=req.source_asset_id,
            status="FAILED",
            full_text="",
            detected_language="unknown",
            duration=0.0,
            speech_duration=0.0,
            speaker_count=0,
            speakers=[],
            vad_segments=[],
            diarization_segments=[],
            attributed_transcript=[],
            execution_time_ms=int((time.time() - start_time) * 1000),
            error=vad_res.error or "VAD step failed"
        )

    # 2. Speech-to-Text Transcription
    stt_res = stt_provider.transcribe(
        audio_path=req.audio_path,
        language=req.language,
        model_size=req.model_size
    )
    if stt_res.status == "FAILED":
        return SpeechProcessResponse(
            source_asset_id=req.source_asset_id,
            status="FAILED",
            full_text="",
            detected_language="unknown",
            duration=vad_res.total_audio_duration,
            speech_duration=vad_res.total_speech_duration,
            speaker_count=0,
            speakers=[],
            vad_segments=vad_res.speech_segments,
            diarization_segments=[],
            attributed_transcript=[],
            execution_time_ms=int((time.time() - start_time) * 1000),
            error=stt_res.error or "STT transcription step failed"
        )

    # 3. Speaker Diarization
    diarize_res = diarize_provider.diarize(
        audio_path=req.audio_path,
        expected_speakers=req.expected_speakers
    )

    # 4. Transcript-Speaker Alignment
    attributed_transcript = aligner.align(
        stt_segments=stt_res.segments,
        diarization_segments=diarize_res.segments
    )

    vram_info = model_manager.get_vram_usage()

    return SpeechProcessResponse(
        source_asset_id=req.source_asset_id,
        status="COMPLETED",
        full_text=stt_res.full_text,
        detected_language=stt_res.detected_language,
        duration=stt_res.duration,
        speech_duration=vad_res.total_speech_duration,
        speaker_count=diarize_res.speaker_count,
        speakers=diarize_res.speakers,
        vad_segments=vad_res.speech_segments,
        diarization_segments=diarize_res.segments,
        attributed_transcript=attributed_transcript,
        execution_time_ms=int((time.time() - start_time) * 1000),
        model_vram_mb=int(vram_info.get("allocated_mb", 0))
    )


from app.providers.timing_engine import DubbingTimingEngine, LipSyncAnalyzer, SegmentTimingDecision, LipSyncFrame
from pydantic import BaseModel

class DubbingTimingRequest(BaseModel):
    segment_id: str
    speaker_id: str
    source_start: float
    source_end: float
    generated_duration: float
    generated_audio_path: Optional[str] = None

class LipSyncRequest(BaseModel):
    audio_path: str
    fps: int = 30

@router.post("/dubbing/timing", response_model=SegmentTimingDecision)
def evaluate_dubbing_timing(req: DubbingTimingRequest):
    return DubbingTimingEngine.evaluate_timing(
        segment_id=req.segment_id,
        speaker_id=req.speaker_id,
        source_start=req.source_start,
        source_end=req.source_end,
        generated_duration=req.generated_duration,
        generated_audio_path=req.generated_audio_path
    )

@router.post("/lipsync")
def extract_lipsync(req: LipSyncRequest):
    frames = LipSyncAnalyzer.analyze_wav(req.audio_path, fps=req.fps)
    return {
        "status": "COMPLETED",
        "audio_path": req.audio_path,
        "fps": req.fps,
        "total_frames": len(frames),
        "frames": [f.dict() for f in frames]
    }

@router.get("/models")
def get_speech_models():
    return {
        "active_device": model_manager.get_device(),
        "vram_status": model_manager.get_vram_usage(),
        "supported_stt_models": ["tiny", "base", "small", "medium", "large-v3"],
        "active_loaded_models": list(model_manager.loaded_models.keys())
    }

