import type {
  DeleteOperation,
  ReviewDecisionOperation,
  SplitOperation,
  TrimOperation,
} from '../models/EditOperation'
import type { Project } from '../models/Project'
import type { TimelineItem } from '../models/Track'
import type { AISuggestion } from '../types'

export const minimumTrimDuration = 0.1

export type ClipTrimRange = {
  trimStart: number
  trimEnd: number
}

export function getDeleteOperations(project: Project): DeleteOperation[] {
  return project.operations.filter(
    (operation): operation is DeleteOperation => operation.type === 'delete',
  )
}

export function getReviewDecisionOperations(project: Project): ReviewDecisionOperation[] {
  return project.operations.filter(
    (operation): operation is ReviewDecisionOperation =>
      operation.type === 'review-decision',
  )
}

export function getTrimOperations(project: Project): TrimOperation[] {
  return project.operations.filter(
    (operation): operation is TrimOperation => operation.type === 'trim',
  )
}

export function getSplitOperations(project: Project): SplitOperation[] {
  return project.operations.filter(
    (operation): operation is SplitOperation => operation.type === 'split',
  )
}

export function getLatestTrimOperation(
  project: Project,
  timelineItemId: string,
): TrimOperation | undefined {
  return getTrimOperations(project)
    .filter((operation) => operation.timelineItemId === timelineItemId)
    .at(-1)
}

export function getSuggestionReviewStatus(
  project: Project,
  suggestionId: string,
): AISuggestion['status'] {
  return getReviewDecisionOperations(project)
    .filter((operation) => operation.suggestionId === suggestionId)
    .at(-1)?.decision ?? 'pending'
}

export function getProjectedSuggestions(project: Project): AISuggestion[] {
  return project.suggestions.map((suggestion) => ({
    ...suggestion,
    status: getSuggestionReviewStatus(project, suggestion.id),
  }))
}

export function getFirstEnabledTimelineItem(project: Project): TimelineItem | null {
  return project.timeline.items.find((timelineItem) => {
    const sourceClip = project.timeline.tracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.id === timelineItem.sourceClipId)

    return sourceClip?.enabled ?? false
  }) ?? null
}

export function normalizeTrimRange(
  trimStart: number,
  trimEnd: number,
  sourceDuration: number,
): ClipTrimRange {
  const normalizedDuration = Number.isFinite(sourceDuration)
    ? Math.max(sourceDuration, 0)
    : 0
  const maxTrimStart = Math.max(normalizedDuration - minimumTrimDuration, 0)
  const safeStart = Number.isFinite(trimStart)
    ? Math.min(Math.max(trimStart, 0), maxTrimStart)
    : 0
  const safeEnd = Number.isFinite(trimEnd)
    ? Math.min(Math.max(trimEnd, safeStart + minimumTrimDuration), normalizedDuration)
    : normalizedDuration

  if (safeStart >= safeEnd) {
    return {
      trimStart: 0,
      trimEnd: normalizedDuration,
    }
  }

  return {
    trimStart: safeStart,
    trimEnd: safeEnd,
  }
}
