import time
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from app.contracts.media_source import (
    URLAnalysisRequest,
    URLAnalysisResponse,
    MediaSourceProcessRequest,
    MediaSourceProcessResponse,
    SelectSpeakerRequest,
    SelectSpeakerResponse
)
from app.providers.media_source import (
    MediaProviderRegistry,
    MediaSourceOrchestrator
)

router = APIRouter(prefix="/v1/source", tags=["URL / YouTube Media Source Pipeline"])


@router.post("/probe", response_model=URLAnalysisResponse)
def probe_media_url(req: URLAnalysisRequest):
    start_time = time.time()
    if not req.url or len(req.url.strip()) == 0:
        raise HTTPException(status_code=400, detail="Cannot probe empty URL")

    adapter = MediaProviderRegistry.get_adapter(req.url)
    if not adapter:
        return URLAnalysisResponse(
            valid=False,
            provider="unknown",
            error=f"No suitable provider adapter found for URL: {req.url}",
            execution_time_ms=int((time.time() - start_time) * 1000)
        )

    try:
        meta = adapter.analyze_url(req.url)
        return URLAnalysisResponse(
            valid=True,
            provider=meta.provider,
            metadata=meta,
            execution_time_ms=int((time.time() - start_time) * 1000)
        )
    except Exception as e:
        return URLAnalysisResponse(
            valid=False,
            provider="error",
            error=str(e),
            execution_time_ms=int((time.time() - start_time) * 1000)
        )


@router.post("/process", response_model=MediaSourceProcessResponse)
def process_media_source(req: MediaSourceProcessRequest):
    res = MediaSourceOrchestrator.process_url(req)
    if res.status == "FAILED":
        raise HTTPException(status_code=400, detail=res.error or "Media URL processing failed")
    return res


@router.post("/select-speaker", response_model=SelectSpeakerResponse)
def select_target_speaker(req: SelectSpeakerRequest):
    profile_id = f"prof_{req.source_asset_id}_{req.speaker_id}" if req.create_voice_profile else None

    return SelectSpeakerResponse(
        source_asset_id=req.source_asset_id,
        selected_speaker_id=req.speaker_id,
        is_primary=(req.speaker_id == "speaker_1"),
        voice_profile_id=profile_id,
        candidate_profile={
            "speaker_id": req.speaker_id,
            "profile_name": req.profile_name or f"Candidate {req.speaker_id.upper()}",
            "f0_mean": 145.0 if req.speaker_id == "speaker_1" else 195.0,
            "quality_score": 94.5,
            "ready_for_synthesis": True
        }
    )


@router.get("/providers")
def list_supported_providers():
    return {
        "supported_providers": [
            {
                "id": "youtube",
                "name": "YouTube Video & Captions Adapter",
                "patterns": ["youtube.com/*", "youtu.be/*"],
                "direct_captions": True,
                "audio_extraction": True,
                "status": "ACTIVE"
            },
            {
                "id": "generic_media",
                "name": "Direct Media Stream Adapter",
                "patterns": ["*.mp3", "*.wav", "*.mp4", "*.webm"],
                "direct_captions": False,
                "audio_extraction": True,
                "status": "ACTIVE"
            }
        ]
    }
