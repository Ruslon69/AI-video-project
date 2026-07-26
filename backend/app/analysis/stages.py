import logging
import re
import subprocess
from pathlib import Path

from app.analysis.models import (
    AnalysisAudioExtraction,
    AnalysisAudioStream,
    AnalysisMediaMetadata,
    AnalysisScene,
    AnalysisSilence,
    AnalysisTranscript,
    AnalysisTranscriptSegment,
)
from app.config import settings
from app.services.video_errors import (
    InvalidVideoDimensionsError,
    InvalidVideoDurationError,
    VideoProcessingError,
    VideoProcessingTimeoutError,
)
from app.services.video_probe import (
    extract_video_stream,
    parse_bitrate,
    parse_duration,
    parse_fps,
)
from app.services.video_scenes import build_scene_response, run_scene_detection
from app.services.video_transcription import extract_audio, transcribe_audio

logger = logging.getLogger(__name__)

_SILENCE_START_PATTERN = re.compile(
    r"silence_start:\s*(?P<timestamp>-?\d+(?:\.\d+)?)",
)
_SILENCE_END_PATTERN = re.compile(
    r"silence_end:\s*(?P<timestamp>-?\d+(?:\.\d+)?)"
    r"\s*\|\s*silence_duration:\s*(?P<duration>\d+(?:\.\d+)?)",
)


class SilenceDetectionError(VideoProcessingError):
    def __init__(self) -> None:
        super().__init__(
            "Could not detect silence in the uploaded video.",
            422,
            "silence_detection_failure",
        )


def collect_media_metadata(
    probe_data: dict,
    filename: str,
    file_size: int,
) -> AnalysisMediaMetadata:
    video_stream = extract_video_stream(probe_data)
    format_data = probe_data.get("format", {})
    duration = parse_duration(format_data.get("duration"))
    width = int(video_stream.get("width") or 0)
    height = int(video_stream.get("height") or 0)

    if duration <= 0:
        raise InvalidVideoDurationError()

    if width <= 0 or height <= 0:
        raise InvalidVideoDimensionsError()

    audio_streams = [
        AnalysisAudioStream(
            index=int(stream.get("index") or 0),
            codec=str(stream.get("codec_name") or "unknown"),
            channels=_parse_optional_int(stream.get("channels")),
            sample_rate=_parse_optional_int(stream.get("sample_rate")),
            channel_layout=stream.get("channel_layout"),
            language=stream.get("tags", {}).get("language"),
        )
        for stream in probe_data.get("streams", [])
        if stream.get("codec_type") == "audio"
    ]

    return AnalysisMediaMetadata(
        filename=filename,
        duration=duration,
        width=width,
        height=height,
        fps=parse_fps(
            video_stream.get("avg_frame_rate")
            or video_stream.get("r_frame_rate"),
        ),
        codec=str(video_stream.get("codec_name") or "unknown"),
        bitrate=parse_bitrate(
            format_data.get("bit_rate") or video_stream.get("bit_rate"),
        ),
        file_size=file_size,
        audio_streams=audio_streams,
    )


def extract_analysis_audio(
    input_path: Path,
    audio_path: Path,
) -> AnalysisAudioExtraction:
    extract_audio(input_path, audio_path)
    return AnalysisAudioExtraction(
        status="extracted",
        format="wav",
        sample_rate=16000,
        channels=1,
    )


def create_missing_audio_extraction() -> AnalysisAudioExtraction:
    return AnalysisAudioExtraction(
        status="not_available",
        format="wav",
        sample_rate=16000,
        channels=1,
    )


def transcribe_analysis_audio(
    audio_path: Path,
    duration: float,
) -> AnalysisTranscript:
    transcription = transcribe_audio(audio_path, duration)

    return AnalysisTranscript(
        language=transcription.language,
        segments=[
            AnalysisTranscriptSegment(
                id=segment.id,
                start=segment.start,
                end=segment.end,
                text=segment.text,
                confidence=segment.confidence,
            )
            for segment in transcription.segments
        ],
    )


def create_empty_transcript() -> AnalysisTranscript:
    return AnalysisTranscript(language="unknown", segments=[])


def detect_analysis_scenes(
    input_path: Path,
    duration: float,
) -> list[AnalysisScene]:
    timestamps = run_scene_detection(input_path)
    scene_response = build_scene_response(timestamps, duration)
    confidence = 1.0 if not timestamps else settings.scene_detection_threshold

    return [
        AnalysisScene(
            id=scene.id,
            start=scene.start,
            end=scene.end,
            confidence=confidence,
        )
        for scene in scene_response.scenes
    ]


def parse_silence_ranges(
    ffmpeg_output: str,
    media_duration: float,
) -> list[AnalysisSilence]:
    starts = [
        float(match.group("timestamp"))
        for match in _SILENCE_START_PATTERN.finditer(ffmpeg_output)
    ]
    ends = list(_SILENCE_END_PATTERN.finditer(ffmpeg_output))
    silences: list[AnalysisSilence] = []

    for index, start in enumerate(starts):
        end_match = ends[index] if index < len(ends) else None
        end = (
            float(end_match.group("timestamp"))
            if end_match
            else media_duration
        )
        normalized_start = round(min(max(start, 0), media_duration), 3)
        normalized_end = round(
            min(max(end, normalized_start), media_duration),
            3,
        )
        duration = round(normalized_end - normalized_start, 3)

        if duration < settings.silence_min_duration_seconds:
            continue

        silences.append(
            AnalysisSilence(
                id=f"silence-{len(silences) + 1}",
                start=normalized_start,
                end=normalized_end,
                duration=duration,
            ),
        )

    return silences


def detect_analysis_silences(
    audio_path: Path,
    media_duration: float,
) -> list[AnalysisSilence]:
    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-v",
                "info",
                "-i",
                str(audio_path),
                "-af",
                (
                    "silencedetect="
                    f"noise={settings.silence_noise_threshold_db}dB:"
                    f"d={settings.silence_min_duration_seconds}"
                ),
                "-f",
                "null",
                "-",
            ],
            capture_output=True,
            text=True,
            check=False,
            shell=False,
            timeout=settings.analysis_timeout_seconds,
        )
    except subprocess.TimeoutExpired as exc:
        logger.warning(
            "analysis_silence_detection_timeout",
            extra={"timeout_seconds": settings.analysis_timeout_seconds},
        )
        raise VideoProcessingTimeoutError("ffmpeg") from exc

    if result.returncode != 0:
        raise SilenceDetectionError()

    return parse_silence_ranges(result.stderr, media_duration)


def _parse_optional_int(value: object) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None
