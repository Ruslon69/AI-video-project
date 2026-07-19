from pydantic import BaseModel


class VideoMetadata(BaseModel):
    filename: str
    duration: float
    width: int
    height: int
    fps: float
    codec: str
    bitrate: int | None
    file_size: int


class VideoPreviewFrame(BaseModel):
    timestamp: float
    data_url: str


class VideoPreviews(BaseModel):
    poster: VideoPreviewFrame
    previews: list[VideoPreviewFrame]


class VideoScenes(BaseModel):
    scene_count: int
    timestamps: list[float]


class VideoTranscriptSegment(BaseModel):
    id: int
    start: float
    end: float
    text: str


class VideoTranscription(BaseModel):
    language: str
    duration: float
    segments: list[VideoTranscriptSegment]
