from fastapi import APIRouter, File, UploadFile

from app.schemas.video import VideoMetadata
from app.services.video_metadata import extract_video_metadata

router = APIRouter(prefix="/video", tags=["video"])


@router.post("/metadata", response_model=VideoMetadata)
async def video_metadata(file: UploadFile = File(...)) -> VideoMetadata:
    return await extract_video_metadata(file)
