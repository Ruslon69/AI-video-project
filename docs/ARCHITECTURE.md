# Architecture

AI Video Director is a local-first editor foundation with a React/TypeScript frontend and a FastAPI/Python backend. Current media processing is request-based and uses FFmpeg/ffprobe for local media inspection.

## System Overview

```text
React editor shell
  |
  +--> Project workflow state
  +--> Media library state
  +--> AI suggestion state
  +--> Timeline rendering
  |
  v
Frontend API client
  |
  v
FastAPI routes
  |
  v
Backend media services
  |
  v
Temporary files + FFmpeg/ffprobe subprocesses
```

## Frontend Responsibilities

- Render the three-column editor layout.
- Manage project stages, substages, versions, and review comments.
- Manage local media library state and object URLs.
- Coordinate backend requests for metadata, previews, scenes, and transcription.
- Render the video player, filmstrip, timeline ruler, zoom controls, scene track, transcript track, and AI Suggestions track.
- Store AI suggestions separately from scenes, transcript data, and timeline tracks.
- Provide non-destructive AI suggestion review controls.

## Backend Responsibilities

- Expose local HTTP endpoints for media analysis.
- Validate uploaded media before processing.
- Run ffprobe and FFmpeg with bounded subprocess calls.
- Return typed response models.
- Convert known processing errors into controlled API errors.
- Clean temporary files and close uploads after each request.

## API Layer

Current video endpoints live under `/video`:

- `POST /video/metadata`
- `POST /video/previews`
- `POST /video/scenes`
- `POST /video/transcription`

Routes should stay thin. They receive uploads, call media services, and map known service errors into controlled HTTP responses.

## State Boundaries

### Project State

Project state owns stages, substages, version history, selected stage/substage, and review comments.

### Media State

Media state owns imported files, object URLs, upload/processing progress, metadata, preview frames, scene results, and transcription results.

### AI Suggestion State

AI suggestion state owns `AISuggestion[]`, selected suggestion ids, active suggestion id, and status changes. Accept and reject operations only update status.

### Timeline Rendering

Timeline rendering receives domain data and maps it into generic `TimelineTrack` and `TimelineItem` models. The timeline does not own suggestion generation, project decisions, or edit application.

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
Queue scene detection and transcription
  |
  v
Render player, filmstrip, analysis panels, and timeline tracks
  |
  v
Review AI suggestions without modifying source media
```

## Future Edit Engine Boundary

`applyAcceptedSuggestions()` is reserved for a future non-destructive edit engine. It should consume accepted suggestions and create an explicit edit plan. It should not mutate source media or timeline render state directly.

## Architectural Principles

- Keep source media immutable until an explicit export pipeline is introduced.
- Keep domain state separate from timeline rendering.
- Keep backend routes thin and service-owned.
- Use typed frontend and backend boundaries.
- Keep expensive media operations cancellable and bounded.
- Make automated decisions visible, selectable, and reversible.
