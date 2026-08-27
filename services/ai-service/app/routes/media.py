import os
import time
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.contracts.media import (
    MediaProbeRequest,
    MediaProbeResponse,
    AudioNormalizeRequest,
    AudioNormalizeResponse,
    VideoExtractAudioRequest,
    VideoExtractAudioResponse,
    MediaProcessRequest,
    MediaProcessResponse
)
from app.providers.ffmpeg_processor import FFmpegMediaProcessor

router = APIRouter(prefix="/v1", tags=["Media Processing"])
processor = FFmpegMediaProcessor()


@router.get("/media/audio/raw")
@router.get("/audio/raw")
@router.head("/media/audio/raw")
@router.head("/audio/raw")
def get_raw_audio_file(path: str):
    """Serve synthesized or processed raw audio file with strict security boundaries and proper WAV headers."""
    if not path or len(path.strip()) == 0:
        raise HTTPException(status_code=400, detail="Path parameter is required")

    # Prevent path traversal attacks
    if ".." in path:
        raise HTTPException(status_code=403, detail="ACCESS_DENIED: Path traversal is forbidden")

    target_path = os.path.abspath(path)
    if not os.path.exists(target_path):
        alt_path = os.path.abspath(os.path.join(os.getcwd(), path))
        if os.path.exists(alt_path):
            target_path = alt_path
        else:
            raise HTTPException(status_code=404, detail="Audio file not found")

    # Validate that target_path is within project workspace storage boundaries
    workspace_root = os.path.abspath(os.path.join(os.getcwd(), "..", ".."))
    service_root = os.path.abspath(os.getcwd())
    allowed_roots = [
        os.path.abspath(os.path.join(service_root, "storage")),
        os.path.abspath(os.path.join(workspace_root, "storage")),
        os.path.abspath(os.path.join(workspace_root, "tests", "fixtures")),
        os.path.abspath(os.path.join(service_root, "tests", "fixtures"))
    ]

    is_allowed = any(target_path.startswith(root) for root in allowed_roots)
    if not is_allowed:
        raise HTTPException(status_code=403, detail="ACCESS_DENIED: Access to file path outside authorized audio storage is forbidden")

    if os.path.getsize(target_path) == 0:
        raise HTTPException(status_code=500, detail="Generated audio file is empty (0 bytes)")

    filename = os.path.basename(target_path)
    return FileResponse(
        path=target_path,
        media_type="audio/wav",
        filename=filename,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Disposition": f"inline; filename={filename}",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*"
        }
    )


@router.post("/audio/probe", response_model=MediaProbeResponse)
def probe_media(req: MediaProbeRequest):
    res = processor.probe(req.file_path)
    if not res.is_valid_media and res.error:
        # Return response model containing error metadata
        return res
    return res

@router.post("/audio/normalize", response_model=AudioNormalizeResponse)
def normalize_audio(req: AudioNormalizeRequest):
    res = processor.normalize_audio(
        input_path=req.input_path,
        output_path=req.output_path,
        target_sample_rate=req.target_sample_rate,
        target_channels=req.target_channels,
        target_format=req.target_format
    )
    if res.status == "FAILED":
        raise HTTPException(status_code=400, detail=res.error or "Audio normalization failed")
    return res

@router.post("/video/extract-audio", response_model=VideoExtractAudioResponse)
def extract_audio(req: VideoExtractAudioRequest):
    res = processor.extract_audio_from_video(
        video_path=req.video_path,
        output_audio_path=req.output_audio_path,
        target_sample_rate=req.target_sample_rate,
        target_channels=req.target_channels
    )
    if res.status == "FAILED":
        raise HTTPException(status_code=400, detail=res.error or "Audio extraction failed")
    return res

@router.post("/media/process", response_model=MediaProcessResponse)
def process_media_pipeline(req: MediaProcessRequest):
    start_time = time.time()
    probe_res = processor.probe(req.file_path)
    if not probe_res.is_valid_media:
        return MediaProcessResponse(
            source_asset_id=req.source_asset_id,
            status="FAILED",
            original_duration=0.0,
            processed_audio_path="",
            sample_rate=0,
            channels=0,
            format="unknown",
            size_bytes=0,
            execution_time_ms=int((time.time() - start_time) * 1000),
            probe=probe_res,
            error=probe_res.error or "Invalid or unreadable media file"
        )

    # If video, extract audio first
    if probe_res.has_video:
        extract_res = processor.extract_audio_from_video(
            video_path=req.file_path,
            target_sample_rate=req.target_sample_rate,
            target_channels=1
        )
        if extract_res.status == "FAILED":
            return MediaProcessResponse(
                source_asset_id=req.source_asset_id,
                status="FAILED",
                original_duration=probe_res.duration,
                processed_audio_path="",
                sample_rate=0,
                channels=0,
                format="wav",
                size_bytes=0,
                execution_time_ms=int((time.time() - start_time) * 1000),
                probe=probe_res,
                error=extract_res.error or "Video audio extraction failed"
            )
        processed_path = extract_res.output_audio_path
        duration = extract_res.duration
        sample_rate = extract_res.sample_rate
        channels = extract_res.channels
    else:
        # Normalize audio directly
        norm_res = processor.normalize_audio(
            input_path=req.file_path,
            target_sample_rate=req.target_sample_rate,
            target_channels=1,
            target_format="wav"
        )
        if norm_res.status == "FAILED":
            return MediaProcessResponse(
                source_asset_id=req.source_asset_id,
                status="FAILED",
                original_duration=probe_res.duration,
                processed_audio_path="",
                sample_rate=0,
                channels=0,
                format="wav",
                size_bytes=0,
                execution_time_ms=int((time.time() - start_time) * 1000),
                probe=probe_res,
                error=norm_res.error or "Audio normalization failed"
            )
        processed_path = norm_res.output_path
        duration = norm_res.duration
        sample_rate = norm_res.sample_rate
        channels = norm_res.channels

    exec_time = int((time.time() - start_time) * 1000)
    size_bytes = probe_res.size_bytes

    return MediaProcessResponse(
        source_asset_id=req.source_asset_id,
        status="READY",
        original_duration=probe_res.duration,
        processed_audio_path=processed_path,
        sample_rate=sample_rate,
        channels=channels,
        format="wav",
        size_bytes=size_bytes,
        execution_time_ms=exec_time,
        probe=probe_res
    )
