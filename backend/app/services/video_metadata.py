import tempfile
from pathlib import Path

from fastapi import UploadFile

from app.schemas.video import VideoMetadata
from app.services.video_errors import (
    InvalidVideoDimensionsError,
    InvalidVideoDurationError,
)
from app.services.video_probe import (
    extract_video_stream,
    parse_bitrate,
    parse_duration,
    parse_fps,
    probe_video_file,
)
from app.services.video_upload import read_limited_upload, validate_video_upload


async def extract_video_metadata(file: UploadFile) -> VideoMetadata:
    validate_video_upload(file)
    temp_file = tempfile.NamedTemporaryFile(prefix="video-metadata-", delete=False)
    temp_path = Path(temp_file.name)
    temp_file.close()

    try:
        content = await read_limited_upload(file)
        temp_path.write_bytes(content)
        probe_data = probe_video_file(temp_path)
        video_stream = extract_video_stream(probe_data)
        format_data = probe_data.get("format", {})
        duration = parse_duration(format_data.get("duration"))
        width = int(video_stream.get("width") or 0)
        height = int(video_stream.get("height") or 0)

        if duration <= 0:
            raise InvalidVideoDurationError()

        if width <= 0 or height <= 0:
            raise InvalidVideoDimensionsError()

        return VideoMetadata(
            filename=file.filename,
            duration=duration,
            width=width,
            height=height,
            fps=parse_fps(
                video_stream.get("avg_frame_rate")
                or video_stream.get("r_frame_rate"),
            ),
            codec=video_stream.get("codec_name") or "unknown",
            bitrate=parse_bitrate(
                format_data.get("bit_rate") or video_stream.get("bit_rate"),
            ),
            file_size=len(content),
        )
    finally:
        await file.close()
        temp_path.unlink(missing_ok=True)
