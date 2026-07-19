import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.services.video_errors import (
    InvalidVideoDimensionsError,
    InvalidVideoDurationError,
    MissingVideoStreamError,
    VideoAudioExtractionError,
    VideoToolUnavailableError,
    VideoTranscriptionError,
)
from app.services.video_transcription import (
    _MODEL_CACHE,
    _extract_audio,
    _load_whisper_model,
    _transcribe_audio,
    _transcribe_video_content,
    _validate_probe_data,
    map_whisper_result,
)


class VideoTranscriptionMappingTests(unittest.TestCase):
    def test_maps_whisper_segments_to_response_shape(self) -> None:
        result = {
            "language": "en",
            "segments": [
                {"id": 0, "start": 0, "end": 1.2345, "text": " Hello "},
                {"start": 1.5, "end": 2.75, "text": "world"},
            ],
        }

        transcription = map_whisper_result(result, 3.456)

        self.assertEqual(transcription.language, "en")
        self.assertEqual(transcription.duration, 3.456)
        self.assertEqual(len(transcription.segments), 2)
        self.assertEqual(transcription.segments[0].id, 0)
        self.assertEqual(transcription.segments[0].start, 0.0)
        self.assertEqual(transcription.segments[0].end, 1.234)
        self.assertEqual(transcription.segments[0].text, "Hello")
        self.assertEqual(transcription.segments[1].id, 1)

    def test_maps_missing_language_to_unknown(self) -> None:
        transcription = map_whisper_result({"segments": []}, 2)

        self.assertEqual(transcription.language, "unknown")
        self.assertEqual(transcription.duration, 2)
        self.assertEqual(transcription.segments, [])

    def test_sanitizes_segment_ranges_to_ordered_duration_bounds(self) -> None:
        result = {
            "language": "en",
            "segments": [
                {"id": 3, "start": -1, "end": -0.5, "text": "before"},
                {"id": 4, "start": 8, "end": 3, "text": "after"},
            ],
        }

        transcription = map_whisper_result(result, 5)

        self.assertEqual(transcription.duration, 5)
        self.assertEqual(transcription.segments[0].start, 0)
        self.assertEqual(transcription.segments[0].end, 0)
        self.assertEqual(transcription.segments[1].start, 5)
        self.assertEqual(transcription.segments[1].end, 5)

    def test_rejects_invalid_segment_times(self) -> None:
        with self.assertRaises(VideoTranscriptionError):
            map_whisper_result(
                {"language": "en", "segments": [{"start": "bad", "end": 1}]},
                2,
            )


class VideoTranscriptionModelTests(unittest.TestCase):
    def tearDown(self) -> None:
        _MODEL_CACHE.clear()

    def test_load_whisper_model_uses_configured_model_name_and_caches(self) -> None:
        model = object()
        whisper = SimpleNamespace(load_model=Mock(return_value=model))

        with patch("importlib.import_module", return_value=whisper) as import_module:
            first = _load_whisper_model("tiny")
            second = _load_whisper_model("tiny")

        self.assertIs(first, model)
        self.assertIs(second, model)
        import_module.assert_called_once_with("whisper")
        whisper.load_model.assert_called_once_with("tiny")

    def test_failed_whisper_model_load_is_controlled_and_not_cached(self) -> None:
        whisper = SimpleNamespace(load_model=Mock(side_effect=RuntimeError("missing")))

        with patch("importlib.import_module", return_value=whisper):
            with self.assertRaises(VideoToolUnavailableError):
                _load_whisper_model("base")

        self.assertNotIn("base", _MODEL_CACHE)

    def test_transcribe_audio_maps_whisper_failure_to_domain_error(self) -> None:
        model = SimpleNamespace(transcribe=Mock(side_effect=RuntimeError("failed")))

        with patch(
            "app.services.video_transcription._load_whisper_model",
            return_value=model,
        ):
            with self.assertRaises(VideoTranscriptionError):
                _transcribe_audio(Path("audio.wav"), 10)


class VideoAudioExtractionTests(unittest.TestCase):
    def test_extract_audio_uses_predictable_mono_pcm_wav_command(self) -> None:
        with TemporaryDirectory() as temp_dir:
            audio_path = Path(temp_dir) / "audio.wav"

            def fake_run(command: list[str], **kwargs: object) -> object:
                audio_path.write_bytes(b"audio")
                self.assertIn("-ac", command)
                self.assertIn("1", command)
                self.assertIn("-ar", command)
                self.assertIn("16000", command)
                self.assertIn("-c:a", command)
                self.assertIn("pcm_s16le", command)
                self.assertIn("-f", command)
                self.assertIn("wav", command)
                self.assertFalse(kwargs["shell"])
                self.assertIsNotNone(kwargs["timeout"])
                return SimpleNamespace(returncode=0)

            with patch("subprocess.run", side_effect=fake_run):
                _extract_audio(Path(temp_dir) / "input", audio_path)

    def test_extract_audio_maps_failure_to_domain_error(self) -> None:
        with TemporaryDirectory() as temp_dir:
            with patch("subprocess.run", return_value=SimpleNamespace(returncode=1)):
                with self.assertRaises(VideoAudioExtractionError):
                    _extract_audio(
                        Path(temp_dir) / "input",
                        Path(temp_dir) / "audio.wav",
                    )


class VideoTranscriptionLifecycleTests(unittest.TestCase):
    def test_transcribe_video_content_cleans_temp_files_after_success(self) -> None:
        captured_paths: list[Path] = []

        def fake_extract_audio(input_path: Path, audio_path: Path) -> None:
            captured_paths.extend([input_path, audio_path])
            audio_path.write_bytes(b"audio")

        with (
            patch(
                "app.services.video_transcription.probe_video_file",
                return_value={
                    "format": {"duration": "5"},
                    "streams": [
                        {"codec_type": "video", "width": 1920, "height": 1080},
                    ],
                },
            ),
            patch(
                "app.services.video_transcription._extract_audio",
                side_effect=fake_extract_audio,
            ),
            patch(
                "app.services.video_transcription._transcribe_audio",
                return_value=map_whisper_result({"segments": []}, 5),
            ),
        ):
            transcription = _transcribe_video_content(b"video")

        self.assertEqual(transcription.segments, [])
        self.assertTrue(captured_paths)
        for path in captured_paths:
            self.assertFalse(path.exists())


class VideoTranscriptionValidationTests(unittest.TestCase):
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
