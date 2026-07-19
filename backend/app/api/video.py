import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.video import VideoMetadata, VideoPreviews
from app.services.video_errors import VideoProcessingError
from app.services.video_metadata import extract_video_metadata
from app.services.video_previews import generate_video_previews

router = APIRouter(prefix="/video", tags=["video"])
logger = logging.getLogger(__name__)


def _to_http_error(exc: VideoProcessingError) -> HTTPException:
    if "timeout" in exc.log_code:
        logger.warning("video_processing_timeout", extra={"code": exc.log_code})
    else:
        logger.info("video_processing_controlled_failure", extra={"code": exc.log_code})

    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.post("/metadata", response_model=VideoMetadata)
async def video_metadata(file: UploadFile = File(...)) -> VideoMetadata:
    try:
        return await extract_video_metadata(file)
    except VideoProcessingError as exc:
        raise _to_http_error(exc) from exc


@router.post("/previews", response_model=VideoPreviews)
async def video_previews(file: UploadFile = File(...)) -> VideoPreviews:
    try:
        return await generate_video_previews(file)
    except VideoProcessingError as exc:
        raise _to_http_error(exc) from exc
