# Export Pipeline

The export pipeline is a future backend boundary that will render a project from assets plus a non-destructive edit plan. It is not implemented in the current app.

## Current Status

The app can review AI suggestions and update their status. It does not export accepted suggestions, apply operations, or rewrite media.

`frontend/src/models/ExportJob.ts` defines future export job contracts. `frontend/src/utils/aiEditEngine.ts` exposes placeholder methods that throw `Not implemented`.

## Future Pipeline

```text
Project
  |
  v
Accepted suggestions
  |
  v
Edit operations
  |
  v
Edit plan
  |
  v
Preview generation
  |
  v
Export job
  |
  v
Rendered artifact
```

## Why Export Is Separate

Export should be separate from UI review because rendering is expensive, asynchronous, and failure-prone. Keeping export as a dedicated pipeline allows progress reporting, cancellation, retry handling, and controlled backend errors.

## Non-Destructive Export

The export pipeline should read source assets and operation data, then write a new output artifact. It should never overwrite imported source files.

## Future Export Job Model

An export job should include:

- Job id.
- Project id.
- Edit plan.
- Export settings.
- Status.
- Progress.
- Output location.
- Error message.
- Creation and update timestamps.

## Planned Backend Responsibilities

- Validate project and edit-plan input.
- Resolve asset references safely.
- Convert operations into FFmpeg filter graph or equivalent render instructions.
- Run bounded export jobs.
- Report progress and errors.
- Write output artifacts to an export location.

## Planned Frontend Responsibilities

- Request previews and exports.
- Show export status and progress.
- Preserve review and edit-plan state.
- Display export errors without exposing unsafe system details.
