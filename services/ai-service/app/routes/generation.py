import time
import os
from fastapi import APIRouter, HTTPException
from app.contracts.voice_generation import (
    VoiceGenerationRequest,
    VoiceGenerationResponse,
    GeneratedVoiceEvaluation,
    ABEvaluationRequest,
    ABEvaluationResponse
)
from app.providers.voice_engine import VoiceEngineRegistry, GeneratedVoiceEvaluator, AudioValidator
from app.providers.model_manager import model_manager

router = APIRouter(prefix="/v1/speech", tags=["Voice Generation Engine"])


@router.post("/generate", response_model=VoiceGenerationResponse)
def generate_voice(req: VoiceGenerationRequest):
    if not req.text or len(req.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Cannot synthesize empty text")

    engine = VoiceEngineRegistry.get_engine(req.model)
    res = engine.synthesize(req)
    if res.status == "FAILED":
        raise HTTPException(status_code=400, detail=res.error or "Voice synthesis failed")
    return res


@router.post("/evaluate", response_model=GeneratedVoiceEvaluation)
def evaluate_generation(ref_path: str, gen_path: str):
    if not os.path.exists(ref_path) or not os.path.exists(gen_path):
        raise HTTPException(status_code=400, detail="Reference or generated audio file not found")
    return GeneratedVoiceEvaluator.evaluate(ref_path, gen_path)


from app.contracts.benchmark import LongFormSynthesisRequest, LongFormSynthesisResponse
from app.providers.benchmark_engine import LongFormSynthesizer

@router.post("/longform", response_model=LongFormSynthesisResponse)
def synthesize_long_form(req: LongFormSynthesisRequest):
    if not req.long_script or len(req.long_script.strip()) == 0:
        raise HTTPException(status_code=400, detail="Long-form script cannot be empty")
    return LongFormSynthesizer.synthesize_long_form(req)

@router.get("/engines")
def list_generation_engines():
    return {
        "active_device": model_manager.get_device(),
        "vram_status": model_manager.get_vram_usage(),
        "engines": VoiceEngineRegistry.list_engines()
    }


@router.post("/debug/xtts")
def debug_xtts_direct(text: str = "Hello, this is a real voice cloning test.", language: str = "en"):
    """Direct XTTS v2 debug endpoint bypassing Solarch and frontend."""
    import logging
    logger = logging.getLogger(__name__)

    result = {"stages": {}}

    # 1. Resolve reference audio
    ref_paths = [
        os.path.join(os.getcwd(), "..", "..", "tests", "fixtures", "real_speech_reference_24k.wav"),
        os.path.join(os.getcwd(), "..", "..", "tests", "fixtures", "real_speech_reference.wav"),
        os.path.join(os.getcwd(), "..", "..", "tests", "fixtures", "sample_speech.wav"),
    ]
    ref_audio = None
    for p in ref_paths:
        abs_p = os.path.abspath(p)
        if os.path.exists(abs_p) and os.path.getsize(abs_p) > 1000:
            ref_audio = abs_p
            break

    if not ref_audio:
        result["verdict"] = "FAILED"
        result["error"] = "No reference audio found"
        return result

    # Validate reference
    ref_validation = AudioValidator.classify_audio(ref_audio)
    result["stages"]["reference"] = {
        "path": ref_audio,
        "size_bytes": os.path.getsize(ref_audio),
        "classification": ref_validation.get("classification"),
        "valid_speech": ref_validation.get("valid_speech"),
        "duration_sec": ref_validation.get("duration_sec"),
        "sample_rate": ref_validation.get("sample_rate"),
    }

    # 2. Generate via XTTS v2
    output_path = os.path.join(os.getcwd(), "storage", "generated_audio", "debug_xtts_direct.wav")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    engine = VoiceEngineRegistry.get_engine("xtts-v2")
    req = VoiceGenerationRequest(
        project_id="debug",
        user_id="debug",
        voice_profile_id="debug_anchor",
        text=text,
        language=language,
        model="xtts-v2",
        sample_rate=24000
    )

    gen_start = time.time()
    res = engine.synthesize(req, output_path)
    gen_time = int((time.time() - gen_start) * 1000)

    result["stages"]["generation"] = {
        "status": res.status,
        "audio_path": res.audio_path,
        "duration_sec": res.duration,
        "execution_time_ms": gen_time,
        "model": res.model,
        "error": res.error,
        "metadata": res.metadata,
    }

    if res.status != "COMPLETED" or not os.path.exists(res.audio_path):
        result["verdict"] = "FAILED"
        result["error"] = res.error or "Generation did not produce a file"
        return result

    # 3. Validate generated audio
    gen_validation = AudioValidator.classify_audio(res.audio_path)
    result["stages"]["output_validation"] = gen_validation

    # 4. Verdict
    if gen_validation.get("valid_speech"):
        result["verdict"] = "VALID_SPEECH"
    else:
        result["verdict"] = gen_validation.get("classification", "UNKNOWN")

    return result


@router.post("/validate-output")
def validate_audio_output(audio_path: str):
    """Validate whether an audio file contains real speech."""
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=400, detail=f"Audio file not found: {audio_path}")

    validation = AudioValidator.classify_audio(audio_path)

    # Optionally run STT
    transcript = None
    transcript_confidence = None
    try:
        from app.providers.speech_recognizer import SpeechRecognizer
        stt_result = SpeechRecognizer.transcribe(audio_path)
        if stt_result and hasattr(stt_result, 'text'):
            transcript = stt_result.text
            transcript_confidence = getattr(stt_result, 'confidence', None)
    except Exception:
        pass

    return {
        "validAudio": validation.get("valid_speech", False),
        "hasSpeech": validation.get("valid_speech", False),
        "classification": validation.get("classification", "UNKNOWN"),
        "durationSec": validation.get("duration_sec", 0),
        "rms": validation.get("rms", 0),
        "silenceRatio": validation.get("silence_ratio", 0),
        "spectralCentroid": validation.get("spectral_centroid", 0),
        "spectralBandwidth": validation.get("spectral_bandwidth", 0),
        "transcript": transcript,
        "transcriptConfidence": transcript_confidence,
    }

