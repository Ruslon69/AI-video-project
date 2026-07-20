# AI Video Director

AI Video Director is a local-first video editing foundation for reviewing media analysis and AI-assisted edit suggestions before any destructive work happens.

The current implementation focuses on observable editor workflows: local media import, video analysis, timeline visualization, transcript and scene tracks, version review, and a non-destructive AI suggestion review panel.

## Goals

- Keep source media untouched until an explicit export/edit engine is introduced.
- Make every automated decision inspectable and reversible.
- Build timeline, review, and media-processing foundations before adding production AI editing.
- Keep frontend state typed and separated by domain: media, project workflow, timeline rendering, and AI suggestions.
- Keep backend media processing local, bounded, and predictable.

## Current Features

- Three-column editor layout with project navigation, video workspace, and review panel.
- Local media library for video, image, and audio entries.
- Video preview player with filmstrip seeking.
- Metadata extraction through the backend.
- Preview frame generation.
- Scene detection track.
- Transcript processing and transcript timeline track.
- Timeline ruler, zoom controls, playhead, scene track, transcript track, and AI Suggestions track.
- AI Suggestions review workflow with filters, counts, multi-selection, active item seeking, batch accept/reject, status colors, and estimated removed time.
- Version review controls for substages.
- Theme switching and in-app help/assistant panels.

## Technology Stack

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Styling | CSS modules-by-convention in `App.css` and global tokens in `index.css` |
| Linting | Oxlint |
| Backend | FastAPI, Python |
| Media processing | FFmpeg and ffprobe |
| State | React hooks and typed domain models |

## Project Architecture

```text
User
  |
  v
React editor shell
  |
  +--> Project and version state
  +--> Media library state
  +--> AI suggestion review state
  +--> Timeline rendering
  |
  v
Frontend API service
  |
  v
FastAPI video routes
  |
  v
Backend media services
  |
  v
Temporary files + FFmpeg/ffprobe
```

The timeline is a rendering surface. It receives domain data and maps it to positioned timeline blocks. AI suggestion state is stored separately from scenes, transcript data, and timeline tracks.

## Folder Structure

```text
.
├── backend/              # FastAPI app, media-processing services, backend tests
├── docs/                 # Product, architecture, timeline, AI engine, and process docs
├── exports/              # Reserved for generated exports
├── frontend/             # React/Vite application
│   ├── src/components/   # UI components grouped by feature area
│   ├── src/data/         # Static project and mock AI suggestion data
│   ├── src/hooks/        # Reusable React state hooks
│   ├── src/services/     # Frontend API client
│   ├── src/utils/        # Shared formatting, project, media, and AI helpers
│   └── src/types.ts      # Shared frontend domain types
├── media/                # Reserved local media workspace
├── projects/             # Reserved project persistence workspace
├── styles/               # Reserved shared style assets
└── templates/            # Reserved templates
```

## Local Setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173` by default.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs on `http://127.0.0.1:8000` by default.

FFmpeg and ffprobe must be installed and available on `PATH` for media analysis endpoints.

## Development Commands

Run from `frontend/`:

```bash
npm run lint
npm run build
npm run dev
npm run preview
```

Run backend tests from `backend/`:

```bash
pytest
```

## Current Roadmap

- Maintain non-destructive AI suggestion review.
- Expand timeline review interactions without modifying source media.
- Introduce a real AI suggestion generation pipeline behind the existing `AISuggestion[]` contract.
- Add a future edit engine boundary that can consume accepted suggestions.
- Add explicit export planning and rendering only after accepted suggestions are represented as a safe edit plan.

## Upcoming Milestones

1. Persist project and suggestion review state.
2. Replace mock AI suggestions with generated suggestions from transcript, scene, and silence analysis.
3. Define a non-destructive edit decision model.
4. Implement `applyAcceptedSuggestions()` as an edit-plan generator, not direct media mutation.
5. Add export preview and controlled backend export processing.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Timeline](docs/TIMELINE.md)
- [AI Engine](docs/AI_ENGINE.md)
- [Processing Pipeline](docs/PIPELINE.md)
- [Development Workflow](docs/DEVELOPMENT_WORKFLOW.md)
- [Contributing](CONTRIBUTING.md)
