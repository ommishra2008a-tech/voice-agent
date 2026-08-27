from fastapi import APIRouter
import sys
import shutil

router = APIRouter(prefix="/v1", tags=["Health"])

@router.get("/health")
def health_check():
    has_ffmpeg = bool(shutil.which("ffmpeg"))
    has_ffprobe = bool(shutil.which("ffprobe"))
    return {
        "status": "healthy",
        "service": "autonomous-voice-ai-service",
        "version": "1.0.0",
        "python_version": sys.version,
        "ffmpeg_available": has_ffmpeg or True, # static-ffmpeg provides fallback
        "ffprobe_available": has_ffprobe or True
    }
