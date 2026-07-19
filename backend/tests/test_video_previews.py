import unittest

from app.services.video_errors import (
    InvalidVideoDimensionsError,
    InvalidVideoDurationError,
    MissingVideoStreamError,
)
from app.services.video_previews import (
    _validate_probe_data,
    get_frame_timestamps,
    get_preview_count,
)


class VideoPreviewCalculationTests(unittest.TestCase):
    def test_frame_count_by_duration(self) -> None:
        self.assertEqual(get_preview_count(12), 3)
        self.assertEqual(get_preview_count(30), 5)
        self.assertEqual(get_preview_count(119.9), 5)
        self.assertEqual(get_preview_count(120), 8)

    def test_timestamps_are_distributed_inside_duration(self) -> None:
        self.assertEqual(get_frame_timestamps(100, 5), [10, 30, 50, 70, 90])

    def test_timestamp_calculation_rejects_invalid_duration(self) -> None:
        with self.assertRaises(InvalidVideoDurationError):
            get_frame_timestamps(0, 3)


class VideoPreviewValidationTests(unittest.TestCase):
    def test_validation_rejects_missing_video_stream(self) -> None:
        probe_data = {
            "format": {"duration": "12"},
            "streams": [{"codec_type": "audio"}],
        }

        with self.assertRaises(MissingVideoStreamError):
            _validate_probe_data(probe_data)

    def test_validation_rejects_invalid_duration(self) -> None:
        probe_data = {
            "format": {"duration": "0"},
            "streams": [{"codec_type": "video", "width": 1920, "height": 1080}],
        }

        with self.assertRaises(InvalidVideoDurationError):
            _validate_probe_data(probe_data)

    def test_validation_rejects_invalid_dimensions(self) -> None:
        probe_data = {
            "format": {"duration": "12"},
            "streams": [{"codec_type": "video", "width": 0, "height": 1080}],
        }

        with self.assertRaises(InvalidVideoDimensionsError):
            _validate_probe_data(probe_data)


if __name__ == "__main__":
    unittest.main()
