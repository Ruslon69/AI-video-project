# Coding Standards

## TypeScript

- Use explicit exported types for API responses and shared domain objects.
- Keep API client functions typed.
- Avoid `any`; use `unknown` and narrow when necessary.
- Keep derived data memoized only when it prevents meaningful work or stabilizes references.

## React

- Components should focus on rendering and interaction.
- Hooks should own stateful workflows such as media library state, queues, cancellation, and cleanup.
- Keep callbacks stable with `useCallback` when passed through multiple components or used in effects.
- Avoid storing the same large data in multiple states.
- Clean up object URLs, timers, subscriptions, and pending requests.
- Show loading, empty, and error states for asynchronous work.

## Python

- Use small functions with clear names.
- Keep subprocess execution isolated from API route code.
- Use typed Pydantic schemas for API responses.
- Use domain-specific exceptions for controlled failures.
- Keep configuration in `backend/app/config.py`.

## FastAPI

- Routes should be thin.
- Use `response_model` for typed responses.
- Convert domain exceptions to sanitized `HTTPException` responses at the API boundary.
- Do not expose stack traces, internal paths, command strings, or subprocess output.

## Naming and File Structure

- Name files by responsibility, not by generic category.
- Prefer `video_previews.py`, `video_probe.py`, and `video_upload.py` style modules over large mixed services.
- Keep frontend component names aligned with their UI responsibility.

## Comments

Use comments sparingly. Add them when they explain why a non-obvious decision exists, not what a straightforward line does.

## Imports

- Keep imports explicit.
- Avoid circular dependencies.
- Prefer local project modules over new dependencies when the standard library is enough.

## Abstractions

Avoid premature abstractions. Add shared helpers only when they remove real duplication, clarify ownership, or enforce a project rule.
