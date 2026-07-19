# Changelog

This changelog is based on the repository Git history and current project state. The project has not adopted semantic versioning yet.

## Unreleased

### Added

- Whisper transcription foundation.
- Scene and speech analysis.
- Timeline segment generation.
- AI editing decisions.
- Export pipeline.

### Technical Debt

- Evaluate shared job orchestration only after more pipeline stages exist.
- Evaluate cached media-processing outputs when repeated pipeline requests become a practical bottleneck.

## 2026-07-19

### Added

- Scene Detection Foundation: backend scene detection service, `POST /video/scenes`, typed scene response, frontend scene state, and UI display for scene count and timestamps.
- Preview Generation: backend preview generation with FFmpeg, frontend preview queue, poster frames, and filmstrip display.
- Engineering rules system under `.ai/`.
- Project Output Settings for target platform, duration, aspect ratio, resolution, and output codec/container assumptions.
- Media Library foundation with multi-item media state, active item selection, object URL cleanup, and media type handling.
- Video metadata pipeline with backend extraction and frontend display.
- Backend foundation with FastAPI app structure, health endpoint, CORS configuration, and video API route package.

### Improved

- Frontend/backend integration through typed API service calls.
- Media processing cancellation and stale-response protection with `AbortController`.
- Backend media validation through ffprobe before processing.

### Security

- Upload size checks, temporary server-generated files, subprocess argument arrays, subprocess timeouts, and sanitized API errors.

### Performance

- Preview generation is queued with a two-request frontend concurrency limit.
- Scene detection is queued with a one-request frontend limit and a one-job backend guard.

### Engineering

- Added backend tests for preview timestamp calculations, preview probe validation, scene timestamp parsing, and scene probe validation.
- Added standard backend/frontend verification commands in `.ai/TESTING.md`.

### Technical Debt

- Base64 preview transport remains acceptable for the local foundation but is memory-heavy.
- Preview and scene queue orchestration now have visible duplication.
- Backend preview and scene services duplicate probe validation logic.

## 2026-07-18

### Added

- Initial Product Foundation: React, TypeScript, Vite project structure and first application shell.
- UI foundation for the editor workspace, sidebar, review panel, assistant panel, contextual help, and theme support.
- Shared help panel and editing stage state.

### Changed

- The product direction moved from a generic Vite starter toward the AI Video Director editor workflow.

### Engineering

- Initial repository structure for frontend, backend placeholders, docs, media, projects, styles, templates, and exports.
