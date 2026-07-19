# Master Prompt

You are working on AI Video Director, an AI Short-Form Video Editor.

The stack is React, TypeScript, FastAPI, Python, FFmpeg, and Whisper. The product is local-first: local media files, local processing, and local development workflows are preferred unless a sprint explicitly introduces a remote service.

## Permanent Rules

- Follow clean architecture. Separate UI, business logic, services, API routes, infrastructure, and configuration.
- Keep frontend and backend boundaries clear. React components render state and handle interaction; hooks coordinate stateful workflows; services call APIs; FastAPI routes map HTTP to services; Python services contain domain logic.
- Use strong typing in TypeScript and Python schemas. Avoid untyped payloads at API boundaries.
- Build reusable modules when they remove real duplication or clarify ownership. Avoid premature abstractions.
- Centralize configuration and keep it ready for environment variables.
- Never create git commits unless the user explicitly asks for a commit.
- Do not modify unrelated application behavior while completing a sprint.

## Performance Rules

- Never block the React UI thread with expensive processing.
- Limit expensive concurrent work. Video preview generation currently allows a maximum of 2 concurrent frontend preview requests.
- Use `AbortController` for cancellable frontend requests.
- Protect against stale responses after item removal, replacement, unmount, or cancellation.
- Clean up media object URLs when items are removed and when hooks/components are disposed.
- Do not duplicate large Base64 preview payloads in multiple state locations.
- Keep active video playback responsive while background media processing runs.

## Security Rules

- Never trust filenames, MIME types, or extensions alone.
- Validate actual media streams with ffprobe where media correctness matters.
- Enforce configurable upload limits. Local development uses a 2 GB upload limit by default.
- Execute FFmpeg and ffprobe with subprocess argument arrays and `shell=False`.
- Use subprocess timeouts for ffprobe and FFmpeg.
- Keep CORS restricted to known local frontend origins. Do not use wildcard origins.
- Return controlled API errors. Do not expose internal paths, raw commands, subprocess output, stack traces, or sensitive backend details.
- Generate server-side temporary filenames.
- Clean temporary files and directories in `finally` blocks or equivalent guaranteed cleanup.

## Maintainability Rules

- Keep functions small and named after their responsibility.
- Keep components focused. Extract hooks, services, or child components when a component starts mixing unrelated concerns.
- Avoid duplicated business logic across UI components, hooks, and backend services.
- Prefer explicit data shapes over implicit conventions.
- Add comments only where they explain non-obvious reasoning.

## Testing Rules

- Add backend tests for domain logic, validation, error mapping, and media-processing edge cases.
- Add frontend tests when a frontend test framework exists or a sprint introduces one.
- Do not introduce a large test stack unless the sprint asks for it or the risk justifies it.
- Run the verification commands in `TESTING.md` before reporting completion.
- Report failed or skipped checks clearly, including why they failed.

## Required Final Sprint Report

Every implementation sprint report must include:

- Created files
- Changed files
- Architecture decisions
- Performance considerations
- Security considerations
- Tests and verification
- Limitations
- Technical debt
- Recommended next steps
