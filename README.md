# AI Video Director

AI Video Director is a local-first short-form video editor foundation built with React, TypeScript, FastAPI, Python, and FFmpeg.

The project is currently focused on building observable media-processing pipeline stages before adding AI editing decisions.

## Current Status

Completed:

- Video metadata extraction
- Preview frame generation
- Scene detection foundation

Next planned pipeline stages:

- Whisper transcription foundation
- Scene and speech analysis
- Timeline generation
- AI editing decisions
- Export

## Documentation

- [Product Vision](docs/VISION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Processing Pipeline](docs/PIPELINE.md)
- [Project Structure](docs/PROJECT_STRUCTURE.md)
- [Changelog](docs/CHANGELOG.md)
- [Releases](docs/RELEASES.md)
- [Architecture Decisions](docs/DECISIONS.md)
- [Development Workflow](docs/DEVELOPMENT_WORKFLOW.md)
- [Technical Debt](docs/TECHNICAL_DEBT.md)
- [Glossary](docs/GLOSSARY.md)
- [Contributing](CONTRIBUTING.md)
- [.ai engineering rules](.ai/README.md)

## Development

The frontend lives in `frontend/` and the backend lives in `backend/`. Follow [.ai/SESSION_START.md](.ai/SESSION_START.md) before starting implementation work.
