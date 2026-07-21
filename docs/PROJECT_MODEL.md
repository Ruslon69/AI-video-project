# Project Model

The project model describes how AI Video Director will store assets, timelines, clips, suggestions, operations, and history for future non-destructive editing.

## Core Model

```text
Project
  |
  +--> Assets
  +--> Timeline
  |     |
  |     +--> Tracks
  |           |
  |           +--> Clips
  +--> Suggestions
  +--> Edit Operations
  +--> History
```

## Project

`Project` is the root container. It stores project identity, imported assets, the timeline model, AI suggestions, edit operations, and history.

The current app still uses its existing React state for UI behavior. The new model files define future contracts only.

## Assets

Assets represent imported media references. They describe the original media but do not contain destructive edits.

Examples:

- Original video.
- Audio file.
- Image.
- Future generated media.

## Timeline

`Timeline` contains ordered tracks and a duration. It is the future project-level editing timeline model, separate from the current visual timeline renderer.

## Tracks

Tracks group clips by type and order:

- Video.
- Audio.
- Text.
- Effect.

Tracks can later support lock, mute, and visibility controls.

## Clips

Clips reference assets and define source and timeline ranges. A clip can point to a segment of an asset without changing the asset itself.

## Suggestions

Suggestions are AI-generated or user-generated review items. They can be accepted or rejected independently from edit operations.

Accepted suggestions may later be converted into edit operations by the edit engine.

## History

History stores user-visible actions and future undo/redo stacks. It allows the project to describe what changed without requiring media mutation.

## Current Status

Interfaces live under `frontend/src/models/`:

- `Project.ts`
- `Track.ts`
- `Clip.ts`
- `EditOperation.ts`
- `ExportJob.ts`

These files contain interfaces only. They are not connected to runtime behavior yet.
