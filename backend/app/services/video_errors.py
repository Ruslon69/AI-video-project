from dataclasses import dataclass


@dataclass
class VideoProcessingError(Exception):
    message: str
    status_code: int = 400
    log_code: str = "video_processing_error"


class UnsupportedVideoError(VideoProcessingError):
    def __init__(self, message: str = "Unsupported video upload."):
        super().__init__(message, 415, "unsupported_video")


class MissingVideoUploadError(VideoProcessingError):
    def __init__(self):
        super().__init__("No video file was uploaded.", 400, "missing_video_upload")


class EmptyVideoUploadError(VideoProcessingError):
    def __init__(self):
        super().__init__("Uploaded file is empty.", 400, "empty_video_upload")


class MissingVideoStreamError(VideoProcessingError):
    def __init__(self):
        super().__init__(
            "Could not find a video stream in the uploaded file.",
            400,
            "missing_video_stream",
        )


class InvalidVideoDurationError(VideoProcessingError):
    def __init__(self):
        super().__init__(
            "Uploaded video has an invalid or zero duration.",
            400,
            "invalid_video_duration",
        )


class InvalidVideoDimensionsError(VideoProcessingError):
    def __init__(self):
        super().__init__(
            "Uploaded video has invalid dimensions.",
            400,
            "invalid_video_dimensions",
        )


class VideoUploadTooLargeError(VideoProcessingError):
    def __init__(self):
        super().__init__(
            "Uploaded video exceeds the size limit.",
            413,
            "upload_too_large",
        )


class VideoToolUnavailableError(VideoProcessingError):
    def __init__(self, tool_name: str):
        super().__init__(
            f"{tool_name} is not available on the backend.",
            500,
            f"{tool_name}_unavailable",
        )


class VideoProbeError(VideoProcessingError):
    def __init__(self):
        super().__init__(
            "Could not extract metadata from the uploaded video.",
            400,
            "ffprobe_failure",
        )


class VideoPreviewGenerationError(VideoProcessingError):
    def __init__(self):
        super().__init__(
            "Could not generate video preview frames.",
            422,
            "ffmpeg_failure",
        )


class VideoSceneDetectionError(VideoProcessingError):
    def __init__(self):
        super().__init__(
            "Could not detect video scenes.",
            422,
            "scene_detection_failure",
        )


class VideoProcessingTimeoutError(VideoProcessingError):
    def __init__(self, tool_name: str):
        super().__init__(
            "Video processing timed out.",
            504,
            f"{tool_name}_timeout",
        )
