# Project Structure

This repository is organized around a React frontend, FastAPI backend, project documentation, and local media-oriented workspaces.

## Top-Level Folders

### `.ai/`

Persistent engineering rules for Codex sessions. Read this before implementation work. It covers architecture, coding standards, performance, security, testing, roadmap, review, and sprint reporting.

Add new rules here only when they are durable and broadly useful across future sprints.

### `backend/`

FastAPI backend for local media processing.

Current responsibilities:

- API routes in `backend/app/api/`.
- Typed schemas in `backend/app/schemas/`.
- Media services in `backend/app/services/`.
- Configuration in `backend/app/config.py`.
- Backend tests in `backend/tests/`.

Add new backend endpoints as thin routes in `backend/app/api/`, with domain logic in a dedicated service under `backend/app/services/` and typed response models under `backend/app/schemas/`.

### `frontend/`

React, TypeScript, and Vite frontend.

Current responsibilities:

- Components in `frontend/src/components/`.
- Stateful workflows in `frontend/src/hooks/`.
- API clients in `frontend/src/services/`.
- Shared types in `frontend/src/types.ts`.
- Formatting and project-state utilities in `frontend/src/utils/`.

Add rendering behavior in components, workflow orchestration in hooks, API calls in services, and shared data shapes in `types.ts`.

### `docs/`

Human-readable project documentation for contributors, reviewers, and the project owner.

Use this folder for product vision, architecture, pipeline, release history, decisions, workflow, glossary, and technical debt.

### `projects/`

Reserved for local project data. Do not commit private project files unless a sprint explicitly defines safe fixtures.

### `media/`

Reserved for local media inputs. Do not commit uploaded videos, audio, images, or generated private media.

### `exports/`

Reserved for rendered outputs. Do not commit generated exports unless a sprint explicitly asks for small test artifacts.

### `templates/`

Reserved for reusable editing or project templates.

### `styles/`

Reserved for shared style artifacts outside the current frontend app. Most active UI styling currently lives in `frontend/src/App.css` and `frontend/src/index.css`.

## Where to Add New Work

- New media API endpoint: `backend/app/api/`, `backend/app/services/`, `backend/app/schemas/`, and backend tests.
- New frontend workflow: `frontend/src/hooks/` plus `frontend/src/services/` and `frontend/src/types.ts`.
- New UI surface: `frontend/src/components/`.
- New reusable frontend utility: `frontend/src/utils/`.
- New durable process or product documentation: `docs/` or `.ai/` depending on whether it is human-facing documentation or Codex operating rules.

## Files to Avoid Committing

- Secrets and environment files.
- Generated media and exports.
- Local project media.
- Dependency directories.
- Temporary files.
- Unrelated local changes.
