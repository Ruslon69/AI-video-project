import unittest
from pathlib import Path
from subprocess import TimeoutExpired
from unittest.mock import patch

from app.services.video_errors import (
    InvalidVideoDimensionsError,
    InvalidVideoDurationError,
    MissingVideoStreamError,
    VideoProcessingTimeoutError,
)
from app.services.video_scenes import (
    _run_scene_detection,
    _validate_probe_data,
    build_scene_response,
    parse_scene_timestamps,
)


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

    def test_build_scene_response_returns_no_scene_changes_for_single_shot(self) -> None:
        scenes = build_scene_response([], 12.345, 25)

        self.assertEqual(scenes.outcome, "no_scene_changes")
        self.assertEqual(len(scenes.scenes), 1)
        self.assertEqual(scenes.scenes[0].start, 0)
        self.assertEqual(scenes.scenes[0].end, 12.345)
        self.assertEqual(scenes.scenes[0].duration, 12.345)
        self.assertEqual(scenes.processingTimeMs, 25)

    def test_build_scene_response_returns_segments_for_detected_boundaries(self) -> None:
        scenes = build_scene_response([2.5, 8.0], 10.0, 31)

        self.assertEqual(scenes.outcome, "scenes_detected")
        self.assertEqual(len(scenes.scenes), 3)
        self.assertEqual(scenes.scenes[0].model_dump(), {
            "id": "scene-1",
            "start": 0,
            "end": 2.5,
            "duration": 2.5,
        })
        self.assertEqual(scenes.scenes[2].model_dump(), {
            "id": "scene-3",
            "start": 8.0,
            "end": 10.0,
            "duration": 2.0,
        })

    def test_build_scene_response_sorts_and_filters_boundaries(self) -> None:
        scenes = build_scene_response([6, 4.0, 0, 1.5, 1.5004], 6)

        self.assertEqual(scenes.outcome, "scenes_detected")
        self.assertEqual([scene.start for scene in scenes.scenes], [0, 1.5, 4.0])


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


class VideoSceneExecutionTests(unittest.TestCase):
    @patch("app.services.video_scenes.subprocess.run")
    def test_run_scene_detection_uses_scene_timeout(self, run_mock) -> None:
        run_mock.return_value.returncode = 0
        run_mock.return_value.stderr = "pts_time:1.5"

        self.assertEqual(_run_scene_detection(Path("/tmp/video")), [1.5])

        self.assertEqual(run_mock.call_args.kwargs["timeout"], 300)

    @patch("app.services.video_scenes.subprocess.run")
    def test_run_scene_detection_maps_timeout(self, run_mock) -> None:
        run_mock.side_effect = TimeoutExpired(["ffmpeg"], timeout=300)

        with self.assertRaises(VideoProcessingTimeoutError):
            _run_scene_detection(Path("/tmp/video"))


if __name__ == "__main__":
    unittest.main()
