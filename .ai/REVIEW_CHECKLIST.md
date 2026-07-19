# Review Checklist

Use this checklist before presenting a sprint as complete.

## Architecture

- [ ] Changes respect frontend/backend boundaries.
- [ ] API routes, services, hooks, and components keep separate responsibilities.
- [ ] Configuration is centralized.
- [ ] Business logic is not duplicated.

## Correctness

- [ ] Requirements are implemented.
- [ ] Edge cases are handled.
- [ ] Existing image and audio behavior remains unchanged unless the sprint says otherwise.

## Performance

- [ ] Expensive work does not block the React UI thread.
- [ ] Concurrency limits exist for expensive operations.
- [ ] Large data is not duplicated unnecessarily.
- [ ] Active playback remains responsive.

## Cancellation and Cleanup

- [ ] Requests are cancellable where needed.
- [ ] Stale responses cannot update removed or replaced items.
- [ ] State is not updated after unmount.
- [ ] Object URLs are revoked.
- [ ] Temporary backend files and directories are cleaned.

## Security

- [ ] Uploads are validated.
- [ ] Subprocess calls use argument arrays and `shell=False`.
- [ ] Timeouts are set for subprocesses.
- [ ] API errors are sanitized.
- [ ] CORS remains restricted.

## Typing and Code Quality

- [ ] Types and schemas are explicit.
- [ ] Functions and components are small enough to review.
- [ ] Names describe responsibilities.
- [ ] Comments explain only non-obvious reasoning.

## UX States

- [ ] Loading states are visible.
- [ ] Empty states are useful.
- [ ] Errors are understandable and non-blocking where appropriate.
- [ ] Controls are accessible.

## Tests and Verification

- [ ] Backend tests were added or updated when backend logic changed.
- [ ] Frontend tests were added when a framework exists and the change warrants it.
- [ ] Standard verification commands were run.
- [ ] Failures or skipped checks are reported.

## Documentation and Debt

- [ ] Durable architecture decisions are documented.
- [ ] Technical debt is called out.
- [ ] Recommended next steps are included.

## Git

- [ ] `git status --short` was reviewed.
- [ ] No commit was created unless explicitly requested.
