import asyncio
import logging
import re
import subprocess
import tempfile
import time
from pathlib import Path
from shutil import which

from fastapi import UploadFile

from app.config import settings
from app.schemas.video import VideoScenes
from app.services.video_errors import (
    InvalidVideoDimensionsError,
    InvalidVideoDurationError,
    VideoProcessingTimeoutError,
    VideoSceneDetectionError,
    VideoToolUnavailableError,
)
from app.services.video_probe import (
    extract_video_stream,
    parse_duration,
    probe_video_file,
)
from app.services.video_upload import read_limited_upload, validate_video_upload

logger = logging.getLogger(__name__)

_SCENE_JOB_SEMAPHORE = asyncio.Semaphore(1)
_PTS_TIME_PATTERN = re.compile(r"pts_time:(?P<timestamp>\d+(?:\.\d+)?)")


def parse_scene_timestamps(ffmpeg_output: str) -> list[float]:
    timestamps: list[float] = []
    seen: set[float] = set()

    for match in _PTS_TIME_PATTERN.finditer(ffmpeg_output):
        timestamp = round(float(match.group("timestamp")), 3)
        if timestamp in seen:
            continue

        seen.add(timestamp)
        timestamps.append(timestamp)

    return timestamps


def build_scene_response(
    timestamps: list[float],
    duration: float,
    processing_time_ms: int | None = None,
) -> VideoScenes:
    normalized_duration = round(max(duration, 0), 3)
    valid_boundaries = sorted({
        round(timestamp, 3)
        for timestamp in timestamps
        if 0 < timestamp < normalized_duration
    })

    if not valid_boundaries:
        return VideoScenes(
            outcome="no_scene_changes",
            scenes=[
                {
                    "id": "scene-1",
                    "start": 0,
                    "end": normalized_duration,
                    "duration": normalized_duration,
                }
            ],
            processingTimeMs=processing_time_ms,
        )

    boundaries = [0, *valid_boundaries, normalized_duration]
    scenes = []
    for index, (start, end) in enumerate(zip(boundaries, boundaries[1:]), start=1):
        rounded_start = round(start, 3)
        rounded_end = round(end, 3)
        scenes.append(
            {
                "id": f"scene-{index}",
                "start": rounded_start,
                "end": rounded_end,
                "duration": round(max(rounded_end - rounded_start, 0), 3),
            }
        )

    return VideoScenes(
        outcome="scenes_detected",
        scenes=scenes,
        processingTimeMs=processing_time_ms,
    )


def _validate_probe_data(probe_data: dict) -> None:
    video_stream = extract_video_stream(probe_data)
    duration = parse_duration(probe_data.get("format", {}).get("duration"))
    width = int(video_stream.get("width") or 0)
    height = int(video_stream.get("height") or 0)

    if duration <= 0:
        raise InvalidVideoDurationError()

    if width <= 0 or height <= 0:
        raise InvalidVideoDimensionsError()


def _run_scene_detection(input_path: Path) -> list[float]:
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-v",
                "info",
                "-i",
                str(input_path),
                "-vf",
                f"select='gt(scene,{settings.scene_detection_threshold})',showinfo",
                "-f",
                "null",
                "-",
            ],
            capture_output=True,
            text=True,
            check=False,
            shell=False,
            timeout=settings.scene_detection_timeout_seconds,
        )
    except subprocess.TimeoutExpired as exc:
        logger.warning(
            "video_scene_detection_timeout",
            extra={"timeout_seconds": settings.scene_detection_timeout_seconds},
        )
        raise VideoProcessingTimeoutError("ffmpeg") from exc

    if result.returncode != 0:
        raise VideoSceneDetectionError()

    return parse_scene_timestamps(result.stderr)


def _detect_video_scenes_from_content(content: bytes) -> VideoScenes:
    temp_dir: tempfile.TemporaryDirectory[str] | None = None
    try:
        started_at = time.perf_counter()
        temp_dir = tempfile.TemporaryDirectory(prefix="video-scenes-")
        input_path = Path(temp_dir.name) / "upload"
        input_path.write_bytes(content)

        probe_data = probe_video_file(input_path)
        _validate_probe_data(probe_data)
        duration = parse_duration(probe_data.get("format", {}).get("duration"))
        timestamps = _run_scene_detection(input_path)
        processing_time_ms = round((time.perf_counter() - started_at) * 1000)
        return build_scene_response(timestamps, duration, processing_time_ms)
    finally:
        if temp_dir is not None:
            temp_dir.cleanup()


async def detect_video_scenes(file: UploadFile) -> VideoScenes:
    validate_video_upload(file)

    if which("ffmpeg") is None:
        raise VideoToolUnavailableError("ffmpeg")

    logger.info(
        "video_scene_detection_request_started",
        extra={"content_type": file.content_type},
    )
    try:
        async with _SCENE_JOB_SEMAPHORE:
            content = await read_limited_upload(file)
            scenes = await asyncio.to_thread(_detect_video_scenes_from_content, content)

        logger.info(
            "video_scene_detection_request_completed",
            extra={
                "outcome": scenes.outcome,
                "scene_count": len(scenes.scenes),
            },
        )
        return scenes
    finally:
        await file.close()
