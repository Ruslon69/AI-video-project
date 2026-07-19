# Product Vision

AI Video Director is intended to become a local-first AI-assisted short-form video editor. The product should help creators turn source media into reviewed, reproducible edits while keeping the user in control.

## Target Users

- Solo creators producing short-form social video.
- Editors who want fast first cuts without losing review control.
- Project owners evaluating how AI can assist local media workflows.
- Technical reviewers and contributors assessing a staged AI editor architecture.

## Primary Problems

- Finding usable moments in long source media is slow.
- Cutting, trimming, captioning, and adding effects is repetitive.
- AI editing tools can feel opaque when decisions cannot be inspected.
- Remote processing can be undesirable for private or large local media.

## Product Promise

AI Video Director should make media processing observable, reviewable, and recoverable. The user should see each stage, approve or revise outputs, and avoid hidden destructive actions.

## Current Capabilities

- Editor UI foundation with project stages, review panel, assistant panel, contextual help, and theme support.
- Staged approval workflow with project version records and rollback-oriented state.
- Local media library for videos, images, and audio.
- Video metadata extraction through the backend.
- Preview frame generation with FFmpeg.
- Scene-change detection with FFmpeg.
- Project output settings for target platform, duration, aspect ratio, resolution, and output format assumptions.

## Near-Term Goals

- Whisper transcription foundation.
- Combined scene and speech analysis.
- Timeline segment generation from detected scenes and transcript data.
- Early AI editing decision structures.
- Export pipeline foundation.

## Long-Term Vision

- Reference-video learning to guide pacing, structure, and style choices.
- Automatic cuts and trimming with reviewable reasoning.
- Zooms, dynamic effects, images, overlays, flying text, subtitles, background music, and sound effects.
- Scene understanding and speech transcription that feed explicit timeline decisions.
- Export pipeline with possible compatibility paths for CapCut and Final Cut Pro.
- A standalone editor direction where AI assists but does not replace user approval.
- Contextual assistant and help that explain the current editing stage.
- Light, dark, and system themes.
- Free/open-source-first development where practical.

## Not Yet Committed Features

These ideas are part of the product direction but are not implemented commitments:

- CapCut compatibility.
- Final Cut Pro compatibility.
- Fully automated editing decisions.
- Hosted collaboration or cloud rendering.
- Standalone packaged desktop distribution.

## Product Principles

- The user remains in control.
- Every AI stage can be reviewed.
- Outputs should be reproducible.
- Processing should remain observable.
- Failures should be recoverable.
- Local processing is preferred where practical.
- Performance should degrade predictably.
- No hidden destructive actions.
