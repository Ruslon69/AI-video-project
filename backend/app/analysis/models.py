from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


def _to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class AnalysisModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )


class AnalysisAudioStream(AnalysisModel):
    index: int
    codec: str
    channels: int | None
    sample_rate: int | None
    channel_layout: str | None
    language: str | None


class AnalysisMediaMetadata(AnalysisModel):
    filename: str
    duration: float
    width: int
    height: int
    fps: float
    codec: str
    bitrate: int | None
    file_size: int
    audio_streams: list[AnalysisAudioStream]


class AnalysisAudioExtraction(AnalysisModel):
    status: Literal["extracted", "not_available"]
    format: Literal["wav"]
    sample_rate: int
    channels: int


class AnalysisTranscriptSegment(AnalysisModel):
    id: int
    start: float
    end: float
    text: str
    confidence: float | None


class AnalysisTranscript(AnalysisModel):
    language: str
    segments: list[AnalysisTranscriptSegment]


class AnalysisScene(AnalysisModel):
    id: str
    start: float
    end: float
    confidence: float


class AnalysisSilence(AnalysisModel):
    id: str
    start: float
    end: float
    duration: float


class ProjectAnalysis(AnalysisModel):
    schema_version: Literal["1.0"]
    pipeline_version: Literal["analysis-v1"]
    source_asset_id: str
    generated_at: datetime
    metadata: AnalysisMediaMetadata
    audio_extraction: AnalysisAudioExtraction
    transcript: AnalysisTranscript
    scenes: list[AnalysisScene]
    silences: list[AnalysisSilence]
