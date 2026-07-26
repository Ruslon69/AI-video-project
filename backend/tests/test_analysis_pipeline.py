import unittest
from pathlib import Path
from unittest.mock import patch

from app.analysis.models import (
    AnalysisAudioExtraction,
    AnalysisAudioStream,
    AnalysisMediaMetadata,
    AnalysisScene,
    AnalysisSilence,
    AnalysisTranscript,
    AnalysisTranscriptSegment,
)
from app.analysis.pipeline import analyze_video_content
from app.analysis.stages import (
    collect_media_metadata,
    parse_silence_ranges,
)


class AnalysisMetadataTests(unittest.TestCase):
    def test_collects_video_and_audio_stream_metadata(self) -> None:
        metadata = collect_media_metadata(
            {
                "format": {
                    "duration": "12.5",
                    "bit_rate": "1000000",
                },
                "streams": [
                    {
                        "index": 0,
                        "codec_type": "video",
                        "codec_name": "h264",
                        "width": 1920,
                        "height": 1080,
                        "avg_frame_rate": "30000/1001",
                    },
                    {
                        "index": 1,
                        "codec_type": "audio",
                        "codec_name": "aac",
                        "channels": 2,
                        "sample_rate": "48000",
                        "channel_layout": "stereo",
                        "tags": {"language": "eng"},
                    },
                ],
            },
            "source.mp4",
            4096,
        )

        self.assertEqual(metadata.duration, 12.5)
        self.assertEqual(metadata.width, 1920)
        self.assertEqual(metadata.fps, 29.97)
        self.assertEqual(len(metadata.audio_streams), 1)
        self.assertEqual(metadata.audio_streams[0].codec, "aac")
        self.assertEqual(metadata.audio_streams[0].sample_rate, 48000)


class SilenceAnalysisTests(unittest.TestCase):
    def test_parses_and_clamps_silence_ranges(self) -> None:
        output = (
            "[silencedetect] silence_start: -0.1\n"
            "[silencedetect] silence_end: 1.25 | silence_duration: 1.35\n"
            "[silencedetect] silence_start: 8.5\n"
            "[silencedetect] silence_end: 11 | silence_duration: 2.5\n"
        )

        silences = parse_silence_ranges(output, 10)

        self.assertEqual(
            [silence.model_dump() for silence in silences],
            [
                {
                    "id": "silence-1",
                    "start": 0,
                    "end": 1.25,
                    "duration": 1.25,
                },
                {
                    "id": "silence-2",
                    "start": 8.5,
                    "end": 10,
                    "duration": 1.5,
                },
            ],
        )

    def test_uses_media_end_for_unclosed_final_silence(self) -> None:
        silences = parse_silence_ranges("silence_start: 4.5", 6)

        self.assertEqual(len(silences), 1)
        self.assertEqual(silences[0].end, 6)
        self.assertEqual(silences[0].duration, 1.5)


class ProjectAnalysisPipelineTests(unittest.TestCase):
    def test_combines_stages_and_cleans_temporary_media(self) -> None:
        captured_paths: list[Path] = []
        metadata = AnalysisMediaMetadata(
            filename="source.mp4",
            duration=8,
            width=1280,
            height=720,
            fps=25,
            codec="h264",
            bitrate=500000,
            file_size=5,
            audio_streams=[
                AnalysisAudioStream(
                    index=1,
                    codec="aac",
                    channels=2,
                    sample_rate=48000,
                    channel_layout="stereo",
                    language=None,
                ),
            ],
        )

        def fake_extract(input_path: Path, audio_path: Path):
            captured_paths.extend([input_path, audio_path])
            audio_path.write_bytes(b"audio")
            return AnalysisAudioExtraction(
                status="extracted",
                format="wav",
                sample_rate=16000,
                channels=1,
            )

        with (
            patch(
                "app.analysis.pipeline.probe_video_file",
                return_value={"format": {}, "streams": []},
            ),
            patch(
                "app.analysis.pipeline.collect_media_metadata",
                return_value=metadata,
            ),
            patch(
                "app.analysis.pipeline.extract_analysis_audio",
                side_effect=fake_extract,
            ),
            patch(
                "app.analysis.pipeline.transcribe_analysis_audio",
                return_value=AnalysisTranscript(
                    language="en",
                    segments=[
                        AnalysisTranscriptSegment(
                            id=0,
                            start=0,
                            end=1,
                            text="Hello",
                            confidence=0.9,
                        ),
                    ],
                ),
            ),
            patch(
                "app.analysis.pipeline.detect_analysis_scenes",
                return_value=[
                    AnalysisScene(
                        id="scene-1",
                        start=0,
                        end=8,
                        confidence=1,
                    ),
                ],
            ),
            patch(
                "app.analysis.pipeline.detect_analysis_silences",
                return_value=[
                    AnalysisSilence(
                        id="silence-1",
                        start=2,
                        end=3,
                        duration=1,
                    ),
                ],
            ),
        ):
            analysis = analyze_video_content(
                b"video",
                "source.mp4",
                "asset-primary",
            )

        self.assertEqual(analysis.source_asset_id, "asset-primary")
        self.assertEqual(analysis.schema_version, "1.0")
        self.assertEqual(analysis.transcript.segments[0].confidence, 0.9)
        self.assertEqual(len(analysis.scenes), 1)
        self.assertEqual(len(analysis.silences), 1)
        self.assertTrue(captured_paths)
        for path in captured_paths:
            self.assertFalse(path.exists())

    def test_video_without_audio_completes_with_empty_audio_analysis(self) -> None:
        metadata = AnalysisMediaMetadata(
            filename="silent.mp4",
            duration=4,
            width=640,
            height=360,
            fps=24,
            codec="h264",
            bitrate=None,
            file_size=5,
            audio_streams=[],
        )

        with (
            patch(
                "app.analysis.pipeline.probe_video_file",
                return_value={"format": {}, "streams": []},
            ),
            patch(
                "app.analysis.pipeline.collect_media_metadata",
                return_value=metadata,
            ),
            patch(
                "app.analysis.pipeline.detect_analysis_scenes",
                return_value=[],
            ),
        ):
            analysis = analyze_video_content(
                b"video",
                "silent.mp4",
                "asset-primary",
            )

        self.assertEqual(analysis.audio_extraction.status, "not_available")
        self.assertEqual(analysis.transcript.segments, [])
        self.assertEqual(analysis.silences, [])


if __name__ == "__main__":
    unittest.main()
