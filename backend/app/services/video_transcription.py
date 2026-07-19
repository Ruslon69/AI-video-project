import asyncio
import importlib
import logging
import subprocess
import tempfile
from pathlib import Path
from shutil import which
from threading import Lock
from typing import Any

from fastapi import UploadFile

from app.config import settings
from app.schemas.video import VideoTranscriptSegment, VideoTranscription
from app.services.video_errors import (
    InvalidVideoDimensionsError,
    InvalidVideoDurationError,
    VideoAudioExtractionError,
    VideoProcessingTimeoutError,
    VideoToolUnavailableError,
    VideoTranscriptionError,
)
from app.services.video_probe import (
    extract_video_stream,
    parse_duration,
    probe_video_file,
)
from app.services.video_upload import read_limited_upload, validate_video_upload

logger = logging.getLogger(__name__)

_TRANSCRIPTION_JOB_SEMAPHORE = asyncio.Semaphore(1)
_MODEL_CACHE_LOCK = Lock()
_MODEL_CACHE: dict[str, Any] = {}


def _validate_probe_data(probe_data: dict) -> float:
    video_stream = extract_video_stream(probe_data)
    duration = parse_duration(probe_data.get("format", {}).get("duration"))
    width = int(video_stream.get("width") or 0)
    height = int(video_stream.get("height") or 0)

    if duration <= 0:
        raise InvalidVideoDurationError()

    if width <= 0 or height <= 0:
        raise InvalidVideoDimensionsError()

    return duration


def _extract_audio(input_path: Path, audio_path: Path) -> None:
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-i",
                str(input_path),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                "-f",
                "wav",
                "-y",
                str(audio_path),
            ],
            capture_output=True,
            text=True,
            check=False,
            shell=False,
            timeout=settings.ffmpeg_timeout_seconds,
        )
    except subprocess.TimeoutExpired as exc:
        logger.warning(
            "video_audio_extraction_timeout",
            extra={"timeout_seconds": settings.ffmpeg_timeout_seconds},
        )
        raise VideoProcessingTimeoutError("ffmpeg") from exc

    if result.returncode != 0 or not audio_path.exists() or audio_path.stat().st_size == 0:
        raise VideoAudioExtractionError()


def _load_whisper_model(model_name: str) -> Any:
    with _MODEL_CACHE_LOCK:
        cached_model = _MODEL_CACHE.get(model_name)
        if cached_model is not None:
            return cached_model

        try:
            whisper = importlib.import_module("whisper")
            model = whisper.load_model(model_name)
        except Exception as exc:
            logger.info(
                "whisper_model_unavailable",
                extra={"model": model_name},
            )
            raise VideoToolUnavailableError("whisper") from exc

        _MODEL_CACHE[model_name] = model
        return model


def map_whisper_result(result: dict[str, Any], duration: float) -> VideoTranscription:
    segments: list[VideoTranscriptSegment] = []
    normalized_duration = max(round(duration, 3), 0)

    for index, segment in enumerate(result.get("segments", [])):
        try:
            segment_id = int(segment.get("id", index))
            start = max(round(float(segment.get("start", 0)), 3), 0)
            end = max(round(float(segment.get("end", start)), 3), start)
        except (TypeError, ValueError) as exc:
            raise VideoTranscriptionError() from exc

        if normalized_duration > 0:
            start = min(start, normalized_duration)
            end = min(max(end, start), normalized_duration)

        text = str(segment.get("text", "")).strip()
        segments.append(
            VideoTranscriptSegment(
                id=segment_id,
                start=start,
                end=end,
                text=text,
            ),
        )

    language = str(result.get("language") or "unknown")
    return VideoTranscription(
        language=language,
        duration=normalized_duration,
        segments=segments,
    )


def _transcribe_audio(audio_path: Path, duration: float) -> VideoTranscription:
    model = _load_whisper_model(settings.whisper_model)

    try:
        result = model.transcribe(str(audio_path))
    except Exception as exc:
        raise VideoTranscriptionError() from exc

    return map_whisper_result(result, duration)


def _transcribe_video_content(content: bytes) -> VideoTranscription:
    temp_dir: tempfile.TemporaryDirectory[str] | None = None
    try:
        temp_dir = tempfile.TemporaryDirectory(prefix="video-transcription-")
        temp_path = Path(temp_dir.name)
        input_path = temp_path / "upload"
        audio_path = temp_path / "audio.wav"
        input_path.write_bytes(content)

        probe_data = probe_video_file(input_path)
        duration = _validate_probe_data(probe_data)
        _extract_audio(input_path, audio_path)
        return _transcribe_audio(audio_path, duration)
    finally:
        if temp_dir is not None:
            temp_dir.cleanup()


async def transcribe_video(file: UploadFile) -> VideoTranscription:
    validate_video_upload(file)

    if which("ffmpeg") is None:
        raise VideoToolUnavailableError("ffmpeg")

    logger.info(
        "video_transcription_request_started",
        extra={"content_type": file.content_type, "model": settings.whisper_model},
    )
    try:
        async with _TRANSCRIPTION_JOB_SEMAPHORE:
            content = await read_limited_upload(file)
            transcription = await asyncio.to_thread(_transcribe_video_content, content)

        logger.info(
            "video_transcription_request_completed",
            extra={
                "language": transcription.language,
                "segment_count": len(transcription.segments),
            },
        )
        return transcription
    finally:
        await file.close()
