from fastapi import UploadFile

from app.config import settings
from app.services.video_errors import (
    EmptyVideoUploadError,
    MissingVideoUploadError,
    UnsupportedVideoError,
    VideoUploadTooLargeError,
)

READ_CHUNK_SIZE = 1024 * 1024


def validate_video_upload(file: UploadFile) -> None:
    if not file.filename:
        raise MissingVideoUploadError()

    if file.content_type and not file.content_type.startswith("video/"):
        raise UnsupportedVideoError()

    size = getattr(file, "size", None)
    if size is not None and size > settings.max_upload_size_bytes:
        raise VideoUploadTooLargeError()


async def read_limited_upload(file: UploadFile) -> bytes:
    content = bytearray()

    while True:
        chunk = await file.read(READ_CHUNK_SIZE)
        if not chunk:
            break

        content.extend(chunk)
        if len(content) > settings.max_upload_size_bytes:
            raise VideoUploadTooLargeError()

    if not content:
        raise EmptyVideoUploadError()

    return bytes(content)
