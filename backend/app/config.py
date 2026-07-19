from dataclasses import dataclass
import os


def _get_int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def _get_float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    max_upload_size_bytes: int = _get_int_env(
        "VIDEO_MAX_UPLOAD_SIZE_BYTES",
        2 * 1024 * 1024 * 1024,
    )
    ffprobe_timeout_seconds: int = _get_int_env("FFPROBE_TIMEOUT_SECONDS", 30)
    ffmpeg_timeout_seconds: int = _get_int_env("FFMPEG_TIMEOUT_SECONDS", 45)
    preview_max_width: int = 480
    preview_jpeg_quality: int = 3
    preview_max_count: int = 8
    scene_detection_threshold: float = _get_float_env(
        "SCENE_DETECTION_THRESHOLD",
        0.35,
    )


settings = Settings()
