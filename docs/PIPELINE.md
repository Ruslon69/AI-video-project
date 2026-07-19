# Processing Pipeline

The pipeline is intentionally staged so each output can be inspected, reviewed, and later reused by downstream steps.

```text
Import
  |
  v
Metadata
  |
  v
Preview
  |
  v
Scene Detection
  |
  v
Whisper
  |
  v
Scene + Speech Analysis
  |
  v
Timeline Generation
  |
  v
AI Editing
  |
  v
Effects
  |
  v
Export
```

## Current Stages

### Import

Purpose: Add local media files to the project workspace.
Input: Browser `File` objects selected or dropped by the user.
Output: `MediaItem` records, object URLs, and initial processing state.
Dependencies: Browser file APIs and React state.
Failure cases: Unsupported media type or duplicate file identity.
Future improvements: Persisted project media references and safer large-library handling.

### Metadata

Purpose: Validate video files and extract technical properties.
Input: Uploaded video file.
Output: Duration, dimensions, FPS, codec, bitrate, filename, and file size.
Dependencies: Backend upload validation and ffprobe.
Failure cases: Empty upload, unsupported content type, missing video stream, invalid duration, invalid dimensions, ffprobe failure, timeout, upload too large.
Future improvements: Shared validation contract across media services and integration fixtures.

### Preview

Purpose: Generate visual frames for browsing and seeking.
Input: Uploaded video file with valid video stream.
Output: Poster frame and preview frame list with timestamps and Base64 JPEG data URLs.
Dependencies: ffprobe validation, FFmpeg frame extraction, frontend preview queue.
Failure cases: FFmpeg unavailable, FFmpeg failure, timeout, invalid video, upload too large, request abort.
Future improvements: Cached preview files or object URLs instead of Base64 transport.

### Scene Detection

Purpose: Detect scene-change timestamps for later timeline generation.
Input: Uploaded video file with valid video stream.
Output: Scene count and scene-change timestamps.
Dependencies: ffprobe validation, FFmpeg scene filter, one-job frontend/backend concurrency guard.
Failure cases: FFmpeg unavailable, FFmpeg failure, timeout, invalid video, upload too large, request abort.
Future improvements: Cached scene outputs, progress reporting, configurable threshold UX, and segment generation.

### Whisper

Purpose: Transcribe speech from video or audio sources.
Input: Source media audio.
Output: Transcript text with timestamps.
Dependencies: FFmpeg audio extraction and local open-source Whisper.
Failure cases: Missing audio, unsupported audio stream, FFmpeg timeout, model unavailable, low-quality audio, transcription failure.
Operational note: The configured Whisper model runs locally and may need to be downloaded by Whisper on first real use if it is not already available in the local model cache.
Future improvements: Speaker labels, subtitle-ready output, transcription caching, progress reporting, and persistent transcription jobs.

## Future Stages

### Scene + Speech Analysis

Purpose: Combine visual scene boundaries with transcript meaning.
Input: Metadata, scene timestamps, transcript ranges, and project output settings.
Output: Structured analysis for candidate moments, pacing, and content relevance.
Dependencies: Scene detection, transcription, and future analysis services.
Failure cases: Missing upstream outputs, incomplete transcript, conflicting timestamps, analysis timeout.
Future improvements: Reference-video learning and explainable scoring.

### Timeline Generation

Purpose: Convert analysis into timeline segments.
Input: Scene timestamps, transcript ranges, media metadata, and target output settings.
Output: Ordered segment plan with source ranges and intended output ranges.
Dependencies: Scene + speech analysis.
Failure cases: No suitable segments, invalid ranges, target duration conflicts.
Future improvements: Versioned timeline proposals and rollback.

### AI Editing

Purpose: Propose edit decisions while keeping the user in control.
Input: Timeline segments, project goals, reference signals, and output settings.
Output: Reviewable edit plan.
Dependencies: Timeline generation and future AI decision service.
Failure cases: Missing timeline, unclear project goals, low-confidence recommendations.
Future improvements: Decision explanations and multiple edit alternatives.

### Effects

Purpose: Add planned visual and audio treatment.
Input: Approved edit plan and timeline.
Output: Effects plan for zooms, overlays, subtitles, flying text, music, and sound effects.
Dependencies: AI editing decisions and user approvals.
Failure cases: Missing assets, conflicting effects, unreadable text placement, unavailable audio.
Future improvements: Style presets and reference-video effect matching.

### Export

Purpose: Render the approved timeline into a deliverable output.
Input: Approved timeline, effects plan, media assets, and output settings.
Output: Exported video file or compatible project artifact.
Dependencies: FFmpeg or future export service.
Failure cases: Missing source media, invalid timeline, FFmpeg failure, timeout, disk limits.
Future improvements: CapCut or Final Cut compatibility paths and resumable export jobs.
