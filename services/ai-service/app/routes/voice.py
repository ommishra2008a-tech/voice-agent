import time
import os
import uuid
import json
import shutil
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from app.contracts.voice_profile import (
    VoiceAnalysisRequest,
    VoiceAnalysisResponse,
    VoiceProfileCreateRequest,
    VoiceProfileCreateResponse,
    VoiceProfilePreviewRequest,
    VoiceProfilePreviewResponse,
    VoiceProfileDetailResponse,
    SampleAcousticDetail,
    VoiceCompareRequest,
    VoiceCompareResponse,
    VoiceQualityRequest,
    VoiceQualityResponse,
    PitchStats,
    TimbreProfile,
    ProsodyProfile,
    StyleProfile,
    EmotionProfile
)
from app.contracts.voice_generation import VoiceGenerationRequest
from app.providers.voice_analyzer import (
    ReferenceAudioLoader,
    PitchAnalyzer,
    TimbreAnalyzer,
    ProsodyAnalyzer,
    StyleAnalyzer,
    EmotionAnalyzer,
    VoiceQualityAnalyzer,
    SpeakerIdentityEncoder,
    VoiceComparator,
    MultiSampleVoiceAggregator
)
from app.providers.voice_engine import VoiceEngineRegistry, AudioValidator, GeneratedVoiceEvaluator
from app.providers.ffmpeg_processor import FFmpegMediaProcessor
from app.providers.model_manager import model_manager

import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/voice", tags=["Voice Profile System"])
processor = FFmpegMediaProcessor()

VOICE_STORAGE_DIR = os.path.join(os.getcwd(), "storage", "voices")
PROFILE_STORAGE_DIR = os.path.join(os.getcwd(), "storage", "voice_profiles")
os.makedirs(VOICE_STORAGE_DIR, exist_ok=True)
os.makedirs(PROFILE_STORAGE_DIR, exist_ok=True)


@router.post("/upload")
async def upload_reference_audio(file: UploadFile = File(...)):
    """
    Upload a reference audio file for voice analysis.
    Saves to storage/voices/ and returns the server-side path.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    allowed_exts = {".wav", ".mp3", ".ogg", ".flac", ".m4a", ".webm", ".mp4"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}. Allowed: {', '.join(allowed_exts)}")

    file_id = str(uuid.uuid4())[:12]
    safe_name = f"ref_{file_id}{ext}"
    save_path = os.path.join(VOICE_STORAGE_DIR, safe_name)

    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        with open(save_path, "wb") as f:
            f.write(content)

        # Convert to WAV if not already WAV (e.g. m4a, mp3, ogg, flac)
        wav_path = save_path
        if ext != ".wav":
            wav_path = os.path.splitext(save_path)[0] + ".wav"
            try:
                convert_result = processor.normalize_audio(
                    input_path=save_path,
                    output_path=wav_path,
                    target_sample_rate=24000,
                    target_channels=1,
                    target_format="wav"
                )
                if convert_result.status == "FAILED" or not os.path.exists(wav_path) or os.path.getsize(wav_path) == 0:
                    raise RuntimeError(convert_result.error or "Audio normalization produced an empty file")
                logger.info(f"Successfully normalized {ext} to 24kHz mono WAV: {wav_path}")
            except Exception as conv_err:
                logger.error(f"Normalization failed for {save_path}: {conv_err}")
                raise HTTPException(
                    status_code=400,
                    detail=f"VOICE_AUDIO_NORMALIZATION_FAILED: Could not convert {ext} audio to 24kHz mono WAV format ({str(conv_err)})"
                )

        probe = processor.probe(wav_path)

        return JSONResponse({
            "status": "UPLOADED",
            "audio_path": wav_path,
            "original_filename": file.filename,
            "file_id": file_id,
            "format": ext,
            "duration": probe.duration if probe.is_valid_media else 0,
            "size_bytes": len(content)
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/analyze", response_model=VoiceAnalysisResponse)
def analyze_voice(req: VoiceAnalysisRequest):
    """
    Full multi-dimensional voice analysis on reference audio.
    All metrics computed from real signal processing on actual PCM waveform data.
    """
    start_time = time.time()
    if not os.path.exists(req.audio_path):
        raise HTTPException(status_code=400, detail=f"Audio file not found: {req.audio_path}")

    # Load real audio samples
    try:
        samples, sr, duration = ReferenceAudioLoader.load(req.audio_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load audio: {str(e)}")

    if duration == 0 or len(samples) == 0:
        raise HTTPException(status_code=400, detail="Invalid or 0-byte reference audio")

    speaker_id = req.speaker_id or "speaker_1"

    # Run full analysis pipeline on real signal
    pitch = PitchAnalyzer.analyze(req.audio_path, duration, samples, sr)
    timbre = TimbreAnalyzer.analyze(req.audio_path, samples, sr)
    prosody = ProsodyAnalyzer.analyze(req.audio_path, duration, samples, sr)
    style = StyleAnalyzer.analyze(req.audio_path, samples, sr, pitch, prosody)
    emotion = EmotionAnalyzer.analyze(req.audio_path, duration, samples, sr, pitch)
    quality = VoiceQualityAnalyzer.evaluate(
        req.audio_path, duration, True, samples, sr,
        min_quality_score=req.min_quality_score or 60.0,
        min_snr_db=req.min_snr_db or 15.0,
        min_consistency=req.min_consistency or 0.7
    )
    embedding = SpeakerIdentityEncoder.extract_fingerprint(req.audio_path, speaker_id, samples, sr)

    # Determine rejection reason if quality gate fails
    rejection_reason = None
    if not quality.quality_gate_passed:
        reasons = []
        if quality.quality_score < (req.min_quality_score or 60.0):
            reasons.append(f"Quality score {quality.quality_score} below threshold {req.min_quality_score}")
        if quality.snr_db < (req.min_snr_db or 15.0):
            reasons.append(f"SNR {quality.snr_db}dB below minimum {req.min_snr_db}dB")
        if quality.speaker_consistency < (req.min_consistency or 0.7):
            reasons.append(f"Speaker consistency {quality.speaker_consistency} below {req.min_consistency}")
        if quality.clipping_detected:
            reasons.append("Audio clipping detected")
        if quality.speech_ratio < 0.2:
            reasons.append(f"Speech ratio {quality.speech_ratio} too low")
        rejection_reason = "; ".join(reasons) if reasons else "Quality gate not met"

    status = "COMPLETED" if quality.quality_gate_passed else "NEEDS_REVIEW"

    return VoiceAnalysisResponse(
        status=status,
        pitch=pitch,
        timbre=timbre,
        prosody=prosody,
        style=style,
        emotion=emotion,
        quality=quality,
        embedding=embedding,
        execution_time_ms=int((time.time() - start_time) * 1000),
        reference_audio_path=req.audio_path,
        rejection_reason=rejection_reason
    )


@router.post("/profile/preview", response_model=VoiceProfilePreviewResponse)
@router.post("/preview", response_model=VoiceProfilePreviewResponse)
def generate_voice_preview(req: VoiceProfilePreviewRequest):
    """
    Generate a real speech preview from reference audio or profile before permanent saving.
    Infers with XTTSv2 using NEW preview test text and validates audible speech.
    """
    start_time = time.time()
    preview_text = req.preview_text or "Hello, this is my saved voice preview."
    lang = req.language or "en"
    model_name = req.model or "xtts-v2"

    ref_audio = None
    if req.audio_path and os.path.exists(req.audio_path):
        ref_audio = os.path.abspath(req.audio_path)
    elif req.voice_profile_id:
        engine = VoiceEngineRegistry.get_engine("xtts-v2")
        ref_audio = engine._resolve_reference_audio(req.voice_profile_id)

    if not ref_audio or not os.path.exists(ref_audio):
        raise HTTPException(
            status_code=400,
            detail="Reference audio not found for preview generation. Please supply valid audio_path or voice_profile_id."
        )

    # Destination for preview audio
    preview_id = f"prev_{uuid.uuid4().hex[:12]}"
    preview_dir = os.path.join(os.getcwd(), "storage", "generated_audio")
    os.makedirs(preview_dir, exist_ok=True)
    preview_path = os.path.join(preview_dir, f"{preview_id}.wav")

    engine = VoiceEngineRegistry.get_engine(model_name)
    gen_req = VoiceGenerationRequest(
        project_id="preview",
        user_id="preview_user",
        voice_profile_id=ref_audio,  # Pass direct reference path
        text=preview_text,
        language=lang,
        model=model_name,
        speed=req.speed or 1.0,
        sample_rate=24000
    )

    gen_res = engine.synthesize(gen_req, output_path=preview_path)
    if gen_res.status != "COMPLETED" or not os.path.exists(preview_path):
        raise HTTPException(status_code=500, detail=gen_res.error or "Preview speech synthesis failed")

    # Validate output audio
    validation = AudioValidator.classify_audio(preview_path)
    eval_res = GeneratedVoiceEvaluator.evaluate(ref_audio, preview_path)

    exec_time = int((time.time() - start_time) * 1000)
    preview_url = f"http://localhost:8000/v1/media/audio/raw?path={os.path.abspath(preview_path)}"

    return VoiceProfilePreviewResponse(
        status="PREVIEW_READY",
        readiness_state="PREVIEW_READY",
        preview_audio_path=preview_path,
        preview_audio_url=preview_url,
        preview_text=preview_text,
        duration=gen_res.duration,
        valid_speech=validation.get("valid_speech", False),
        quality_score=round(eval_res.overall_quality_score * 100, 1),
        similarity_score=eval_res.speaker_embedding_similarity,
        model_used=model_name,
        reference_audio_path=ref_audio,
        execution_time_ms=exec_time
    )


@router.post("/profile/{profile_id}/preview", response_model=VoiceProfilePreviewResponse)
def generate_profile_id_preview(profile_id: str, preview_text: Optional[str] = None):
    req = VoiceProfilePreviewRequest(
        voice_profile_id=profile_id,
        preview_text=preview_text or "Hello, this is my saved voice preview."
    )
    return generate_voice_preview(req)


@router.post("/profile", response_model=VoiceProfileCreateResponse)
def create_voice_profile(req: VoiceProfileCreateRequest):
    """
    Create or update a versioned Voice Profile with durable reference storage.
    Aggregates multiple samples if provided with quality-aware weighting.
    """
    start_time = time.time()
    now_iso = datetime.now(timezone.utc).isoformat()

    if not req.audio_paths or len(req.audio_paths) == 0:
        raise HTTPException(status_code=400, detail="At least one audio path is required for voice profile creation")

    profile_id = req.existing_profile_id or f"vp_{uuid.uuid4().hex[:16]}"
    speaker_id = req.target_speaker_id or "speaker_1"

    # Versioning: support v1, v2, etc.
    version = req.version or ("1.1.0" if req.existing_profile_id else "1.0.0")

    try:
        agg_result = MultiSampleVoiceAggregator.aggregate_and_persist(
            profile_id=profile_id,
            audio_paths=req.audio_paths,
            name=req.name,
            target_speaker_id=speaker_id,
            min_quality_score=req.min_quality_score or 60.0,
            min_snr_db=req.min_snr_db or 15.0,
            min_consistency=req.min_consistency or 0.7
        )
    except Exception as e:
        logger.error(f"Failed to aggregate and persist voice profile {profile_id}: {e}", exc_info=True)
        return VoiceProfileCreateResponse(
            status="FAILED",
            readiness_state="FAILED",
            voice_profile_id=profile_id,
            name=req.name,
            target_speaker_id=speaker_id,
            language=req.language,
            quality_score=0.0,
            quality_gate_passed=False,
            pitch=PitchAnalyzer.analyze("", 0.0),
            timbre=TimbreAnalyzer.analyze(""),
            prosody=ProsodyAnalyzer.analyze("", 0.0),
            style=StyleAnalyzer.analyze(""),
            emotion=EmotionAnalyzer.analyze("", 0.0),
            embedding=SpeakerIdentityEncoder.extract_fingerprint("", speaker_id),
            usable_samples_count=0,
            total_speech_duration=0.0,
            execution_time_ms=int((time.time() - start_time) * 1000),
            reference_audio_paths=req.audio_paths,
            created_at=now_iso,
            rejection_reason=f"Failed to process reference audio: {str(e)}",
            error=str(e)
        )

    quality = agg_result["quality"]
    quality_gate_passed = quality.quality_gate_passed
    readiness_state = "READY" if quality_gate_passed else "READY_WITH_LIMITATIONS"

    rejection_reason = None
    if not quality_gate_passed:
        reasons = []
        if quality.quality_score < (req.min_quality_score or 60.0):
            reasons.append(f"Quality {quality.quality_score} < {req.min_quality_score}")
        if quality.snr_db < (req.min_snr_db or 15.0):
            reasons.append(f"SNR {quality.snr_db}dB < {req.min_snr_db}dB")
        if quality.speaker_consistency < (req.min_consistency or 0.7):
            reasons.append(f"Consistency {quality.speaker_consistency} < {req.min_consistency}")
        if quality.clipping_detected:
            reasons.append("Clipping detected")
        rejection_reason = "; ".join(reasons) if reasons else "Quality gate not fully met"

    preview_url = None
    if req.preview_audio_path and os.path.exists(req.preview_audio_path):
        preview_url = f"http://localhost:8000/v1/media/audio/raw?path={os.path.abspath(req.preview_audio_path)}"

    return VoiceProfileCreateResponse(
        status="READY" if quality_gate_passed else "NEEDS_REVIEW",
        readiness_state=readiness_state,
        voice_profile_id=profile_id,
        name=req.name,
        target_speaker_id=speaker_id,
        language=req.language,
        quality_score=quality.quality_score,
        quality_gate_passed=quality_gate_passed,
        pitch=agg_result["pitch"],
        timbre=agg_result["timbre"],
        prosody=agg_result["prosody"],
        style=agg_result["style"],
        emotion=agg_result["emotion"],
        embedding=agg_result["embedding"],
        usable_samples_count=agg_result["usable_samples_count"],
        total_speech_duration=agg_result["total_speech_duration"],
        execution_time_ms=int((time.time() - start_time) * 1000),
        profile_version=version,
        encoder_version="spectral-fingerprint-v1.0.0",
        analysis_version="phase12a",
        reference_audio_paths=agg_result["durable_paths"],
        primary_reference_path=agg_result["primary_reference_path"],
        preview_audio_url=preview_url,
        supported_engines=["xtts-v2", "openvoice-v2", "cosyvoice"],
        samples_details=agg_result["samples_details"],
        created_at=now_iso,
        rejection_reason=rejection_reason
    )


@router.get("/profile/{profile_id}", response_model=VoiceProfileDetailResponse)
def get_voice_profile_detail(profile_id: str):
    """Retrieve details and reference linkage for a saved voice profile."""
    profile_dir = os.path.join(PROFILE_STORAGE_DIR, profile_id)
    manifest_path = os.path.join(profile_dir, "profile.json")

    primary_ref = os.path.join(profile_dir, "reference.wav")
    if not os.path.exists(primary_ref):
        primary_ref = os.path.join(VOICE_STORAGE_DIR, f"{profile_id}.wav")

    if not os.path.exists(primary_ref):
        raise HTTPException(status_code=404, detail=f"Voice profile '{profile_id}' not found in storage")

    try:
        samples, sr, dur = ReferenceAudioLoader.load(primary_ref)
        pitch = PitchAnalyzer.analyze(primary_ref, dur, samples, sr)
        timbre = TimbreAnalyzer.analyze(primary_ref, samples, sr)
        prosody = ProsodyAnalyzer.analyze(primary_ref, dur, samples, sr)
        style = StyleAnalyzer.analyze(primary_ref, samples, sr, pitch, prosody)
        emotion = EmotionAnalyzer.analyze(primary_ref, dur, samples, sr, pitch)
        quality = VoiceQualityAnalyzer.evaluate(primary_ref, dur, True, samples, sr)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to inspect profile audio: {e}")

    ref_paths = [primary_ref]
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                man = json.load(f)
            ref_paths = man.get("reference_audio_paths", ref_paths)
        except Exception:
            pass

    return VoiceProfileDetailResponse(
        status="READY" if quality.quality_gate_passed else "READY_WITH_LIMITATIONS",
        readiness_state="READY" if quality.quality_gate_passed else "READY_WITH_LIMITATIONS",
        voice_profile_id=profile_id,
        name=f"Voice Profile {profile_id[:8]}",
        language="en",
        quality_score=quality.quality_score,
        profile_version="1.0.0",
        encoder_version="spectral-fingerprint-v1.0.0",
        analysis_version="phase12a",
        reference_audio_paths=ref_paths,
        primary_reference_path=primary_ref,
        preview_audio_url=None,
        supported_engines=["xtts-v2", "openvoice-v2", "cosyvoice"],
        pitch=pitch,
        timbre=timbre,
        prosody=prosody,
        style=style,
        emotion=emotion,
        created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )


@router.post("/compare", response_model=VoiceCompareResponse)
def compare_voices(req: VoiceCompareRequest):
    return VoiceComparator.compare(req.reference_audio_path, req.candidate_audio_path)


@router.post("/quality", response_model=VoiceQualityResponse)
def evaluate_voice_quality(req: VoiceQualityRequest):
    start_time = time.time()
    if not os.path.exists(req.audio_path):
        raise HTTPException(status_code=400, detail=f"Audio file not found: {req.audio_path}")

    try:
        samples, sr, duration = ReferenceAudioLoader.load(req.audio_path)
    except Exception:
        probe_res = processor.probe(req.audio_path)
        samples, sr, duration = None, 16000, probe_res.duration

    quality = VoiceQualityAnalyzer.evaluate(
        req.audio_path, duration,
        True if duration > 0 else False,
        samples, sr,
        min_quality_score=req.min_quality_score or 60.0,
        min_snr_db=req.min_snr_db or 15.0,
        min_consistency=req.min_consistency or 0.7
    )

    return VoiceQualityResponse(
        status="COMPLETED",
        quality=quality,
        execution_time_ms=int((time.time() - start_time) * 1000)
    )


@router.get("/models")
def get_voice_models():
    return {
        "speaker_encoder": "spectral-fingerprint",
        "encoder_version": "v1.0.0-phase12a",
        "encoder_type": "deterministic-acoustic-fingerprint",
        "neural_encoder_available": False,
        "neural_encoder_slot": "resemblyzer-dvector / ECAPA-TDNN (future)",
        "embedding_dimension": 256,
        "pitch_tracker": "autocorrelation-f0",
        "timbre_analyzer": "fft-spectral-moments-mfcc13",
        "quality_analyzer": "signal-level-snr-vad",
        "analysis_version": "phase12a",
        "device": model_manager.get_device(),
        "vram_status": model_manager.get_vram_usage()
    }
