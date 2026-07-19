import json
import logging
import subprocess
from pathlib import Path
from shutil import which

from app.config import settings
from app.services.video_errors import (
    MissingVideoStreamError,
    VideoProbeError,
    VideoProcessingTimeoutError,
    VideoToolUnavailableError,
)

logger = logging.getLogger(__name__)


def parse_fps(rate: str | None) -> float:
    if not rate or rate == "0/0":
        return 0.0

    numerator, separator, denominator = rate.partition("/")

    try:
        if separator:
            return round(float(numerator) / float(denominator), 3)
        return round(float(rate), 3)
    except (ValueError, ZeroDivisionError):
        return 0.0


def parse_duration(value: str | None) -> float:
    try:
        return round(float(value or 0), 3)
    except ValueError:
        return 0.0


def parse_bitrate(value: str | None) -> int | None:
    try:
        return int(value) if value else None
    except ValueError:
        return None


def extract_video_stream(probe_data: dict) -> dict:
    for stream in probe_data.get("streams", []):
        if stream.get("codec_type") == "video":
            return stream

    raise MissingVideoStreamError()


def probe_video_file(path: Path) -> dict:
    if which("ffprobe") is None:
        raise VideoToolUnavailableError("ffprobe")

    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                str(path),
            ],
            capture_output=True,
            text=True,
            check=False,
            shell=False,
            timeout=settings.ffprobe_timeout_seconds,
        )
    except subprocess.TimeoutExpired as exc:
        logger.warning(
            "video_probe_timeout",
            extra={"timeout_seconds": settings.ffprobe_timeout_seconds},
        )
        raise VideoProcessingTimeoutError("ffprobe") from exc

    if result.returncode != 0:
        raise VideoProbeError()

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise VideoProbeError() from exc
