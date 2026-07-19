import json
import subprocess
import tempfile
from pathlib import Path
from shutil import which
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.schemas.video import VideoMetadata


def _parse_fps(rate: str | None) -> float:
    if not rate or rate == "0/0":
        return 0.0

    numerator, separator, denominator = rate.partition("/")

    try:
        if separator:
            return round(float(numerator) / float(denominator), 3)
        return round(float(rate), 3)
    except (ValueError, ZeroDivisionError):
        return 0.0


def _parse_duration(value: str | None) -> float:
    try:
        return round(float(value or 0), 3)
    except ValueError:
        return 0.0


def _parse_bitrate(value: str | None) -> int | None:
    try:
        return int(value) if value else None
    except ValueError:
        return None


def _extract_video_stream(probe_data: dict) -> dict:
    for stream in probe_data.get("streams", []):
        if stream.get("codec_type") == "video":
            return stream

    raise HTTPException(
        status_code=400,
        detail="Could not find a video stream in the uploaded file.",
    )


async def extract_video_metadata(file: UploadFile) -> VideoMetadata:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No video file was uploaded.")

    if which("ffprobe") is None:
        raise HTTPException(status_code=500, detail="ffprobe is not installed.")

    suffix = Path(file.filename).suffix
    temp_path = Path(tempfile.gettempdir()) / f"upload-{uuid4().hex}{suffix}"

    try:
        content = await file.read()

        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        temp_path.write_bytes(content)

        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                str(temp_path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=400,
                detail="Could not extract metadata from the uploaded video.",
            )

        try:
            probe_data = json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=400,
                detail="ffprobe returned invalid metadata.",
            ) from exc

        video_stream = _extract_video_stream(probe_data)
        format_data = probe_data.get("format", {})

        return VideoMetadata(
            filename=file.filename,
            duration=_parse_duration(format_data.get("duration")),
            width=int(video_stream.get("width") or 0),
            height=int(video_stream.get("height") or 0),
            fps=_parse_fps(
                video_stream.get("avg_frame_rate")
                or video_stream.get("r_frame_rate"),
            ),
            codec=video_stream.get("codec_name") or "unknown",
            bitrate=_parse_bitrate(
                format_data.get("bit_rate") or video_stream.get("bit_rate"),
            ),
            file_size=len(content),
        )
    finally:
        await file.close()
        temp_path.unlink(missing_ok=True)
