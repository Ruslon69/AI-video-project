# Editor Engine v1 Architecture

## Overview

Editor Engine v1 is a non-destructive editing foundation for AI Video Director. Source media is never modified. The project stores persistent timeline identity, source media references, edit operations, operation groups, undo/redo stacks, and a projection layer that derives the current editable timeline for UI playback and timeline rendering.

The current engine supports:

- Persistent timeline items
- Source clips
- Edit operations
- Operation groups
- Undo and redo
- Projection-driven trim, delete, and split
- Projection-aware playback normalization
- AI review decisions represented as operations

## High-Level Architecture

The editor is organized around four main layers:

1. **Project State**
   Stores durable project data, timeline items, source clips, operations, history, selections, reported playback position, explicit seek requests, zoom, and output settings.

2. **Operation Log**
   Stores non-destructive edit intent. Operations describe what should happen; they do not mutate source media.

3. **Projection Layer**
   Rebuilds the current computed timeline from project state. Projection is derived and stateless.

4. **UI Consumers**
   Timeline, preview, and review UI consume projected state and dispatch operations through project actions.

## Project Model

The project model is the source of truth. It contains:

- Project metadata
- Media assets
- Timeline
- Persistent timeline items
- Source clips
- AI suggestions
- Edit operations
- History stacks

The project model is intentionally separate from computed playback state. Computed objects can be discarded and rebuilt from project state.

## Media Assets

The planned media asset layer represents durable media references and metadata. Current assets include basic fields such as:

- `id`
- `type`
- `filename`
- `duration`
- optional dimensions and source URI

The source media file is immutable. Future asset work should handle:

- Durable file references
- Relink state
- Proxy media
- Waveforms
- Thumbnail indexes
- Cloud storage IDs
- Render-safe asset manifests

## Source Clips

Source clips describe media ranges and source metadata. They are not split or duplicated when the user edits. Split creates persistent timeline item identities that reference the same source clip.

Current source clip data includes:

- `id`
- `assetId`
- `trackId`
- `source.start`
- `source.end`
- `timeline.start`
- `timeline.end`
- playback and enabled metadata

## TimelineItems

`TimelineItem` is the persistent editable timeline identity introduced to avoid projection-generated edit targets.

TimelineItem Schema v2 separates source mapping, timeline placement, and metadata.

### Source Model

Source fields describe where content comes from inside immutable source media:

- `sourceId`
- `sourceStart`
- `sourceEnd`

Moving a timeline item must not change these fields.

### Timeline Placement Model

Timeline placement fields describe where the item exists in the editor timeline:

- `timelineStart`
- `timelineDuration`

Future move operations should update only timeline placement. Future ripple operations should update timeline placement for affected downstream items without changing source references.

### Metadata

Timeline item metadata is reserved for editability and organization:

- `trackId`
- `locked`
- `muted`
- `visible`
- `reviewId`
- `groupId`

Timeline items belong to project state. They are not `ComputedClip`s.

Split operations create persistent child timeline item IDs. Each child references the same source and receives explicit source and timeline ranges during projection. Projection uses those IDs to derive the current visible timeline. Operations target `timelineItemId`, not source IDs and not computed projection IDs.

## Operation Log

The operation log stores non-destructive edit intent in `project.operations`.

Current operation types include:

- `TrimOperation`
- `DeleteOperation`
- `SplitOperation`
- `MoveOperation`
- `ReviewDecisionOperation`
- placeholders for future operation types

Current edit operations target persistent `timelineItemId` where applicable. Trim and delete ranges are item-relative offsets, not absolute timeline coordinates.

Item-relative ranges are measured from the operation target item's start. Projection converts those offsets into the target item's current timeline placement before calculating visible ranges, deleted ranges, and playback ranges. This keeps existing edits attached to the intended item if a future move operation changes `timelineStart`.

After split, projection tracks ancestor item ranges while computing child items. An edit made before split remains relative to the parent item it targeted, while an edit made after split against a child item is relative to that child.

### TrimOperation

Trim defines the visible range for a timeline item. Engine v1 stores trim boundaries as item-relative offsets so timeline placement can change without invalidating the edit.

Fields:

- `id`
- `type: "trim"`
- `timelineItemId`
- `relativeStart`
- `relativeEnd`
- `createdAt`

### DeleteOperation

Delete defines a non-destructive removed range for a timeline item. Engine v1 stores delete boundaries as item-relative offsets and projection maps them into the item's current timeline range.

Fields:

- `id`
- `type: "delete"`
- `timelineItemId`
- `relativeStart`
- `relativeEnd`
- `createdAt`

### SplitOperation

Split replaces one persistent timeline item with two persistent child timeline items during projection.

Fields:

- `id`
- `type: "split"`
- `timelineItemId`
- `splitTime`
- `leftTimelineItemId`
- `rightTimelineItemId`
- `createdAt`

The source media is not duplicated. The left child's source end and timeline end match the right child's source start and timeline start.

### MoveOperation

Move changes only a timeline item's placement.

Fields:

- `id`
- `type: "move"`
- `timelineItemId`
- `timelineStart`
- `createdAt`

Move does not change source identity, source range, timeline duration, trim ranges, or delete ranges. Projection replays move operations with split operations in operation-log order, then maps item-relative trim and delete operations onto the item's current placement. This keeps existing edits attached to the intended timeline item when the item moves.

Engine v1 prevents overlap on committed Move drops in the current single-track video timeline. It does not ripple, reorder, insert, or move neighboring clips.

Move drag uses a free preview model. Only the dragged clip moves during pointer movement. Other clips remain stationary and temporary visual overlap is allowed. Earlier collision-preview resolvers tried to push the dragged preview into valid gaps while the pointer was still moving; that made movement unpredictable and could look like neighboring segments were being pushed. Engine v1 now evaluates collisions only on drop.

Drag keeps three separate positions:

- `originalTimelineStart`: committed position before drag.
- `rawCandidateTimelineStart`: position derived only from original start plus pointer delta through timeline geometry.
- `resolvedPreviewTimelineStart`: raw position after optional Snap.

Collision self-exclusion uses `ComputedClip.id`, the unique projected visible segment identity. This matters after Split because child segments are projected timeline items; exclusion must remove only the dragged visible segment, not a broader source ancestor or unrelated split child.

Drop Placement Policy v1:

- Validate the final preview visible range against every other projected `ComputedClip.visibleStart` / `visibleEnd` range.
- Exclude only the dragged `ComputedClip.id`.
- Touching boundaries is valid.
- Overlap is invalid.
- Invalid drop rolls the preview back to the original position and creates no `MoveOperation`.
- Valid drop creates one `MoveOperation` for the dragged timeline item only.

Timeline start remains bounded at `0`. During drag, timeline content width expands dynamically from the preview end plus a small padding. After a valid drop, projected clip positions determine the timeline content end. After cancellation or invalid drop, temporary expansion disappears.

### Snap System v1

Snapping is an interaction-layer placement aid for Move. It affects only drag preview and the final `timelineStart` stored by `MoveOperation` if the drop is valid; it does not create a separate operation.

Snap targets:

- Start of another visible computed clip
- End of another visible computed clip
- Current playhead

The dragged clip is excluded from snap target generation. Snap checks use projected `ComputedClip` visible ranges, so split children, trimmed clips, and moved clips expose their current visible boundaries.

Drag keeps two separate placements:

- `rawCandidateTimelineStart`: unsnapped placement derived directly from pointer movement.
- `resolvedPreviewTimelineStart`: final preview placement after snap resolution.

Snap detection always compares targets against the raw candidate edges. The resolved preview is not fed back into later pointer calculations.

Snap uses hysteresis:

- Enter threshold: `8px`
- Release threshold: `14px`
- Switch margin: `2px`

When a dragged visible edge enters the enter threshold, preview snaps immediately. Once snapped, the active target is retained until the raw dragged edge leaves the release threshold. A nearby target can replace the active target only when it is meaningfully closer by the switch margin.

Priority:

- Nearest target wins.
- If distances are equal, clip boundaries win over the playhead.
- A snap acquired through the dragged start edge continues resolving through the start edge while active.
- A snap acquired through the dragged end edge continues resolving through the end edge while active.

Visual feedback is intentionally minimal: a thin guide line appears at the active snap target, and clip-boundary targets receive a temporary highlight. The guide disappears when the snap is lost or the drag ends.

Snap and drop validation order:

1. Raw candidate placement from pointer movement.
2. Stable snap target is resolved with hysteresis.
3. Preview renders at the snapped or raw position.
4. On drop, final placement is validated against projected computed clip ranges.
5. Valid drops commit one `MoveOperation`; invalid drops roll back without history.

Snap may preview a placement that is invalid for final drop. Drop validation remains authoritative, so snapping cannot commit an overlapping placement.

### ReviewDecisionOperation

Review decisions are stored as operations so accept/reject participates in undo/redo.

Fields:

- `id`
- `type: "review-decision"`
- `suggestionId`
- `decision`
- `createdAt`

## Operation Groups

Operation groups represent one atomic user action.

Examples:

- Accepting an AI suggestion creates a delete operation and a review decision operation in one group.
- Rejecting an AI suggestion creates one review decision operation in one group.
- Trimming creates one trim operation in one group.
- Splitting creates one split operation in one group.
- Moving creates one move operation in one group.

Undo and redo operate on groups, not individual operations.

## Projection Layer

The projection layer lives in `frontend/src/selectors/`.

Primary files:

- `editProjection.ts`
- `editSelectors.ts`
- `timeMapping.ts`

Projection receives project state and optional runtime duration overrides. It derives:

- Projected timeline items
- Computed clips
- Visible ranges
- Deleted ranges
- Playback ranges
- Normalized playback times

Projection is stateless. It owns no editable identity. Deleting every computed object from memory loses no edit data because projection can be rebuilt from project state.

## Time Coordinate Systems

Engine v1 now treats editor time as three explicit coordinate systems.

### Source Time

Source time is time inside the original media asset. It describes where a frame or sample exists in immutable source media.

Examples:

- A video file frame at `12.0s`
- A source clip range from `0.0s` to `60.0s`

Source time must not imply timeline placement.

### Timeline Time

Timeline time is placement inside the project timeline. It describes where an editable timeline item appears in the sequence.

Examples:

- A timeline item beginning at `10.0s`
- A split point at `12.0s` inside a timeline item

Timeline time must not imply that the range is playable. Trim and delete operations may remove parts of it from playback.

### Playback Time

Playback time is the effective playable cursor after projection has applied edit operations. Playback time is normalized against visible timeline ranges and deleted ranges.

Examples:

- Seeking into a deleted region resolves to the next playable boundary.
- A fully deleted visible range produces a stable display boundary but is not playable.

### Mapping Utilities

Time conversion is centralized in `frontend/src/selectors/timeMapping.ts`.

Current utilities include:

- `sourceToTimeline()`
- `timelineToSource()`
- `sourceRangeToTimeline()`
- `timelineRangeToSource()`
- `timelineToPlayback()`
- `playbackToTimeline()`

Engine v1 still uses a simple one-to-one source/timeline mapping for the current single-source workflow. The explicit model exists so future move, ripple, speed, nested timeline, and export work can use the same conversion layer instead of reintroducing ambiguous number semantics.

## ComputedClip

`ComputedClip` is derived output. It is not editable state.

Current fields include:

- `id`
- `timelineItemId`
- `sourceClipId`
- `trackId`
- `sourceDuration`
- `sourceRange`
- `timelineRange`
- `timeMapping`
- `segmentStart`
- `segmentEnd`
- `visibleStart`
- `visibleEnd`
- `visibleDuration`
- `deletedRanges`
- `playbackRanges`

The `id` corresponds to a persistent timeline item ID. It is not projection-generated.

## Playback

Playback is projection-aware.

All playback time published to project state should pass through projection-aware normalization. The current shared helper is `normalizePlaybackTime()`.

Normalization handles:

- Time before the visible range
- Time after the visible range
- Time inside deleted ranges
- Multiple deleted ranges
- No computed clip
- No playable content

When no playback range exists, the engine uses the visible start as a stable display boundary and marks the result as not playable. Playback remains paused.

### Playback Publication vs Seek Commands

Engine v1 separates playback state from seek commands.

`reportedPlaybackPosition` is state published by `MediaPreview`. It represents the current normalized timeline/playback position from the native media element. Timeline playhead rendering and time display consume this value. It must not be interpreted as a command to seek the player.

`seekRequest` is an explicit command consumed by `MediaPreview`. Each request has a unique `id`, a `timelineTime`, and a reason. The unique id allows repeated seeks to the same timestamp to be processed as separate commands.

Legitimate seek request reasons are:

- `timeline-pointer`
- `timeline-keyboard`
- `timeline-item`
- `filmstrip`
- `suggestion-selection`
- `projection-normalization`
- `media-change`

`MediaPreview` owns the native `HTMLMediaElement.currentTime` and the requestAnimationFrame playback publication loop. Native `currentTime` may be assigned only from an explicit seek request, internal projection normalization, or media/source changes. Player publications must not feed back into `MediaPreview` as implicit seek requests.

## Undo/Redo

Undo and redo are stack-based in Engine v1.

- New operation group:
  - appends operations
  - pushes the group to `undoStack`
  - clears `redoStack`

- Undo:
  - removes all operations from the latest group
  - moves that group to `redoStack`

- Redo:
  - restores the latest redo group
  - moves it back to `undoStack`

Projection always derives from the current `project.operations` array.

## Selection Engine

Selection Engine v1 centralizes timeline item selection in project state.

Current selection shape:

- `primaryItemId`
- `selectedItemIds`

Only single selection is active in Engine v1, so `selectedItemIds` contains either zero or one item. The array form is intentional preparation for multi-select, grouped clips, move operations, and multi-track editing.

Timeline selection behavior:

- Clicking a clip selects it.
- Clicking another clip replaces the selection.
- Clicking empty timeline content clears the selection.
- `Escape` clears selection.

Edit operation targeting:

- Split operates only on the selected timeline item and is disabled when the playhead is outside that item.
- Delete creates an item-relative delete operation for the selected timeline item.
- Trim handles are available only on the selected timeline item.
- Move drag is allowed only on the selected timeline item. Pointer down on another clip selects it first.

The editor should not search for the first clip under the playhead as an operation target. The playhead describes time; selection describes edit ownership.

## Ownership Rules

- Source media owns original media data.
- Source clips reference media and source ranges.
- Timeline items own persistent editable timeline identity.
- Selection owns the current edit target.
- Operations own edit intent.
- Operation groups own undo/redo atomicity.
- Projection owns derived computed state only.
- UI owns transient interaction state only.

Operations must target persistent project state identifiers, primarily `timelineItemId`.

Operations must not target:

- `ComputedClip` objects
- projection-generated segment IDs
- transient UI state

## Design Principles

- Non-destructive editing only.
- Source media is immutable.
- Projection is pure and rebuildable.
- Edit identity is persistent.
- Operations describe intent.
- UI consumes projection and dispatches operations.
- Undo/redo works at user-action granularity.
- AI-generated edits must use the same operation path as manual edits.

## Current Limitations

- Timeline item placement is still minimal.
- Full multi-track editing is not implemented.
- Move and ripple operations are not implemented.
- Timeline-time and source-time mapping need formalization.
- Audio editing is not implemented.
- Effects, transitions, titles, keyframes, and export rendering are planned layers.
- Collaboration and durable version graph are not implemented.
- Projection currently runs in the frontend and is not yet shared with an export worker.
- Manual browser verification is still required for complex interaction chains.

## Future Extension Points

The current architecture is prepared for:

- Move operations
- Ripple delete
- Multi-track timelines
- Linked audio/video items
- Nested timelines
- Effects graph
- Transition operations
- Text and title timeline items
- Keyframes
- AI edit plans
- Batch operation validation
- Export plan generation
- Cloud rendering
- Collaboration and merge logic
- Plugin APIs
