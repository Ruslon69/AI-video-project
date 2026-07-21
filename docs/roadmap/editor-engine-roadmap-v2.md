# Editor Engine Roadmap v2

## Purpose

This roadmap describes the path from Editor Engine v1 to a production-ready AI-first non-linear video editor. It is an architecture plan, not an implementation checklist for the current sprint.

Engine v1 already includes persistent timeline items, source media, edit operations, operation groups, undo/redo, projection, non-destructive trim/delete/split, and playback normalization.

The long-term direction is to preserve three boundaries:

- **Project Model**: durable source of truth
- **Operation Log**: non-destructive edit intent
- **Projection and Evaluation Engine**: deterministic computed timeline

## Guiding Principles

- Source media is immutable.
- Timeline identity is persistent.
- Projection remains stateless and rebuildable.
- UI never owns edit truth.
- AI uses the same validated operation path as users.
- Export consumes the same computed timeline semantics as preview.
- Architecture should support years of editing features without hiding mutable state in computed objects.

## Engine v2: Formal Timeline Model

### Milestone: Timeline-Time Mapping

**Goal**  
Define formal mapping between source time, timeline time, and visible playback time.

**Why it exists**  
Trim, split, move, ripple, speed changes, transitions, export, and AI edits all need consistent coordinate systems.

**Dependencies**  
Persistent timeline items, projection layer, operation validation.

**Architectural risks**  
Adding move/ripple before this model is formalized can create inconsistent behavior across playback, timeline rendering, and export.

**Future benefits**  
Reliable multi-track editing, deterministic export plans, waveform sync, thumbnail mapping, and AI edit simulation.

### Milestone: TimelineItem Schema v2

**Goal**  
Expand timeline items with durable placement and edit metadata.

Potential fields:

- `id`
- `sourceClipId`
- `trackId`
- `timelineStart`
- `timelineEnd`
- `sourceStart`
- `sourceEnd`
- `enabled`
- `order`
- `parentTimelineId`

**Why it exists**  
Current timeline items are intentionally minimal. Production editing needs explicit placement and ordering.

**Dependencies**  
Timeline-time mapping.

**Architectural risks**  
Source clips could accidentally absorb timeline responsibilities if timeline items remain too small.

**Future benefits**  
Move, ripple, nested timelines, multi-track editing, and reliable AI operation targeting.

### Milestone: Operation Validation Layer

**Goal**  
Centralize validation for trim, split, delete, move, ripple, speed, transition, and AI operations.

**Why it exists**  
Context actions and UI components should not contain edit-domain business rules.

**Dependencies**  
Operation model, persistent timeline items, projection.

**Architectural risks**  
Invalid operations accumulating in project state can make projection and export unreliable.

**Future benefits**  
Safe AI batches, import validation, collaboration conflict checks, and export readiness.

### Milestone: Projection Test Suite

**Goal**  
Add deterministic tests for projection edge cases.

**Why it exists**  
Projection is the editor engine’s computation core.

**Dependencies**  
Stable operation model and timeline item model.

**Architectural risks**  
UI-only testing will miss edit graph bugs.

**Future benefits**  
Confident refactors, AI-generated edit plans, and export parity.

## Engine v3: Core Editing Operations

### Milestone: MoveOperation

**Goal**  
Move timeline items without modifying source media.

**Why it exists**  
Move is required for real non-linear editing.

**Dependencies**  
Timeline-time mapping, placement fields, operation validation.

**Architectural risks**  
Collision handling and item ordering can become ambiguous without formal rules.

**Future benefits**  
Drag editing, scene reordering, AI rearrangement, and timeline layout tools.

### Milestone: RippleOperation

**Goal**  
Define operations that close or open gaps across affected timeline items.

**Why it exists**  
Delete and insert workflows need predictable downstream movement.

**Dependencies**  
Move semantics, item ordering, track constraints.

**Architectural risks**  
Ripple across linked items and multiple tracks can desynchronize edits if rules are unclear.

**Future benefits**  
Fast timeline editing, transcript-based editing, and AI cutdowns.

### Milestone: Multi-Track Timeline

**Goal**  
Support multiple video, audio, text, and effect tracks.

**Why it exists**  
Production editing requires overlays, b-roll, music, captions, and compositing.

**Dependencies**  
Track-aware placement, collision rules, linked items.

**Architectural risks**  
Track sync, linked audio/video behavior, and ripple across grouped items.

**Future benefits**  
Professional timeline workflows and AI-generated layered edits.

### Milestone: Linked Items

**Goal**  
Link related timeline items, such as video and audio from the same source.

**Why it exists**  
Video and audio must remain synchronized unless explicitly unlinked.

**Dependencies**  
Multi-track model and operation validation.

**Architectural risks**  
Partial edits can desynchronize linked media.

**Future benefits**  
Safe video/audio editing, grouped selection, and AI audio-video operations.

## Engine v4: Effects, Transitions, Titles, Audio

### Milestone: Effects Graph

**Goal**  
Introduce a non-destructive graph for visual and audio effects.

**Why it exists**  
Effects should not be baked into source media or timeline items until render/export.

**Dependencies**  
Timeline items, render pipeline abstraction.

**Architectural risks**  
Effect ordering, parameter interpolation, and preview/export mismatch.

**Future benefits**  
Color, transforms, blur, stabilization, AI effects, and reusable presets.

### Milestone: Transition Model

**Goal**  
Represent transitions between adjacent timeline items.

**Why it exists**  
Transitions are relationships between items, not simple clip-local properties.

**Dependencies**  
Timeline adjacency, overlap rules, effects/render pipeline.

**Architectural risks**  
Move and ripple operations can invalidate transition endpoints.

**Future benefits**  
Crossfades, fades, pacing polish, and AI-generated transitions.

### Milestone: Title and Text System

**Goal**  
Add persistent text, captions, and title items.

**Why it exists**  
Captions, lower thirds, overlays, and AI-generated titles need first-class timeline support.

**Dependencies**  
Multi-track timeline, effects/render pipeline.

**Architectural risks**  
Text layout must match between preview and export.

**Future benefits**  
Captions, social templates, branding, and generated overlays.

### Milestone: Keyframes

**Goal**  
Support time-varying parameters for effects, audio, transforms, and titles.

**Why it exists**  
Professional motion and mix automation require interpolation over time.

**Dependencies**  
Effects graph and formal timeline-time mapping.

**Architectural risks**  
Interpolation semantics and performance can become inconsistent if handled per component.

**Future benefits**  
Animation, audio fades, dynamic AI edits, and template systems.

### Milestone: Audio Engine

**Goal**  
Add waveform, gain, fades, ducking, and mixdown model.

**Why it exists**  
Production editing requires reliable audio control.

**Dependencies**  
Multi-track timeline, linked items, effects graph.

**Architectural risks**  
Sync, latency, and export parity.

**Future benefits**  
Music beds, voice cleanup, AI audio mixing, and podcast workflows.

## AI v1: Suggestion Engine

### Milestone: AI Suggestion Pipeline

**Goal**  
Standardize how AI modules produce suggestions and candidate operations.

**Why it exists**  
AI should not directly mutate project state.

**Dependencies**  
Operation validation, projection tests.

**Architectural risks**  
AI actions bypassing engine rules can corrupt the timeline.

**Future benefits**  
Safe review workflow and repeatable AI edits.

### Milestone: Edit Plan Model

**Goal**  
Represent AI output as explicit plans with operations, rationale, confidence, and dependencies.

**Why it exists**  
Users need reviewable, explainable AI-generated edits.

**Dependencies**  
Operation groups and validation.

**Architectural risks**  
Unclear ownership between suggestions, operations, and committed project state.

**Future benefits**  
Batch accept/reject, preview-before-apply, and auditability.

### Milestone: AI Batch Apply

**Goal**  
Apply many validated operation groups atomically or as structured batches.

**Why it exists**  
AI cutdowns may generate hundreds or thousands of edits.

**Dependencies**  
Validation, stable operation IDs, history model.

**Architectural risks**  
Performance and undo granularity.

**Future benefits**  
AI-first editing without losing user control.

## AI v2: Agentic Editing

### Milestone: Task-Based AI Agents

**Goal**  
Allow AI agents to perform structured tasks such as cut silence, create short, add captions, and improve pacing.

**Why it exists**  
Higher-level editing requires multi-step planning.

**Dependencies**  
Edit plans, validation, projection.

**Architectural risks**  
Nondeterministic results and low user trust.

**Future benefits**  
Professional AI workflows and reusable editing assistants.

### Milestone: Simulation Before Apply

**Goal**  
Run AI plans against projection before committing operations.

**Why it exists**  
Invalid plans should be rejected before they enter project history.

**Dependencies**  
Projection engine, validation, edit plan model.

**Architectural risks**  
Preview/export mismatch.

**Future benefits**  
Safe AI automation and explainable previews.

### Milestone: AI Memory and Style Profiles

**Goal**  
Store project and editor preferences separately from timeline state.

**Why it exists**  
AI should learn style without corrupting project data.

**Dependencies**  
Project metadata and agent system.

**Architectural risks**  
Privacy, stale preferences, and accidental hidden state.

**Future benefits**  
Personalized editing and consistent brand/style output.

## Export v1: Deterministic Export Pipeline

### Milestone: Export Plan

**Goal**  
Convert projection into a render/export plan.

**Why it exists**  
Export must consume the same computed timeline semantics as preview.

**Dependencies**  
Projection and media asset resolution.

**Architectural risks**  
Preview/export divergence.

**Future benefits**  
Deterministic render output and easier cloud rendering.

### Milestone: Local Render Pipeline

**Goal**  
Render non-destructive operations without changing source media.

**Why it exists**  
The editor needs deliverable output.

**Dependencies**  
Export plan and media asset manifests.

**Architectural risks**  
Codec support, platform differences, and long-running job management.

**Future benefits**  
First production exports.

### Milestone: Cloud Render Architecture

**Goal**  
Make export jobs portable to remote workers.

**Why it exists**  
Long renders, AI effects, and team workflows need scalable compute.

**Dependencies**  
Asset storage, deterministic serialization, export plans.

**Architectural risks**  
Asset sync, worker version mismatch, and retry safety.

**Future benefits**  
Scalable rendering and collaboration.

## Collaboration and History

### Milestone: Project Version Graph

**Goal**  
Replace simple linear history assumptions with durable versions.

**Why it exists**  
Undo/redo is session-local. Production projects need restore, branches, checkpoints, and review versions.

**Dependencies**  
Operation groups and project serialization.

**Architectural risks**  
Storage growth and merge complexity.

**Future benefits**  
Safe experimentation and review workflows.

### Milestone: Collaboration Model

**Goal**  
Support multiple users editing and reviewing safely.

**Why it exists**  
Real video projects are collaborative.

**Dependencies**  
Stable operation IDs, version graph, conflict detection.

**Architectural risks**  
Concurrent edit conflicts and permission boundaries.

**Future benefits**  
Team editing, comments, approvals, and shared AI workflows.

### Milestone: Conflict Resolution

**Goal**  
Detect and resolve operation conflicts.

**Why it exists**  
Multiple users or AI agents may edit the same timeline item.

**Dependencies**  
Operation validation and target identity model.

**Architectural risks**  
Hidden destructive merges.

**Future benefits**  
Reliable multi-user editing and auditable project history.

## Plugin Platform

### Milestone: Plugin API Boundary

**Goal**  
Define what plugins can read, suggest, and mutate.

**Why it exists**  
Plugins must not bypass operation validation.

**Dependencies**  
Operation model, AI plan model, validation.

**Architectural risks**  
Security issues and project corruption.

**Future benefits**  
Extensible editing workflows.

### Milestone: Plugin Sandbox

**Goal**  
Run third-party tools safely.

**Why it exists**  
Media plugins can be powerful and risky.

**Dependencies**  
Plugin API and permission model.

**Architectural risks**  
Performance, permissions, and data leakage.

**Future benefits**  
Ecosystem growth and custom production workflows.

## Features Requiring Fundamental Architecture Changes

- **Multi-track** requires timeline placement, track constraints, and linked items.
- **Ripple editing** requires formal timeline-time mapping and ordered item graph behavior.
- **Nested timelines** require timeline items that can reference timelines, not only source clips.
- **Effects graph** requires render graph state separate from clip operations.
- **Transitions** require relationship operations between adjacent items.
- **Audio tracks** require linked media, waveform data, mix graph, and sync rules.
- **Titles** require timeline-native generated media or effect nodes.
- **Keyframes** require parameter timelines and interpolation semantics.
- **AI editing** requires edit plans, validation, simulation, and batch operations.
- **AI agents** require task orchestration and permissioned operation application.
- **Cloud rendering** requires deterministic serialized project and export plans.
- **Collaboration** requires version graph, conflict detection, and merge semantics.
- **Version history** requires durable snapshots or operation-log checkpoints.
- **Export pipeline** requires projection-to-render translation.
- **Plugins** require sandboxed APIs and strict validation boundaries.

## Recommended Phase Order

1. Engine v2: timeline-time model, stronger timeline items, validation, projection tests.
2. Engine v3: move, ripple, multi-track, linked items.
3. Engine v4: effects, transitions, titles, keyframes, audio.
4. AI v1: suggestion pipeline, edit plans, batch apply.
5. Export v1: export plan, local render.
6. Collaboration v1: version graph, comments, review.
7. AI v2: agents, simulation, style memory.
8. Export v2: cloud rendering.
9. Plugin Platform: sandboxed extension APIs.
