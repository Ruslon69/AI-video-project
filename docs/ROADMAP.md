# Roadmap

This roadmap tracks the current development direction for AI Video Director. The project is still in the foundation phase and intentionally keeps AI review non-destructive.

## Current Phase

The current app supports local media import, metadata extraction, preview frame generation, scene detection, transcription, timeline visualization, and reviewable AI suggestions.

AI suggestions are mock data today. Users can inspect, filter, select, accept, and reject suggestions, but these actions only update suggestion status. They do not change media files, timeline source data, or exports.

## Near-Term Milestones

1. Persist AI suggestion review state alongside project state.
2. Replace mock suggestions with generated suggestions from transcript, silence, scene, and pacing analysis.
3. Add stronger keyboard navigation and accessibility coverage for review workflows.
4. Define a non-destructive edit plan model that can be previewed before export.
5. Implement export planning and rendering as a separate backend service boundary.

## Medium-Term Milestones

- Add real silence and filler-word detection.
- Introduce suggestion grouping by intent, confidence, and source signal.
- Support project-level save/load for imported media references and review decisions.
- Add tests around timeline rendering calculations and AI suggestion state transitions.
- Add a preview-only edit-plan viewer before any export operation.

## Long-Term Milestones

- Generate platform-aware edit plans for Shorts, Reels, TikTok, and custom outputs.
- Add effects, captions, music, and audio adjustment planning.
- Add controlled export jobs with progress, cancellation, and artifact history.
- Support comparing AI-generated edit variants.

## Non-Goals For The Current Phase

- Modifying source video files.
- Running FFmpeg from the frontend.
- Applying accepted AI suggestions directly to media.
- Coupling AI generation logic to timeline rendering.
