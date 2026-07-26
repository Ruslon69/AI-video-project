import asyncio
import logging
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from shutil import which

from fastapi import UploadFile

from app.analysis.models import ProjectAnalysis
from app.analysis.stages import (
    collect_media_metadata,
    create_empty_transcript,
    create_missing_audio_extraction,
    detect_analysis_scenes,
    detect_analysis_silences,
    extract_analysis_audio,
    transcribe_analysis_audio,
)
from app.services.video_errors import VideoToolUnavailableError
from app.services.video_probe import probe_video_file
from app.services.video_upload import read_limited_upload, validate_video_upload

logger = logging.getLogger(__name__)
_ANALYSIS_JOB_SEMAPHORE = asyncio.Semaphore(1)


def analyze_video_content(
    content: bytes,
    filename: str,
    source_asset_id: str,
) -> ProjectAnalysis:
    with tempfile.TemporaryDirectory(prefix="project-analysis-") as temp_dir:
        temp_path = Path(temp_dir)
        input_path = temp_path / "source-video"
        audio_path = temp_path / "analysis-audio.wav"
        input_path.write_bytes(content)

        probe_data = probe_video_file(input_path)
        metadata = collect_media_metadata(probe_data, filename, len(content))

        if metadata.audio_streams:
            audio_extraction = extract_analysis_audio(input_path, audio_path)
            transcript = transcribe_analysis_audio(
                audio_path,
                metadata.duration,
            )
        else:
            audio_extraction = create_missing_audio_extraction()
            transcript = create_empty_transcript()

        scenes = detect_analysis_scenes(input_path, metadata.duration)
        silences = (
            detect_analysis_silences(audio_path, metadata.duration)
            if audio_extraction.status == "extracted"
            else []
        )

        return ProjectAnalysis(
            schema_version="1.0",
            pipeline_version="analysis-v1",
            source_asset_id=source_asset_id,
            generated_at=datetime.now(UTC),
            metadata=metadata,
            audio_extraction=audio_extraction,
            transcript=transcript,
            scenes=scenes,
            silences=silences,
        )


async def analyze_primary_video(
    file: UploadFile,
    source_asset_id: str,
) -> ProjectAnalysis:
    validate_video_upload(file)

    if which("ffmpeg") is None:
        raise VideoToolUnavailableError("ffmpeg")

    logger.info(
        "project_analysis_started",
        extra={
            "content_type": file.content_type,
            "source_asset_id": source_asset_id,
        },
    )
    try:
        async with _ANALYSIS_JOB_SEMAPHORE:
            content = await read_limited_upload(file)
            analysis = await asyncio.to_thread(
                analyze_video_content,
                content,
                file.filename or "video",
                source_asset_id,
            )

        logger.info(
            "project_analysis_completed",
            extra={
                "source_asset_id": source_asset_id,
                "scene_count": len(analysis.scenes),
                "transcript_segment_count": len(analysis.transcript.segments),
                "silence_count": len(analysis.silences),
            },
        )
        return analysis
    finally:
        await file.close()
