# Architecture

AI Video Director is a local-first editor foundation with a React/TypeScript frontend and a FastAPI/Python backend. Current processing is request-based and uses FFmpeg/ffprobe for local media inspection.

## Current Architecture

```text
User
  |
  v
React UI components
  |
  v
React hooks and frontend API services
  |
  v
FastAPI routes
  |
  v
Backend media services
  |
  v
Temporary files + ffprobe/FFmpeg subprocesses
```

## Frontend Responsibilities

- Render the editor shell, media library, workspace, review panel, assistant panel, and help UI.
- Store local media item state in hooks.
- Coordinate metadata, preview, and scene requests.
- Use `AbortController` for cancellable requests.
- Prevent duplicate queued or active media-processing requests.
- Ignore stale responses after removal, cancellation, or unmount.
- Revoke object URLs when items are removed or the library is disposed.

## Backend Responsibilities

- Expose local HTTP endpoints for media-processing requests.
- Validate uploaded media before processing.
- Run ffprobe and FFmpeg with bounded subprocess calls.
- Return typed response models.
- Convert domain-specific processing errors into sanitized API errors.
- Clean temporary files and close uploads after each request.

## API Layer

Current video endpoints live under `/video`:

- `POST /video/metadata`
- `POST /video/previews`
- `POST /video/scenes`

Routes should stay thin. They receive uploads, call a service, and map known service errors into controlled HTTP responses.

## Services

Backend services own domain and infrastructure logic:

- Upload validation and limited reads.
- ffprobe metadata extraction.
- FFmpeg preview frame generation.
- FFmpeg scene detection.
- Timestamp calculation and parsing.
- Temporary directory cleanup.

## Media Processing

Current media processing is local and request-scoped. Uploaded content is read within configured limits, written to server-generated temporary paths, validated, processed, returned to the frontend, and cleaned up.

## FFmpeg Integration

ffprobe validates actual video streams, duration, dimensions, codec, FPS, bitrate, and file size where needed. FFmpeg generates preview frames and detects scene changes. Subprocess calls use argument arrays, `shell=False`, configured timeouts, and sanitized failure handling.

## Current Data Flow

```text
Import local file
  |
  v
Create MediaItem + object URL
  |
  v
Request metadata
  |
  v
Queue preview generation
  |
  v
Queue scene detection after previews
  |
  v
Render metadata, preview filmstrip, scene count, and scene timestamps
```

## Planned Architecture

```text
Current media foundations
  |
  v
Whisper transcription
  |
  v
Scene + speech analysis
  |
  v
Timeline segment generation
  |
  v
AI editing decisions
  |
  v
Effects planning
  |
  v
Export pipeline
```

## Future Whisper Integration

Whisper should be added as a separate pipeline stage with explicit input, output, cancellation behavior, progress state, and failure state. It should not be embedded directly in UI components.

## Future AI Analysis

AI analysis should combine scene data, transcript data, media metadata, and project output settings into reviewable analysis outputs. The user should be able to inspect and reject AI outputs.

## Timeline Generation

Timeline generation should convert scene-change timestamps, transcript ranges, and future AI analysis into explicit timeline segments. Scene timestamps are not yet full segments.

## Export Pipeline

Export should be introduced as its own backend service boundary. It should use explicit timeline input and return controlled errors without exposing commands, paths, or raw subprocess output.

## Architectural Principles

- Separation of concerns between UI, hooks, services, routes, schemas, and backend media services.
- Thin routes with domain logic in services.
- Typed APIs at backend and frontend boundaries.
- Local-first processing unless a sprint explicitly changes direction.
- Explicit cleanup for object URLs, uploads, temporary files, and request controllers.
- Bounded concurrency for expensive media operations.
- Observable processing with visible loading, ready, empty, and error states.
