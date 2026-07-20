# Timeline

The timeline displays media analysis and review information using a shared track architecture. It is a visualization and interaction surface, not an edit engine.

## Current Tracks

| Track | Source Data | Purpose |
| --- | --- | --- |
| Video | Preview frames | Shows frame thumbnails and supports seeking. |
| Scenes | Scene detection result | Shows detected scene ranges. |
| Transcript | Transcription segments | Shows spoken text ranges. |
| AI Suggestions | `AISuggestion[]` | Shows reviewable non-destructive suggestions. |

## Coordinate System

Timeline blocks use a shared seconds-to-pixels coordinate system:

```text
left = start * pixelsPerSecond
width = (end - start) * pixelsPerSecond
```

Blocks are positioned absolutely inside their track lane. Flexbox is not used for timeline block positioning.

## Selection Model

AI suggestion selection has two parts:

- `selectedAISuggestionIds`: all selected suggestions highlighted on both the panel and timeline.
- `activeAISuggestionId`: the active suggestion used for seeking and stronger visual emphasis.

Selecting a suggestion from the timeline activates it, adds it to selection if needed, seeks the video, and moves the playhead. Selecting from the panel uses the same state and keeps timeline highlighting synchronized.

## Rendering Boundary

The timeline receives scenes, transcript segments, preview frames, and AI suggestions as props. It converts them into `TimelineTrack` and `TimelineItem` data for rendering. Business logic stays outside the timeline.

## Current Constraints

- Do not modify source media.
- Do not run FFmpeg from timeline interactions.
- Do not persist timeline edits as source changes.
- Keep ruler, zoom, playhead, scene, transcript, and filmstrip behavior independent.

## Next Stages

- Add tests for block positioning and selection state.
- Support generated AI suggestion arrays from future analysis services.
- Add edit-plan preview tracks only after a non-destructive edit-plan model exists.
