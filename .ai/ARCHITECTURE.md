# Architecture

AI Video Director is split into a React/TypeScript frontend and a FastAPI/Python backend.

## Current Boundaries

- Frontend UI lives in `frontend/src/components`.
- Frontend stateful workflows live in `frontend/src/hooks`.
- Frontend API calls live in `frontend/src/services`.
- Shared frontend types live in `frontend/src/types.ts`.
- Backend API routes live in `backend/app/api`.
- Backend schemas live in `backend/app/schemas`.
- Backend domain and infrastructure services live in `backend/app/services`.
- Backend configuration lives in `backend/app/config.py`.

## Responsibilities

- API routes should validate HTTP shape, call services, and map domain errors to controlled HTTP responses.
- Services should own media probing, preview generation, upload validation, timestamp calculation, subprocess execution, and other backend business logic.
- Schemas should define typed request and response shapes.
- Components should render UI and call callbacks. They should not contain backend business rules.
- Hooks should coordinate local state, queues, cancellation, cleanup, and API service calls.

## Configuration

Configuration should be centralized and ready for environment variables. Do not scatter limits or subprocess settings throughout the codebase.

Current durable limits include:

- Maximum upload size: 2 GB by default.
- Maximum generated preview frames: 8.
- Maximum preview width: 480 px.
- FFprobe and FFmpeg subprocess timeouts.

## Error Handling

Backend services should raise typed domain-specific exceptions for controlled failures. API routes should map those exceptions to sanitized HTTP responses. Unexpected errors should not expose internals to the client.

Frontend code should keep metadata failures separate from non-blocking preview failures. A preview failure should not invalidate an otherwise usable video item.

## Future AI Pipeline

Future AI capabilities should be added as separate pipeline stages, not embedded directly into UI components. Likely stages include transcription, media analysis, scene detection, editing decisions, timeline generation, and export preparation.

Each stage should have clear inputs, outputs, cancellation behavior, progress state, and failure state.

## Rules

- Do not create large components that mix rendering, state orchestration, API calls, and media logic.
- Do not duplicate business logic between components or between frontend and backend services.
- Prefer explicit modules with small responsibilities over broad utility files.
- Keep local-first assumptions visible until a sprint explicitly changes them.
