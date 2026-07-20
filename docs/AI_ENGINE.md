# AI Engine

The AI engine is currently a review foundation, not an editing engine. Suggestions are represented as structured data and can be accepted or rejected without changing media.

## Suggestion Model

```ts
interface AISuggestion {
  id: string
  type: 'cut' | 'trim' | 'silence'
  start: number
  end: number
  confidence: number
  reason: string
  status: 'pending' | 'accepted' | 'rejected'
}
```

## Current Implementation

- Mock suggestions live in `frontend/src/data/aiSuggestions.ts`.
- Shared suggestion helpers live in `frontend/src/utils/aiSuggestions.ts`.
- Review state lives in `App.tsx`.
- Timeline rendering receives suggestions as data and renders them as timeline blocks.
- The review panel provides filters, counts, multi-selection, active selection, batch accept/reject, status labels, and estimated removed time.

## Non-Destructive Guarantees

Accepting or rejecting a suggestion only changes `AISuggestion.status`.

The current implementation does not:

- Modify source video files.
- Modify scene or transcript data.
- Run FFmpeg as part of suggestion review.
- Generate export artifacts from accepted suggestions.

## Future Edit Engine Boundary

`frontend/src/utils/aiEditEngine.ts` defines `applyAcceptedSuggestions()` as a reserved integration point. It intentionally does not implement editing.

Future behavior should follow this sequence:

```text
AISuggestion[]
  |
  v
Accepted suggestions
  |
  v
applyAcceptedSuggestions()
  |
  v
Non-destructive edit plan
  |
  v
Preview and export pipeline
```

## Planned Suggestion Sources

- Silence detection.
- Long pause detection.
- Filler-word detection.
- Intro/outro trimming.
- Scene pacing analysis.
- Platform-specific duration targeting.

## Estimated Removed Time

The review summary calculates estimated removed time from accepted suggestions only:

```text
sum(max(end - start, 0)) for accepted suggestions
```

This is a review estimate, not an applied edit duration.
