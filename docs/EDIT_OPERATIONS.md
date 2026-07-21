# Edit Operations

Edit operations define future editing intent without modifying source media. They are stored as structured records that can be reviewed, reordered, undone, redone, previewed, and eventually exported.

## Why Non-Destructive Editing

AI Video Director must keep source media immutable. Imported files remain the reference assets, while editing decisions live in project data. This makes AI suggestions safe to review because accepting a suggestion does not cut, rewrite, or overwrite video files.

## Operation Model

Every operation follows the same shape:

```ts
interface EditOperationBase<TType, TParameters> {
  id: string
  type: TType
  targetId: string
  parameters: TParameters
  createdAt: string
}
```

`targetId` points to the clip, track, timeline item, or asset the operation would affect. `parameters` contains operation-specific data.

## Planned Operation Types

| Operation | Purpose |
| --- | --- |
| `TrimOperation` | Adjust source or timeline boundaries for a clip. |
| `SplitOperation` | Split a clip at a timestamp. |
| `DeleteOperation` | Remove a clip or range from the edit plan. |
| `SpeedOperation` | Change playback speed while preserving source media. |
| `TextOverlayOperation` | Add timed text over the video. |
| `TransitionOperation` | Add transitions between clips or ranges. |
| `AudioOperation` | Adjust volume, mute state, or fades. |

## Why Operations Are Stored Separately

Operations are separate from clips and tracks so the app can preserve original assets and compute an edit plan from ordered intent. This also allows the same project state to support undo/redo, preview rendering, and export without mutating source media.

## Future Undo/Redo

Undo and redo will operate on operation history, not media files. A future edit engine can maintain:

- Applied operation stack.
- Undo stack.
- Redo stack.
- History entries for user-visible review.

Undo should remove or reverse the last operation from the edit plan. Redo should reapply an operation from the redo stack.

## Current Status

The operation interfaces exist in `frontend/src/models/EditOperation.ts`. No operation is currently applied to media or timeline rendering.
