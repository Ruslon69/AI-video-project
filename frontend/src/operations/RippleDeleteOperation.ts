import type { RippleDeleteOperation } from '../models/EditOperation'
import {
  timelineTime,
  type TimelineTime,
  type TimeRange,
} from '../models/Time'
import type { TrackType } from '../models/Track'

export const RIPPLE_TIME_TOLERANCE_SECONDS = 0.0001

const RIPPLE_TIME_PRECISION_DECIMALS = 4

export type RippleDeleteClipSnapshot = {
  timelineItemId: string
  trackId: string
  timelineRange: TimeRange<TimelineTime>
  locked: boolean
  visible: boolean
}

export type RippleDeleteTrackSnapshot = {
  id: string
  type: TrackType
  locked: boolean
  visible: boolean
}

export type RippleDeletePlan = {
  timelineItemId: string
  trackId: string
  removedTimelineStart: TimelineTime
  removedTimelineEnd: TimelineTime
  shiftDuration: number
  shiftedTimelineItemIds: string[]
  selectionAfterTimelineItemId: string | null
}

export type RippleDeleteRejectionReason =
  | 'missing-target'
  | 'missing-track'
  | 'unsupported-track'
  | 'locked-track'
  | 'hidden-track'
  | 'locked-target'
  | 'hidden-target'
  | 'invalid-duration'
  | 'invalid-track-clip'
  | 'locked-shift-target'
  | 'hidden-shift-target'
  | 'resulting-overlap'

export type RippleDeleteValidation =
  | {
      valid: true
      plan: RippleDeletePlan
    }
  | {
      valid: false
      reason: RippleDeleteRejectionReason
    }

type CreateRippleDeleteOperationOptions = {
  operationId: string
  createdAt: string
  selectionBeforeTimelineItemId: string | null
  playheadTime: number
}

export function validateRippleDelete(
  timelineItemId: string | null,
  track: RippleDeleteTrackSnapshot | null,
  clips: RippleDeleteClipSnapshot[],
): RippleDeleteValidation {
  const target = timelineItemId
    ? clips.find((clip) => clip.timelineItemId === timelineItemId)
    : null

  if (!target) {
    return rejectRippleDelete('missing-target')
  }

  if (!track || track.id !== target.trackId) {
    return rejectRippleDelete('missing-track')
  }

  if (track.type !== 'video') {
    return rejectRippleDelete('unsupported-track')
  }

  if (track.locked) {
    return rejectRippleDelete('locked-track')
  }

  if (!track.visible) {
    return rejectRippleDelete('hidden-track')
  }

  if (target.locked) {
    return rejectRippleDelete('locked-target')
  }

  if (!target.visible) {
    return rejectRippleDelete('hidden-target')
  }

  const sameTrackClips = clips.filter((clip) => clip.trackId === target.trackId)

  if (sameTrackClips.some((clip) => !isValidTimelineRange(clip.timelineRange))) {
    return rejectRippleDelete('invalid-track-clip')
  }

  const removedTimelineStart = normalizeRippleTimelineTime(
    target.timelineRange.start,
  )
  const removedTimelineEnd = normalizeRippleTimelineTime(
    target.timelineRange.end,
  )
  const shiftDuration = normalizeRippleTimelineTime(
    removedTimelineEnd - removedTimelineStart,
  )

  if (shiftDuration <= RIPPLE_TIME_TOLERANCE_SECONDS) {
    return rejectRippleDelete('invalid-duration')
  }

  const shiftedClips = sameTrackClips
    .filter((clip) => clip.timelineItemId !== target.timelineItemId)
    .filter(
      (clip) =>
        normalizeRippleTimelineTime(clip.timelineRange.start) >=
        removedTimelineEnd,
    )
    .sort(compareClipTimelinePosition)

  if (shiftedClips.some((clip) => clip.locked)) {
    return rejectRippleDelete('locked-shift-target')
  }

  if (shiftedClips.some((clip) => !clip.visible)) {
    return rejectRippleDelete('hidden-shift-target')
  }

  const shiftedTimelineItemIdSet = new Set(
    shiftedClips.map((clip) => clip.timelineItemId),
  )
  const resultingClips = sameTrackClips
    .filter((clip) => clip.timelineItemId !== target.timelineItemId)
    .map((clip) => {
      const shouldShift = shiftedTimelineItemIdSet.has(clip.timelineItemId)

      return {
        ...clip,
        timelineRange: shouldShift
          ? {
              start: timelineTime(
                shiftRippleTimelineTime(
                  clip.timelineRange.start,
                  shiftDuration,
                ),
              ),
              end: timelineTime(
                shiftRippleTimelineTime(
                  clip.timelineRange.end,
                  shiftDuration,
                ),
              ),
            }
          : clip.timelineRange,
      }
    })
    .sort(compareClipTimelinePosition)

  if (hasTimelineOverlap(resultingClips)) {
    return rejectRippleDelete('resulting-overlap')
  }

  const previousClip = sameTrackClips
    .filter((clip) => clip.timelineItemId !== target.timelineItemId)
    .filter(
      (clip) =>
        normalizeRippleTimelineTime(clip.timelineRange.end) <=
        removedTimelineStart,
    )
    .sort(comparePreviousClipPosition)
    .at(0)

  return {
    valid: true,
    plan: {
      timelineItemId: target.timelineItemId,
      trackId: target.trackId,
      removedTimelineStart: timelineTime(removedTimelineStart),
      removedTimelineEnd: timelineTime(removedTimelineEnd),
      shiftDuration,
      shiftedTimelineItemIds: shiftedClips.map(
        (clip) => clip.timelineItemId,
      ),
      selectionAfterTimelineItemId:
        shiftedClips[0]?.timelineItemId ??
        previousClip?.timelineItemId ??
        null,
    },
  }
}

export function createRippleDeleteOperation(
  plan: RippleDeletePlan,
  options: CreateRippleDeleteOperationOptions,
): RippleDeleteOperation | null {
  if (!options.operationId || !Number.isFinite(options.playheadTime)) {
    return null
  }

  const playheadBefore = normalizeRippleTimelineTime(
    Math.max(options.playheadTime, 0),
  )
  const playheadAfter = remapRippleDeletePlayhead(
    playheadBefore,
    plan,
  )

  return {
    id: options.operationId,
    type: 'ripple-delete',
    timelineItemId: plan.timelineItemId,
    trackId: plan.trackId,
    removedTimelineStart: plan.removedTimelineStart,
    removedTimelineEnd: plan.removedTimelineEnd,
    shiftDuration: plan.shiftDuration,
    shiftedTimelineItemIds: [...plan.shiftedTimelineItemIds],
    selectionBeforeTimelineItemId: options.selectionBeforeTimelineItemId,
    selectionAfterTimelineItemId: plan.selectionAfterTimelineItemId,
    playheadBefore,
    playheadAfter,
    createdAt: options.createdAt,
  }
}

export function remapRippleDeletePlayhead(
  currentTime: number,
  plan: {
    removedTimelineStart: number
    removedTimelineEnd: number
    shiftDuration: number
  },
) {
  const normalizedTime = normalizeRippleTimelineTime(
    Math.max(Number.isFinite(currentTime) ? currentTime : 0, 0),
  )

  if (normalizedTime < plan.removedTimelineStart) {
    return normalizedTime
  }

  if (normalizedTime <= plan.removedTimelineEnd) {
    return plan.removedTimelineStart
  }

  return Math.max(
    shiftRippleTimelineTime(normalizedTime, plan.shiftDuration),
    0,
  )
}

export function shiftRippleTimelineTime(
  timeline: number,
  shiftDuration: number,
) {
  return normalizeRippleTimelineTime(timeline - shiftDuration)
}

export function normalizeRippleTimelineTime(timeline: number) {
  return Number(timeline.toFixed(RIPPLE_TIME_PRECISION_DECIMALS))
}

function rejectRippleDelete(
  reason: RippleDeleteRejectionReason,
): RippleDeleteValidation {
  return {
    valid: false,
    reason,
  }
}

function isValidTimelineRange(timelineRange: TimeRange<TimelineTime>) {
  return Number.isFinite(timelineRange.start) &&
    Number.isFinite(timelineRange.end) &&
    timelineRange.start >= -RIPPLE_TIME_TOLERANCE_SECONDS &&
    timelineRange.end - timelineRange.start >
      RIPPLE_TIME_TOLERANCE_SECONDS
}

function compareClipTimelinePosition(
  left: RippleDeleteClipSnapshot,
  right: RippleDeleteClipSnapshot,
) {
  return left.timelineRange.start - right.timelineRange.start ||
    left.timelineRange.end - right.timelineRange.end ||
    left.timelineItemId.localeCompare(right.timelineItemId)
}

function comparePreviousClipPosition(
  left: RippleDeleteClipSnapshot,
  right: RippleDeleteClipSnapshot,
) {
  return right.timelineRange.end - left.timelineRange.end ||
    right.timelineRange.start - left.timelineRange.start ||
    left.timelineItemId.localeCompare(right.timelineItemId)
}

function hasTimelineOverlap(clips: RippleDeleteClipSnapshot[]) {
  for (let index = 1; index < clips.length; index += 1) {
    const previousClip = clips[index - 1]
    const clip = clips[index]

    if (
      clip.timelineRange.start <
      previousClip.timelineRange.end - RIPPLE_TIME_TOLERANCE_SECONDS
    ) {
      return true
    }
  }

  return false
}
