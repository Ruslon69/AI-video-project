# Releases and Project Evolution

The project does not yet use official release versions. This document describes major phases visible in the Git history and current codebase.

## Initial Product Foundation

Implemented:

- React and TypeScript frontend shell.
- Editor-oriented layout with sidebar, workspace, review area, assistant panel, contextual help, and theme support.
- Project stage and substage state for a review-oriented workflow.

Why it matters:

- Establishes the product shape as an editor, not a generic upload tool.

Unlocked:

- Media library and pipeline stages can be added without redesigning the entire UI.

Incomplete:

- The editing workflow is not yet connected to generated timelines or exports.

## Media Processing Foundation

Implemented:

- FastAPI backend foundation.
- Frontend/backend API integration.
- Video metadata extraction.
- Multi-item media library.
- Project output settings.
- FFmpeg preview generation.
- FFmpeg scene detection foundation.

Why it matters:

- The product can inspect local media and produce useful non-AI processing results.

Unlocked:

- Future AI stages can work from structured media metadata, previews, and scene-change timestamps.

Incomplete:

- Processing outputs are not cached, progress reporting is limited, and scene timestamps are not yet timeline segments.

## AI Pipeline Foundation

Implemented:

- Pipeline boundaries are defined in architecture docs and state shapes.
- Scene detection was added as a pre-AI stage before transcription, analysis, editing decisions, and export.

Why it matters:

- The project can grow stage by stage while keeping each operation reviewable and replaceable.

Unlocked:

- Whisper transcription and later scene/speech analysis can use existing local media-processing patterns.

Incomplete:

- No transcription, semantic scene understanding, AI editing decisions, timeline generation, or export pipeline exists yet.

## Engineering Process Foundation

Implemented:

- `.ai` engineering rules, sprint template, testing commands, performance rules, security rules, and review checklist.
- Review-before-commit and explicit-push workflow.

Why it matters:

- Keeps fast iteration tied to architecture, verification, and explicit owner approval.

Unlocked:

- Future contributors and Codex sessions have a consistent way to plan, implement, review, commit, and push changes.

Incomplete:

- CI and standardized FFmpeg video fixtures are not yet established.
