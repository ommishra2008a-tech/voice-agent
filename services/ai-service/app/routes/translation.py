import time
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from app.contracts.translation import (
    LanguageDetectionRequest,
    LanguageDetectionResponse,
    TranslationRequest,
    TranslationResponse,
    TranscriptTranslationRequest,
    TranscriptTranslationResponse,
    VoiceLanguageCompatibilityRequest,
    VoiceLanguageCompatibilityResponse,
    TranslationToVoiceRequest,
    TranslationToVoiceResponse
)
from app.providers.translation_provider import (
    LanguageDetector,
    translator,
    TranscriptTranslator,
    VoiceLanguageCompatibilityChecker,
    EndToEndTranslationVoicePipeline
)

router = APIRouter(prefix="/v1/translation", tags=["Translation & Multilingual Voice Pipeline"])


@router.post("/detect", response_model=LanguageDetectionResponse)
def detect_language(req: LanguageDetectionRequest):
    return LanguageDetector.detect(req.text)


@router.post("/translate", response_model=TranslationResponse)
def translate_text(req: TranslationRequest):
    res = translator.translate(req)
    if res.error:
        raise HTTPException(status_code=400, detail=res.error)
    return res


@router.post("/transcript", response_model=TranscriptTranslationResponse)
def translate_transcript(req: TranscriptTranslationRequest):
    return TranscriptTranslator.translate_transcript(req, translator)


@router.post("/compatibility", response_model=VoiceLanguageCompatibilityResponse)
def check_voice_language_compatibility(req: VoiceLanguageCompatibilityRequest):
    return VoiceLanguageCompatibilityChecker.check_compatibility(req)


@router.post("/synthesize", response_model=TranslationToVoiceResponse)
def translate_and_synthesize_voice(req: TranslationToVoiceRequest):
    res = EndToEndTranslationVoicePipeline.translate_and_synthesize(req, translator)
    if res.status == "FAILED":
        raise HTTPException(status_code=400, detail=res.error or "Translation to speech failed")
    return res


@router.get("/models")
def list_translation_models():
    return {
        "active_provider": "local-neural-translator",
        "default_model": "nllb-200-distilled-600M",
        "supported_languages": ["en", "hi", "es", "fr", "de"],
        "bidirectional_pairs": [
            "en <-> hi",
            "en <-> es",
            "en <-> fr",
            "en <-> de"
        ],
        "glossary_support": True,
        "status": "HEALTHY"
    }
