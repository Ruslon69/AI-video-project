import type { Clip } from '../models/Clip'
import type { EditOperation } from '../models/EditOperation'
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
  isValidSplitPoint,
  splitTimelineItem,
} from '../operations/SplitOperation'
import { createTimelineItemFromAddOperation } from '../operations/AddTimelineItemOperation'
import {
  normalizeRippleTimelineTime,
  RIPPLE_TIME_TOLERANCE_SECONDS,
  shiftRippleTimelineTime,
} from '../operations/RippleDeleteOperation'
import {
  getDeleteOperations,
  getTrimOperations,
  normalizeTrimRange,
} from './editSelectors'
import {
  createTimelineTimeMapping,
  timelineRangeToSource,
  timelineToPlayback,
  type TimelineTimeMapping,
} from './timeMapping'
import { getPrimaryProjectMediaBinding } from '../state/ProjectMedia'

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
  locked: boolean
  visible: boolean
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
  ancestorTimelineRangesById: Record<string, TimeRange<TimelineTime>>
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
  const primarySourceClipId =
    getPrimaryProjectMediaBinding(project)?.sourceClip.id ?? null
  const operationIndex = createOperationIndex(project)
  const sourceClipsById = new Map(
    project.timeline.tracks
      .flatMap((track) => track.clips)
      .map((clip) => [clip.id, clip]),
  )
  const timelineItems = buildProjectedTimelineItems(
    project.timeline.items.filter(
      (timelineItem) => timelineItem.sourceId === primarySourceClipId,
    ),
    project.operations,
    primarySourceClipId,
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

export function canSplitComputedClipAtTime(
  computedClip: ComputedClip,
  splitTime: number,
) {
  return isValidSplitPoint(computedClip.timelineRange, splitTime)
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
  const trimOperations = getTrimOperations(project)

  for (const operation of getDeleteOperations(project)) {
    const operations = deleteOperationsByTimelineItemId.get(operation.timelineItemId) ?? []

    operations.push(operation)
    deleteOperationsByTimelineItemId.set(operation.timelineItemId, operations)
  }

  return {
    deleteOperationsByTimelineItemId,
    trimOperations,
  }
}

function buildProjectedTimelineItems(
  initialTimelineItems: TimelineItem[],
  operations: EditOperation[],
  primarySourceClipId: string | null,
): ProjectedTimelineItem[] {
  let timelineItems: ProjectedTimelineItem[] = initialTimelineItems.map(
    createProjectedTimelineItem,
  )

  for (const operation of operations) {
    if (operation.type === 'add-timeline-item') {
      if (operation.timelineItem.sourceId !== primarySourceClipId) {
        continue
      }

      const addedTimelineItem = createTimelineItemFromAddOperation(
        timelineItems,
        operation,
      )

      if (addedTimelineItem) {
        timelineItems = [
          ...timelineItems,
          createProjectedTimelineItem(addedTimelineItem),
        ]
      }
    }

    if (operation.type === 'move') {
      timelineItems = timelineItems.map((timelineItem) =>
        timelineItem.id === operation.timelineItemId
          ? moveTimelineItem(timelineItem, operation.timelineStart)
          : timelineItem,
      )
    }

    if (operation.type === 'split') {
      timelineItems = timelineItems.flatMap((timelineItem) => {
        const splitItems = splitTimelineItem(timelineItem, operation)

        if (!splitItems) {
          return [timelineItem]
        }

        const [leftTimelineItem, rightTimelineItem] = splitItems

        return [
          addSplitAncestry(
            timelineItem,
            leftTimelineItem,
            leftTimelineItem.timelineStart,
            operation.splitTime,
          ),
          addSplitAncestry(
            timelineItem,
            rightTimelineItem,
            operation.splitTime,
            getTimelineItemEnd(rightTimelineItem),
          ),
        ]
      })
    }

    if (operation.type === 'ripple-delete') {
      timelineItems = applyRippleDeleteOperation(
        timelineItems,
        operation,
      )
    }
  }

  return timelineItems
}

function createProjectedTimelineItem(
  timelineItem: TimelineItem,
): ProjectedTimelineItem {
  return {
    ...timelineItem,
    ancestorTimelineItemIds: [timelineItem.id],
    ancestorTimelineRangesById: {
      [timelineItem.id]: {
        start: timelineTime(timelineItem.timelineStart),
        end: timelineTime(getTimelineItemEnd(timelineItem)),
      },
    },
  }
}

function moveTimelineItem(
  timelineItem: ProjectedTimelineItem,
  timelineStart: number,
): ProjectedTimelineItem {
  const safeTimelineStart = Number.isFinite(timelineStart)
    ? Math.max(timelineStart, 0)
    : timelineItem.timelineStart

  return {
    ...timelineItem,
    timelineStart: safeTimelineStart,
    ancestorTimelineRangesById: {
      ...timelineItem.ancestorTimelineRangesById,
      [timelineItem.id]: {
        start: timelineTime(safeTimelineStart),
        end: timelineTime(safeTimelineStart + timelineItem.timelineDuration),
      },
    },
  }
}

function addSplitAncestry(
  parentTimelineItem: ProjectedTimelineItem,
  childTimelineItem: TimelineItem,
  timelineStart: number,
  timelineEnd: number,
): ProjectedTimelineItem {
  return {
    ...childTimelineItem,
    ancestorTimelineItemIds: [
      ...parentTimelineItem.ancestorTimelineItemIds,
      childTimelineItem.id,
    ],
    ancestorTimelineRangesById: {
      ...parentTimelineItem.ancestorTimelineRangesById,
      [childTimelineItem.id]: {
        start: timelineTime(timelineStart),
        end: timelineTime(timelineEnd),
      },
    },
  }
}

function applyRippleDeleteOperation(
  timelineItems: ProjectedTimelineItem[],
  operation: Extract<EditOperation, { type: 'ripple-delete' }>,
): ProjectedTimelineItem[] {
  const targetTimelineItem = timelineItems.find(
    (timelineItem) => timelineItem.id === operation.timelineItemId,
  )
  const shiftedTimelineItemIdSet = new Set(
    operation.shiftedTimelineItemIds,
  )
  const shiftedTimelineItems = timelineItems.filter((timelineItem) =>
    shiftedTimelineItemIdSet.has(timelineItem.id),
  )
  const hasValidReplayTarget =
    Boolean(targetTimelineItem) &&
    targetTimelineItem?.trackId === operation.trackId &&
    Number.isFinite(operation.shiftDuration) &&
    operation.shiftDuration > RIPPLE_TIME_TOLERANCE_SECONDS &&
    shiftedTimelineItems.length === shiftedTimelineItemIdSet.size &&
    shiftedTimelineItems.every(
      (timelineItem) => timelineItem.trackId === operation.trackId,
    )

  if (!hasValidReplayTarget) {
    return timelineItems
  }

  return timelineItems
    .filter((timelineItem) => timelineItem.id !== operation.timelineItemId)
    .map((timelineItem) =>
      shiftedTimelineItemIdSet.has(timelineItem.id)
        ? shiftTimelineItemForRipple(
            timelineItem,
            operation.shiftDuration,
          )
        : timelineItem,
    )
}

function shiftTimelineItemForRipple(
  timelineItem: ProjectedTimelineItem,
  shiftDuration: number,
): ProjectedTimelineItem {
  return {
    ...timelineItem,
    timelineStart: shiftRippleTimelineTime(
      timelineItem.timelineStart,
      shiftDuration,
    ),
    ancestorTimelineRangesById: Object.fromEntries(
      Object.entries(timelineItem.ancestorTimelineRangesById)
        .map(([timelineItemId, timelineRange]) => [
          timelineItemId,
          {
            start: timelineTime(
              shiftRippleTimelineTime(
                timelineRange.start,
                shiftDuration,
              ),
            ),
            end: timelineTime(
              shiftRippleTimelineTime(
                timelineRange.end,
                shiftDuration,
              ),
            ),
          },
        ]),
    ),
  }
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
  const requestedVisibleRange = trimOperation
    ? getTimelineRangeFromRelativeRange(
        trimOperation.relativeStart,
        trimOperation.relativeEnd,
        getOperationTargetRange(timelineItem, trimOperation.timelineItemId),
      )
    : {
        start: itemRanges.timelineStart,
        end: itemRanges.timelineEnd,
      }
  const visibleRange = intersectTimelineRanges(
    requestedVisibleRange,
    {
      start: itemRanges.timelineStart,
      end: itemRanges.timelineEnd,
    },
  )
  const deletedRanges = timelineItem.ancestorTimelineItemIds
    .flatMap((timelineItemId) => (
      operationIndex.deleteOperationsByTimelineItemId.get(timelineItemId) ?? []
    ))
    .map((operation) => ({
      operationId: operation.id,
      ...getTimelineRangeFromRelativeRange(
        operation.relativeStart,
        operation.relativeEnd,
        getOperationTargetRange(timelineItem, operation.timelineItemId),
      ),
    }))
    .map((range) => ({
      operationId: range.operationId,
      start: timelineTime(Math.max(range.start, visibleRange.start)),
      end: timelineTime(Math.min(range.end, visibleRange.end)),
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
    locked: timelineItem.locked ?? false,
    visible: timelineItem.visible ?? true,
    deletedRanges,
    playbackRanges,
  }
}

function getTimelineRangeFromRelativeRange(
  relativeStart: number,
  relativeEnd: number,
  timelineRange: TimeRange<TimelineTime>,
): TimeRange<TimelineTime> {
  const itemDuration = timelineRange.end - timelineRange.start
  const trimRange = normalizeTrimRange(
    relativeStart,
    relativeEnd,
    itemDuration,
  )
  const start = timelineRange.start + trimRange.trimStart
  const end = timelineRange.start + trimRange.trimEnd

  return start < end
    ? {
        start: timelineTime(start),
        end: timelineTime(end),
      }
    : {
        start: timelineRange.start,
        end: timelineRange.end,
      }
}

function intersectTimelineRanges(
  left: TimeRange<TimelineTime>,
  right: TimeRange<TimelineTime>,
): TimeRange<TimelineTime> {
  const start = Math.max(left.start, right.start)

  return {
    start: timelineTime(start),
    end: timelineTime(Math.max(start, Math.min(left.end, right.end))),
  }
}

function getOperationTargetRange(
  timelineItem: ProjectedTimelineItem,
  timelineItemId: string,
): TimeRange<TimelineTime> {
  return timelineItem.ancestorTimelineRangesById[timelineItemId] ?? {
    start: timelineTime(timelineItem.timelineStart),
    end: timelineTime(getTimelineItemEnd(timelineItem)),
  }
}

function getTimelineItemRanges(timelineItem: TimelineItem): TimelineItemRanges {
  return {
    timelineStart: timelineTime(
      normalizeRippleTimelineTime(timelineItem.timelineStart),
    ),
    timelineEnd: timelineTime(
      normalizeRippleTimelineTime(getTimelineItemEnd(timelineItem)),
    ),
    sourceStart: sourceTime(timelineItem.sourceStart),
    sourceEnd: sourceTime(timelineItem.sourceEnd),
  }
}

function getTimelineItemEnd(timelineItem: TimelineItem) {
  return timelineItem.timelineStart + timelineItem.timelineDuration
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
