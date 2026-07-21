import type { Clip } from '../models/Clip'
import type { Project } from '../models/Project'
import type { TimelineItem } from '../models/Track'
import {
  getDeleteOperations,
  getSplitOperations,
  getTrimOperations,
  normalizeTrimRange,
} from './editSelectors'

export type DeleteRange = {
  operationId: string
  start: number
  end: number
}

export type PlaybackRange = {
  start: number
  end: number
}

export interface ComputedClip {
  id: string
  timelineItemId: string
  sourceClipId: string
  trackId: string
  sourceDuration: number
  segmentStart: number
  segmentEnd: number
  visibleStart: number
  visibleEnd: number
  visibleDuration: number
  deletedRanges: DeleteRange[]
  playbackRanges: PlaybackRange[]
}

export interface EditProjection {
  clips: ComputedClip[]
  clipsById: Record<string, ComputedClip>
}

export type NormalizedPlaybackTime = {
  time: number
  isPlayable: boolean
}

type EditProjectionOptions = {
  clipDurations?: Record<string, number>
}

interface ProjectedTimelineItem extends TimelineItem {
  ancestorTimelineItemIds: string[]
}

export function buildEditProjection(
  project: Project,
  options: EditProjectionOptions = {},
): EditProjection {
  const operationIndex = createOperationIndex(project)
  const sourceClipsById = new Map(
    project.timeline.tracks
      .flatMap((track) => track.clips)
      .map((clip) => [clip.id, clip]),
  )
  const timelineItems = buildProjectedTimelineItems(
    project.timeline.items,
    operationIndex,
  )
  const clips = timelineItems.flatMap((timelineItem) => {
    const sourceClip = sourceClipsById.get(timelineItem.sourceClipId)

    return sourceClip
      ? [
          computeTimelineItemProjection(
            operationIndex,
            timelineItem,
            sourceClip,
            getClipSourceDuration(
              sourceClip,
              options.clipDurations?.[sourceClip.id],
            ),
          ),
        ]
      : []
  })

  return {
    clips,
    clipsById: Object.fromEntries(
      clips.map((clip) => [clip.id, clip]),
    ),
  }
}

export function getFirstComputedClip(
  projection: EditProjection,
): ComputedClip | null {
  return projection.clips[0] ?? null
}

export function normalizePlaybackTime(
  computedClip: ComputedClip | ComputedClip[] | null,
  requestedTime: number,
): NormalizedPlaybackTime {
  const safeRequestedTime = Number.isFinite(requestedTime)
    ? Math.max(requestedTime, 0)
    : 0

  const computedClips = Array.isArray(computedClip)
    ? computedClip
    : computedClip
      ? [computedClip]
      : []

  if (!computedClips.length) {
    return {
      time: safeRequestedTime,
      isPlayable: true,
    }
  }

  const visibleStart = Math.min(
    ...computedClips.map((clip) => clip.visibleStart),
  )
  const visibleEnd = Math.max(
    ...computedClips.map((clip) => clip.visibleEnd),
  )
  const playbackRanges = mergeRanges(
    computedClips
      .flatMap((clip) => clip.playbackRanges)
      .map((range, index) => ({
        operationId: `playback-${index}`,
        ...range,
      }))
      .sort((left, right) => left.start - right.start),
  )

  if (!playbackRanges.length) {
    return {
      time: visibleStart,
      isPlayable: false,
    }
  }

  const clippedTime = Math.min(
    Math.max(safeRequestedTime, visibleStart),
    visibleEnd,
  )
  const activePlaybackRange = playbackRanges.find(
    (range) => clippedTime >= range.start && clippedTime < range.end,
  )

  if (activePlaybackRange) {
    return {
      time: clippedTime,
      isPlayable: true,
    }
  }

  const nextPlaybackRange = playbackRanges.find(
    (range) => range.start > clippedTime,
  )

  return nextPlaybackRange
    ? {
        time: nextPlaybackRange.start,
        isPlayable: true,
      }
    : {
        time: visibleEnd,
        isPlayable: false,
      }
}

function createOperationIndex(project: Project) {
  const deleteOperationsByTimelineItemId = new Map<
    string,
    ReturnType<typeof getDeleteOperations>
  >()
  const splitOperations = getSplitOperations(project)
  const trimOperations = getTrimOperations(project)

  for (const operation of getDeleteOperations(project)) {
    const operations = deleteOperationsByTimelineItemId.get(operation.timelineItemId) ?? []

    operations.push(operation)
    deleteOperationsByTimelineItemId.set(operation.timelineItemId, operations)
  }

  return {
    deleteOperationsByTimelineItemId,
    splitOperations,
    trimOperations,
  }
}

function buildProjectedTimelineItems(
  initialTimelineItems: TimelineItem[],
  operationIndex: ReturnType<typeof createOperationIndex>,
): ProjectedTimelineItem[] {
  let timelineItems: ProjectedTimelineItem[] = initialTimelineItems.map(
    (timelineItem) => ({
      ...timelineItem,
      ancestorTimelineItemIds: [timelineItem.id],
    }),
  )

  for (const operation of operationIndex.splitOperations) {
    timelineItems = timelineItems.flatMap((timelineItem) => {
      if (
        timelineItem.id !== operation.timelineItemId ||
        operation.splitTime <= timelineItem.start ||
        operation.splitTime >= timelineItem.end
      ) {
        return [timelineItem]
      }

        return [
          {
            ...timelineItem,
            id: operation.leftTimelineItemId,
            end: operation.splitTime,
            ancestorTimelineItemIds: [
              ...timelineItem.ancestorTimelineItemIds,
              operation.leftTimelineItemId,
            ],
          },
          {
            ...timelineItem,
            id: operation.rightTimelineItemId,
            start: operation.splitTime,
            ancestorTimelineItemIds: [
              ...timelineItem.ancestorTimelineItemIds,
              operation.rightTimelineItemId,
            ],
          },
        ]
    })
  }

  return timelineItems
}

function computeTimelineItemProjection(
  operationIndex: ReturnType<typeof createOperationIndex>,
  timelineItem: ProjectedTimelineItem,
  sourceClip: Clip,
  sourceDuration: number,
): ComputedClip {
  const ancestorTimelineItemIdSet = new Set(timelineItem.ancestorTimelineItemIds)
  const trimOperation = operationIndex.trimOperations
    .filter((operation) => ancestorTimelineItemIdSet.has(operation.timelineItemId))
    .at(-1)
  const visibleRange = trimOperation
    ? normalizeSegmentTrimRange(
        trimOperation.trimStart,
        trimOperation.trimEnd,
        timelineItem,
      )
    : {
        start: timelineItem.start,
        end: timelineItem.end,
      }
  const deletedRanges = timelineItem.ancestorTimelineItemIds
    .flatMap((timelineItemId) => (
      operationIndex.deleteOperationsByTimelineItemId.get(timelineItemId) ?? []
    ))
    .map((operation) => ({
      operationId: operation.id,
      start: Math.max(operation.startTime, visibleRange.start),
      end: Math.min(operation.endTime, visibleRange.end),
    }))
    .filter((range) => range.start < range.end)
    .sort((left, right) => left.start - right.start)
  const playbackRanges = subtractDeletedRanges(
    {
      start: visibleRange.start,
      end: visibleRange.end,
    },
    deletedRanges,
  )

  return {
    id: timelineItem.id,
    timelineItemId: timelineItem.id,
    sourceClipId: sourceClip.id,
    trackId: timelineItem.trackId,
    sourceDuration,
    segmentStart: timelineItem.start,
    segmentEnd: timelineItem.end,
    visibleStart: visibleRange.start,
    visibleEnd: visibleRange.end,
    visibleDuration: visibleRange.end - visibleRange.start,
    deletedRanges,
    playbackRanges,
  }
}

function normalizeSegmentTrimRange(
  trimStart: number,
  trimEnd: number,
  segmentRange: { start: number; end: number },
): PlaybackRange {
  const trimRange = normalizeTrimRange(
    trimStart,
    trimEnd,
    segmentRange.end,
  )
  const start = Math.min(
    Math.max(trimRange.trimStart, segmentRange.start),
    segmentRange.end,
  )
  const end = Math.min(
    Math.max(trimRange.trimEnd, start),
    segmentRange.end,
  )

  return start < end
    ? { start, end }
    : segmentRange
}

function getClipSourceDuration(clip: Clip, durationOverride?: number) {
  if (Number.isFinite(durationOverride)) {
    return Math.max(durationOverride ?? 0, 0)
  }

  return Math.max(clip.source.end - clip.source.start, 0)
}

function subtractDeletedRanges(
  visibleRange: PlaybackRange,
  deletedRanges: DeleteRange[],
): PlaybackRange[] {
  const mergedDeletedRanges = mergeRanges(deletedRanges)
  const playbackRanges: PlaybackRange[] = []
  let cursor = visibleRange.start

  for (const range of mergedDeletedRanges) {
    if (range.start > cursor) {
      playbackRanges.push({
        start: cursor,
        end: range.start,
      })
    }
    cursor = Math.max(cursor, range.end)
  }

  if (cursor < visibleRange.end) {
    playbackRanges.push({
      start: cursor,
      end: visibleRange.end,
    })
  }

  return playbackRanges
}

function mergeRanges(ranges: DeleteRange[]): DeleteRange[] {
  const mergedRanges: DeleteRange[] = []

  for (const range of ranges) {
    const previousRange = mergedRanges.at(-1)

    if (!previousRange || range.start > previousRange.end) {
      mergedRanges.push({ ...range })
      continue
    }

    previousRange.end = Math.max(previousRange.end, range.end)
  }

  return mergedRanges
}
