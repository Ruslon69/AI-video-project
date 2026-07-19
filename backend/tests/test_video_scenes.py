import unittest

from app.services.video_errors import (
    InvalidVideoDimensionsError,
    InvalidVideoDurationError,
    MissingVideoStreamError,
)
from app.services.video_scenes import _validate_probe_data, parse_scene_timestamps


class VideoSceneParsingTests(unittest.TestCase):
    def test_parse_scene_timestamps_from_ffmpeg_showinfo_output(self) -> None:
        output = (
            "[Parsed_showinfo_1 @ 0x123] n:0 pts:1024 pts_time:1.024 pos:1\n"
            "[Parsed_showinfo_1 @ 0x123] n:1 pts:2533 pts_time:2.5333 pos:2\n"
        )

        self.assertEqual(parse_scene_timestamps(output), [1.024, 2.533])

    def test_parse_scene_timestamps_deduplicates_repeated_matches(self) -> None:
        output = "pts_time:4.2 pts_time:4.2004 pts_time:8"

        self.assertEqual(parse_scene_timestamps(output), [4.2, 8.0])

    def test_parse_scene_timestamps_returns_empty_list_without_matches(self) -> None:
        self.assertEqual(parse_scene_timestamps("no scene output"), [])


class VideoSceneValidationTests(unittest.TestCase):
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
