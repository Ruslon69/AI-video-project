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
