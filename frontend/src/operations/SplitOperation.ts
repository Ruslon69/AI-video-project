import type { SplitOperation } from '../models/EditOperation'
import {
  timelineTime,
  type TimelineTime,
  type TimeRange,
} from '../models/Time'
import type { TimelineItem } from '../models/Track'

const SPLIT_BOUNDARY_EPSILON_SECONDS = 0.000001

export type SplitOperationIds = {
  operationId: string
  leftTimelineItemId: string
  rightTimelineItemId: string
}

export type SplitOperationTarget = {
  timelineItemId: string
  timelineRange: TimeRange<TimelineTime>
}

export function isValidSplitPoint(
  timelineRange: TimeRange<TimelineTime>,
  splitTime: number,
) {
  return Number.isFinite(splitTime) &&
    splitTime - timelineRange.start > SPLIT_BOUNDARY_EPSILON_SECONDS &&
    timelineRange.end - splitTime > SPLIT_BOUNDARY_EPSILON_SECONDS
}

export function createSplitOperation(
  target: SplitOperationTarget,
  splitTime: number,
  ids: SplitOperationIds,
  createdAt: string,
): SplitOperation | null {
  if (
    !target.timelineItemId ||
    !isValidSplitPoint(target.timelineRange, splitTime) ||
    !ids.operationId ||
    !ids.leftTimelineItemId ||
    !ids.rightTimelineItemId ||
    ids.leftTimelineItemId === ids.rightTimelineItemId
  ) {
    return null
  }

  return {
    id: ids.operationId,
    type: 'split',
    timelineItemId: target.timelineItemId,
    splitTime,
    leftTimelineItemId: ids.leftTimelineItemId,
    rightTimelineItemId: ids.rightTimelineItemId,
    createdAt,
  }
}

export function splitTimelineItem(
  timelineItem: TimelineItem,
  operation: SplitOperation,
): [TimelineItem, TimelineItem] | null {
  const timelineEnd = getTimelineItemEnd(timelineItem)
  const timelineRange = {
    start: timelineTime(timelineItem.timelineStart),
    end: timelineTime(timelineEnd),
  }

  if (
    timelineItem.id !== operation.timelineItemId ||
    !isValidSplitPoint(timelineRange, operation.splitTime) ||
    operation.leftTimelineItemId === operation.rightTimelineItemId
  ) {
    return null
  }

  const sourceSplitTime = getSourceTimeAtTimelineTime(
    timelineItem,
    operation.splitTime,
  )
  const leftTimelineItem: TimelineItem = {
    ...timelineItem,
    id: operation.leftTimelineItemId,
    sourceEnd: sourceSplitTime,
    timelineDuration: operation.splitTime - timelineItem.timelineStart,
  }
  const rightTimelineItem: TimelineItem = {
    ...timelineItem,
    id: operation.rightTimelineItemId,
    sourceStart: sourceSplitTime,
    timelineStart: operation.splitTime,
    timelineDuration: timelineEnd - operation.splitTime,
  }

  return [leftTimelineItem, rightTimelineItem]
}

function getTimelineItemEnd(timelineItem: TimelineItem) {
  return timelineItem.timelineStart + timelineItem.timelineDuration
}

function getSourceTimeAtTimelineTime(
  timelineItem: TimelineItem,
  timeline: number,
) {
  const timelineOffset = timeline - timelineItem.timelineStart
  const sourceDuration = timelineItem.sourceEnd - timelineItem.sourceStart

  return timelineItem.sourceStart +
    (timelineOffset / timelineItem.timelineDuration) * sourceDuration
}
