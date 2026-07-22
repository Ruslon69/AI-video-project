import type { Clip } from '../models/Clip'
import type { Project } from '../models/Project'
import {
  playbackTime,
  sourceTime,
  timelineTime,
  type PlaybackTime,
  type SourceTime,
  type TimelineTime,
  type TimeRange,
} from '../models/Time'
import type { TimelineItem } from '../models/Track'
import {
  getDeleteOperations,
  getSplitOperations,
  getTrimOperations,
  normalizeTrimRange,
} from './editSelectors'
import {
  createTimelineTimeMapping,
  timelineRangeToSource,
  timelineToPlayback,
  type TimelineTimeMapping,
} from './timeMapping'

export type DeleteRange = {
  operationId: string
  start: TimelineTime
  end: TimelineTime
}

export type PlaybackRange = TimeRange<PlaybackTime>

export interface ComputedClip {
  id: string
  timelineItemId: string
  sourceClipId: string
  trackId: string
  sourceDuration: number
  sourceRange: TimeRange<SourceTime>
  timelineRange: TimeRange<TimelineTime>
  timeMapping: TimelineTimeMapping
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
  time: PlaybackTime
  isPlayable: boolean
}

type EditProjectionOptions = {
  clipDurations?: Record<string, number>
}

interface ProjectedTimelineItem extends TimelineItem {
  ancestorTimelineItemIds: string[]
}

type TimelineItemRanges = {
  timelineStart: TimelineTime
  timelineEnd: TimelineTime
  sourceStart: SourceTime
  sourceEnd: SourceTime
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
    const sourceClip = sourceClipsById.get(timelineItem.sourceId)

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
      time: playbackTime(safeRequestedTime),
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
      time: playbackTime(visibleStart),
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
      time: playbackTime(clippedTime),
      isPlayable: true,
    }
  }

  const playbackProjection = timelineToPlayback(
    timelineTime(clippedTime),
    playbackRanges.map((range) => ({
      start: timelineTime(range.start),
      end: timelineTime(range.end),
    })),
  )

  return playbackProjection.isPlayable
    ? playbackProjection
    : {
        time: playbackTime(visibleEnd),
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
        operation.splitTime <= timelineItem.timelineStart ||
        operation.splitTime >= getTimelineItemEnd(timelineItem)
      ) {
        return [timelineItem]
      }

      return splitTimelineItem(timelineItem, operation)
    })
  }

  return timelineItems
}

function splitTimelineItem(
  timelineItem: ProjectedTimelineItem,
  operation: ReturnType<typeof getSplitOperations>[number],
): ProjectedTimelineItem[] {
  const timelineItemEnd = getTimelineItemEnd(timelineItem)
  const sourceSplitTime = getSourceTimeAtTimelineTime(
    timelineItem,
    operation.splitTime,
  )
  const leftTimelineItem: ProjectedTimelineItem = {
    ...timelineItem,
    id: operation.leftTimelineItemId,
    sourceEnd: sourceSplitTime,
    timelineDuration: operation.splitTime - timelineItem.timelineStart,
    ancestorTimelineItemIds: [
      ...timelineItem.ancestorTimelineItemIds,
      operation.leftTimelineItemId,
    ],
  }
  const rightTimelineItem: ProjectedTimelineItem = {
    ...timelineItem,
    id: operation.rightTimelineItemId,
    sourceStart: sourceSplitTime,
    timelineStart: operation.splitTime,
    timelineDuration: timelineItemEnd - operation.splitTime,
    ancestorTimelineItemIds: [
      ...timelineItem.ancestorTimelineItemIds,
      operation.rightTimelineItemId,
    ],
  }

  return getTimelineItemEnd(leftTimelineItem) === rightTimelineItem.timelineStart &&
    leftTimelineItem.sourceEnd === rightTimelineItem.sourceStart
    ? [leftTimelineItem, rightTimelineItem]
    : [timelineItem]
}

function computeTimelineItemProjection(
  operationIndex: ReturnType<typeof createOperationIndex>,
  timelineItem: ProjectedTimelineItem,
  sourceClip: Clip,
  sourceDuration: number,
): ComputedClip {
  const ancestorTimelineItemIdSet = new Set(timelineItem.ancestorTimelineItemIds)
  const itemRanges = getTimelineItemRanges(timelineItem)
  const trimOperation = operationIndex.trimOperations
    .filter((operation) => ancestorTimelineItemIdSet.has(operation.timelineItemId))
    .at(-1)
  const visibleRange = trimOperation
    ? normalizeSegmentTrimRange(
        trimOperation.trimStart,
        trimOperation.trimEnd,
        {
          start: itemRanges.timelineStart,
          end: itemRanges.timelineEnd,
        },
      )
    : {
        start: itemRanges.timelineStart,
        end: itemRanges.timelineEnd,
      }
  const deletedRanges = timelineItem.ancestorTimelineItemIds
    .flatMap((timelineItemId) => (
      operationIndex.deleteOperationsByTimelineItemId.get(timelineItemId) ?? []
    ))
    .map((operation) => ({
      operationId: operation.id,
      start: timelineTime(Math.max(operation.startTime, visibleRange.start)),
      end: timelineTime(Math.min(operation.endTime, visibleRange.end)),
    }))
    .filter((range) => range.start < range.end)
    .sort((left, right) => left.start - right.start)
  const timeMapping = createTimelineTimeMapping(
    {
      start: itemRanges.sourceStart,
      end: itemRanges.sourceEnd,
    },
    itemRanges.timelineStart,
  )
  const timelineRange = visibleRange
  const sourceRange = timelineRangeToSource(timelineRange, timeMapping)
  const playbackRanges = subtractDeletedRanges(
    timelineRange,
    deletedRanges,
  )

  return {
    id: timelineItem.id,
    timelineItemId: timelineItem.id,
    sourceClipId: sourceClip.id,
    trackId: timelineItem.trackId,
    sourceDuration,
    sourceRange,
    timelineRange,
    timeMapping,
    segmentStart: itemRanges.timelineStart,
    segmentEnd: itemRanges.timelineEnd,
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
  segmentRange: TimeRange<TimelineTime>,
): TimeRange<TimelineTime> {
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
    ? {
        start: timelineTime(start),
        end: timelineTime(end),
      }
    : {
        start: segmentRange.start,
        end: segmentRange.end,
      }
}

function getTimelineItemRanges(timelineItem: TimelineItem): TimelineItemRanges {
  return {
    timelineStart: timelineTime(timelineItem.timelineStart),
    timelineEnd: timelineTime(getTimelineItemEnd(timelineItem)),
    sourceStart: sourceTime(timelineItem.sourceStart),
    sourceEnd: sourceTime(timelineItem.sourceEnd),
  }
}

function getTimelineItemEnd(timelineItem: TimelineItem) {
  return timelineItem.timelineStart + timelineItem.timelineDuration
}

function getSourceTimeAtTimelineTime(
  timelineItem: TimelineItem,
  timeline: number,
) {
  const timelineOffset = timeline - timelineItem.timelineStart
  const timelineDuration = Math.max(timelineItem.timelineDuration, 0)
  const sourceDuration = timelineItem.sourceEnd - timelineItem.sourceStart

  if (timelineDuration <= 0) {
    return timelineItem.sourceStart
  }

  return timelineItem.sourceStart +
    (timelineOffset / timelineDuration) * sourceDuration
}

function getClipSourceDuration(clip: Clip, durationOverride?: number) {
  if (Number.isFinite(durationOverride)) {
    return Math.max(durationOverride ?? 0, 0)
  }

  return Math.max(clip.source.end - clip.source.start, 0)
}

function subtractDeletedRanges(
  visibleRange: TimeRange<TimelineTime>,
  deletedRanges: DeleteRange[],
): PlaybackRange[] {
  const mergedDeletedRanges = mergeRanges(deletedRanges)
  const playbackRanges: PlaybackRange[] = []
  let cursor = visibleRange.start

  for (const range of mergedDeletedRanges) {
    if (range.start > cursor) {
      playbackRanges.push({
        start: playbackTime(cursor),
        end: playbackTime(range.start),
      })
    }
    cursor = timelineTime(Math.max(cursor, range.end))
  }

  if (cursor < visibleRange.end) {
    playbackRanges.push({
      start: playbackTime(cursor),
      end: playbackTime(visibleRange.end),
    })
  }

  return playbackRanges
}

function mergeRanges<TTime extends number, TRange extends TimeRange<TTime>>(
  ranges: TRange[],
): TRange[] {
  const mergedRanges: TRange[] = []

  for (const range of ranges) {
    const previousRange = mergedRanges.at(-1)

    if (!previousRange || range.start > previousRange.end) {
      mergedRanges.push({ ...range })
      continue
    }

    previousRange.end = Math.max(previousRange.end, range.end) as TTime
  }

  return mergedRanges
}
