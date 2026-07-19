# Architecture Decision Log

This log records accepted decisions visible in the codebase, `.ai` rules, and Git history. Decisions can be revisited when the stated review conditions occur.

## ADR-001: Use React and TypeScript for the Frontend

Date: 2026-07-18
Status: Accepted
Context: The project needs an interactive editor UI with typed state and reusable components.
Decision: Build the frontend with React, TypeScript, and Vite.
Reasons: React fits component-based editor screens, TypeScript gives explicit UI and API types, and Vite keeps local development lightweight.
Consequences: Frontend behavior should stay in components, hooks, services, and shared types rather than ad hoc scripts.
Future review conditions: Revisit only if the editor requires capabilities that the current frontend stack cannot support well.

## ADR-002: Use FastAPI and Python for the Backend

Date: 2026-07-19
Status: Accepted
Context: Media processing requires local backend endpoints for upload validation, probing, and FFmpeg execution.
Decision: Use FastAPI and Python for backend API and services.
Reasons: FastAPI supports typed response models and clear route/service boundaries; Python works well for subprocess-based media tooling.
Consequences: Backend logic should live in services, with routes focused on HTTP mapping.
Future review conditions: Revisit if job infrastructure or processing scale requires a separate worker runtime.

## ADR-003: Prefer Local-First Processing

Date: 2026-07-19
Status: Accepted
Context: The product handles local media and should avoid remote processing unless a sprint explicitly introduces it.
Decision: Keep media processing local by default.
Reasons: Local processing improves privacy, keeps development simple, and matches the current project scope.
Consequences: FFmpeg, ffprobe, and future local models are preferred before remote services.
Future review conditions: Revisit for cloud collaboration, hosted rendering, or model capabilities that cannot run locally.

## ADR-004: Use FFmpeg and ffprobe for Video Processing

Date: 2026-07-19
Status: Accepted
Context: The project needs metadata extraction, previews, and scene detection from uploaded videos.
Decision: Use ffprobe for stream validation and FFmpeg for preview and scene operations.
Reasons: These tools are mature, local, and suitable for the current processing foundation.
Consequences: Subprocess calls must use argument arrays, `shell=False`, timeouts, and sanitized errors.
Future review conditions: Revisit if a native media library or worker service becomes more maintainable.

## ADR-005: Keep FastAPI Routes Thin

Date: 2026-07-19
Status: Accepted
Context: Video metadata, previews, and scenes involve validation, subprocess calls, and error handling.
Decision: Routes call dedicated services and map domain errors to controlled HTTP responses.
Reasons: This keeps API shape separate from media-processing logic.
Consequences: New backend capabilities should add schemas and services rather than expanding route bodies.
Future review conditions: Revisit if common route behavior justifies shared API helpers.

## ADR-006: Use Typed API Responses

Date: 2026-07-19
Status: Accepted
Context: The frontend consumes backend media metadata, preview, and scene payloads.
Decision: Define explicit Pydantic response models and matching TypeScript types.
Reasons: Typed payloads reduce boundary mistakes and make future pipeline state clearer.
Consequences: API shape changes should update both backend schemas and frontend types.
Future review conditions: Revisit if generated API clients are introduced.

## ADR-007: Orchestrate Frontend Requests in Hooks

Date: 2026-07-19
Status: Accepted
Context: Media workflows include upload, cancellation, queues, stale-response checks, and cleanup.
Decision: Keep request orchestration inside React hooks, currently `useMediaLibrary`.
Reasons: Hooks can coordinate stateful workflows while components remain focused on rendering.
Consequences: Components should not directly run media API workflows.
Future review conditions: Revisit when multiple hooks share enough workflow code to justify extraction.

## ADR-008: Limit Expensive Media Operations

Date: 2026-07-19
Status: Accepted
Context: Preview generation and scene detection can consume CPU, memory, and disk.
Decision: Limit preview requests to two active frontend jobs and scene detection to one active frontend/backend job.
Reasons: Bounded work keeps active playback and the UI responsive.
Consequences: Additional pipeline stages need explicit concurrency decisions.
Future review conditions: Revisit after progress reporting, persistent job state, or worker infrastructure exists.

## ADR-009: Use AbortController for Frontend Cancellation

Date: 2026-07-19
Status: Accepted
Context: Users can remove media, clear the library, or navigate while requests are in flight.
Decision: Use `AbortController` for cancellable frontend metadata, preview, and scene requests.
Reasons: Cancellation prevents stale UI updates and unnecessary client-side work.
Consequences: Hooks must abort active controllers and ignore stale responses.
Future review conditions: Revisit if a persistent job API replaces direct upload requests.

## ADR-010: Clean Temporary Files in Finally Blocks

Date: 2026-07-19
Status: Accepted
Context: Backend media services write uploaded content to server-generated temporary paths.
Decision: Clean temporary directories and close uploads in `finally` blocks.
Reasons: Media files can be large and should not remain beyond the request lifecycle.
Consequences: New media services must follow the same cleanup pattern.
Future review conditions: Revisit if cached artifacts or persistent job storage are introduced.

## ADR-011: Add Scene Detection Before Transcription and AI Editing

Date: 2026-07-19
Status: Accepted
Context: The AI pipeline needs structural video information before semantic analysis and edit decisions.
Decision: Implement scene detection as a foundation stage before transcription, combined analysis, timeline generation, and AI editing decisions.
Reasons: Scene boundaries are useful for later timeline segmentation and reviewable edit planning.
Consequences: Scene data is stored in frontend state but is not yet converted to timeline segments.
Future review conditions: Revisit ordering if transcription proves to be the better first analysis source.

## ADR-012: Postpone Premature Queue Abstraction

Date: 2026-07-19
Status: Accepted
Context: Preview and scene queues are similar but only two concrete media stages exist.
Decision: Keep queue logic local for now instead of introducing a shared bounded-job helper immediately.
Reasons: A shared abstraction is easier to design once transcription and analysis jobs reveal actual common needs.
Consequences: Some duplication remains in `useMediaLibrary`.
Future review conditions: Revisit when a third pipeline queue lands or queue behavior starts diverging.

## ADR-013: Postpone Shared Probe-Validation Extraction

Date: 2026-07-19
Status: Accepted
Context: Preview and scene services both validate duration and dimensions after probing.
Decision: Leave duplicated validation until more backend services use the same contract.
Reasons: Current duplication is small and explicit.
Consequences: Future changes to validation rules must update both services.
Future review conditions: Revisit when transcription, analysis, or export needs the same validation.

## ADR-014: Require Codex Self-Review Inside Each Sprint

Date: 2026-07-19
Status: Accepted
Context: Implementation is performed through sprint-based Codex sessions.
Decision: Require self-review against `.ai` rules before reporting completion.
Reasons: The workflow catches architecture, performance, security, and cleanup issues before owner review.
Consequences: Sprint reports must include verification results, risks, and debt.
Future review conditions: Revisit if CI enforces more of the same checklist automatically.

## ADR-015: Require Review Before Commit and Push

Date: 2026-07-19
Status: Accepted
Context: Commits and pushes should happen only after explicit owner approval.
Decision: Do not commit or push unless the Technical Lead explicitly requests it.
Reasons: This protects branch history and keeps review authority clear.
Consequences: Implementation completion, commit approval, and push approval are separate workflow steps.
Future review conditions: Revisit only if a formal pull-request workflow replaces direct branch pushes.
