# Technical Debt Register

This register tracks known deferred work. Deferred items are not defects unless they cause incorrect behavior.

## Duplicated Preview and Scene Queue Orchestration

Area: Frontend media workflow
Current impact: `useMediaLibrary` contains similar queue, cancellation, stale-response, and cleanup logic for previews and scenes.
Why deferred: Only two concrete queued stages exist, so a shared abstraction may still be premature.
Trigger: Add a third queued media pipeline stage or need shared retry/progress behavior.
Priority: Medium

## Duplicated Backend Probe-Validation Logic

Area: Backend media services
Current impact: Preview and scene services both validate video stream, duration, and dimensions.
Why deferred: The duplicated logic is small and explicit.
Trigger: Transcription, analysis, or export needs the same validation contract.
Priority: Medium

## Base64 Preview Transport

Area: Frontend/backend preview transport
Current impact: Preview frames are returned as Base64 data URLs, increasing payload size and frontend memory pressure.
Why deferred: It is acceptable for the first local foundation and avoids storage endpoints.
Trigger: Large libraries, repeated previews, or playback responsiveness issues.
Priority: Medium

## No Scene-Detection Caching

Area: Backend media processing
Current impact: Repeated scene detection reuploads and reprocesses the same video.
Why deferred: There is no persistent media/job storage layer yet.
Trigger: Repeated processing becomes common or timeline generation needs stable stored scene outputs.
Priority: Medium

## Browser Abort Does Not Stop Running Backend FFmpeg

Area: Backend job lifecycle
Current impact: Aborting a frontend request does not necessarily terminate an already-running backend FFmpeg subprocess before timeout/completion.
Why deferred: Current request-based processing is simpler and bounded by timeouts.
Trigger: Long videos, frequent cancellations, or queue backpressure issues.
Priority: High

## Scene Timestamps Are Not Timeline Segments

Area: Timeline foundation
Current impact: The app stores scene-change timestamps but does not derive full segments with start/end boundaries.
Why deferred: Timeline generation is a later pipeline stage.
Trigger: Implement timeline segment generation.
Priority: High

## Limited Progress Reporting for Long-Running Jobs

Area: UX and job infrastructure
Current impact: Users see processing states but not detailed progress.
Why deferred: Current operations are request/response foundations.
Trigger: Add transcription, analysis, export, or longer scene detection jobs.
Priority: Medium

## No Standardized FFmpeg Video Fixtures in CI

Area: Testing
Current impact: Backend tests cover deterministic parsing/validation but do not run full FFmpeg integration fixtures.
Why deferred: CI and fixture strategy are not established.
Trigger: Add CI or make media-processing regressions frequent enough to justify generated fixtures.
Priority: Medium

## Possible Shared Bounded-Job Helper

Area: Frontend architecture
Current impact: Each queued operation owns its own refs and pump loop.
Why deferred: Existing duplication is tolerable and keeps stage behavior explicit.
Trigger: Multiple stages need identical queue semantics, retry behavior, or progress handling.
Priority: Low

## Possible Persistent Job State

Area: Backend architecture
Current impact: Processing state exists only within individual requests and frontend memory.
Why deferred: Persistent jobs would add infrastructure before the pipeline needs it.
Trigger: Add long-running transcription/export, resumable jobs, or cached processing artifacts.
Priority: Medium
