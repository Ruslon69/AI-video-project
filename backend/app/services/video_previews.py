import base64
import logging
import subprocess
import tempfile
from pathlib import Path
from shutil import which

from fastapi import UploadFile

from app.config import settings
from app.schemas.video import VideoPreviewFrame, VideoPreviews
from app.services.video_errors import (
    InvalidVideoDimensionsError,
    InvalidVideoDurationError,
    VideoPreviewGenerationError,
    VideoProcessingTimeoutError,
    VideoToolUnavailableError,
)
from app.services.video_probe import (
    extract_video_stream,
    parse_duration,
    probe_video_file,
)
from app.services.video_upload import read_limited_upload, validate_video_upload

logger = logging.getLogger(__name__)


def get_preview_count(duration: float) -> int:
    if duration < 30:
        return 3
    if duration < 120:
        return 5
    return settings.preview_max_count


def get_frame_timestamps(duration: float, frame_count: int) -> list[float]:
    if duration <= 0:
        raise InvalidVideoDurationError()

    frame_count = min(frame_count, settings.preview_max_count)
    start = duration * 0.1
    end = duration * 0.9

    if frame_count == 1:
        return [round(duration * 0.5, 3)]

    step = (end - start) / (frame_count - 1)
    return [round(start + (step * index), 3) for index in range(frame_count)]


def _encode_jpeg_data_url(path: Path) -> str:
    return f"data:image/jpeg;base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def _generate_frame(input_path: Path, output_path: Path, timestamp: float) -> None:
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-ss",
                f"{timestamp:.3f}",
                "-i",
                str(input_path),
                "-frames:v",
                "1",
                "-vf",
                f"scale='min({settings.preview_max_width},iw)':-2",
                "-q:v",
                str(settings.preview_jpeg_quality),
                "-y",
                str(output_path),
            ],
            capture_output=True,
            text=True,
            check=False,
            shell=False,
            timeout=settings.ffmpeg_timeout_seconds,
        )
    except subprocess.TimeoutExpired as exc:
        logger.warning(
            "video_preview_timeout",
            extra={"timeout_seconds": settings.ffmpeg_timeout_seconds},
        )
        raise VideoProcessingTimeoutError("ffmpeg") from exc

    if result.returncode != 0 or not output_path.exists():
        raise VideoPreviewGenerationError()


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


def _map_frames(frames: list[VideoPreviewFrame]) -> VideoPreviews:
    return VideoPreviews(
        poster=frames[len(frames) // 2],
        previews=frames,
    )


async def generate_video_previews(file: UploadFile) -> VideoPreviews:
    validate_video_upload(file)

    if which("ffmpeg") is None:
        raise VideoToolUnavailableError("ffmpeg")

    logger.info(
        "video_preview_request_started",
        extra={"content_type": file.content_type},
    )
    temp_dir: tempfile.TemporaryDirectory[str] | None = None
    try:
        content = await read_limited_upload(file)
        temp_dir = tempfile.TemporaryDirectory(prefix="video-previews-")
        temp_path = Path(temp_dir.name)
        input_path = temp_path / "upload"
        input_path.write_bytes(content)

        probe_data = probe_video_file(input_path)
        duration = _validate_probe_data(probe_data)
        timestamps = get_frame_timestamps(duration, get_preview_count(duration))
        frames: list[VideoPreviewFrame] = []

        for index, timestamp in enumerate(timestamps):
            output_path = temp_path / f"preview-{index}.jpg"
            _generate_frame(input_path, output_path, timestamp)
            frames.append(
                VideoPreviewFrame(
                    timestamp=timestamp,
                    data_url=_encode_jpeg_data_url(output_path),
                ),
            )

        logger.info(
            "video_preview_request_completed",
            extra={"duration": duration, "frame_count": len(frames)},
        )
        return _map_frames(frames)
    finally:
        if temp_dir is not None:
            temp_dir.cleanup()
        await file.close()
