# Glossary

## Project

The saved editing work, including media references, workflow state, output settings, and future timeline data.

## Workspace

The active editor area where the user reviews media, settings, stages, and future timeline outputs.

## Asset

Any source file or reusable element used in a project, such as video, image, audio, overlay, or future template media.

## Media Library

The in-app collection of imported media items available to the current project.

## Clip

A source media item or a selected portion of source media used in an edit.

## Scene

A visually distinct section of video separated by a detected or user-defined change.

## Scene Detection

The process of identifying scene-change timestamps in video, currently using FFmpeg.

## Segment

A timeline-ready range with start and end boundaries. Current scene timestamps are not yet full segments.

## Timeline

The ordered edit structure that will define selected source ranges, effects, audio, and export output.

## Preview

Generated visual frames used to inspect a video quickly without playing through the full source.

## Metadata

Technical media information such as duration, dimensions, FPS, codec, bitrate, and file size.

## Pipeline

The sequence of processing stages from import through metadata, previews, scene detection, future analysis, timeline generation, and export.

## Render

The act of producing video output from an approved timeline and effects plan.

## Export

The final rendered file or future compatible project artifact produced from the approved edit.

## AI Analysis

Future structured interpretation of media, scenes, speech, and goals to support reviewable editing decisions.

## Whisper

The planned local transcription engine or compatible model stage for speech-to-text processing.

## FFmpeg

The local media-processing tool used for preview generation, scene detection, and likely future rendering work.

## Hook

A React function that owns stateful frontend workflow logic, such as media library queues and request cancellation.

## Service

A module that owns API calls on the frontend or domain/media-processing logic on the backend.

## Job

A unit of processing work, such as metadata extraction, preview generation, scene detection, transcription, or export.

## Queue

A bounded list of pending jobs used to avoid launching too many expensive operations at once.

## AbortController

A browser API used to cancel frontend requests and prevent stale responses from updating removed or obsolete media items.

## ADR

Architecture Decision Record: a documented decision with context, reasons, consequences, and review conditions.

## Technical Debt

Known deferred work that is tracked because it may affect maintainability, performance, correctness, or future development speed.
