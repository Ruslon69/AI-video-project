import { timelineTime } from '../models/Time'
import type { ComputedClip } from '../selectors/editProjection'
import { timelineToSource } from '../selectors/timeMapping'
import type {
  PlaybackTimeline,
  ResolvedPlaybackFrame,
} from './PlaybackEngine'

type PlaybackSegment = Readonly<{
  timelineStart: number
  timelineEnd: number
  mediaStart: number
  mediaEnd: number
}>

export function createPlaybackTimeline(
  computedClips: ComputedClip[],
  fallbackDuration: number,
): PlaybackTimeline {
  const segments = computedClips
    .flatMap((clip) =>
      clip.playbackRanges.map((range) => ({
        timelineStart: range.start,
        timelineEnd: range.end,
        mediaStart: timelineToSource(
          timelineTime(range.start),
          clip.timeMapping,
        ),
        mediaEnd: timelineToSource(
          timelineTime(range.end),
          clip.timeMapping,
        ),
      })),
    )
    .filter((segment) => segment.timelineEnd > segment.timelineStart)
    .sort((left, right) => left.timelineStart - right.timelineStart)

  if (!computedClips.length) {
    return createIdentityTimeline(fallbackDuration)
  }

  const duration = Math.max(
    segments.at(-1)?.timelineEnd ?? 0,
    ...computedClips.map((clip) => clip.visibleEnd),
    0,
  )

  return {
    startTime: segments[0]?.timelineStart ?? 0,
    duration,
    hasPlayableContent: segments.length > 0,
    resolve: (requestedTime) =>
      resolvePlaybackFrame(segments, requestedTime, duration),
  }
}

function createIdentityTimeline(duration: number): PlaybackTimeline {
  const safeDuration = Number.isFinite(duration)
    ? Math.max(duration, 0)
    : 0

  return {
    startTime: 0,
    duration: safeDuration,
    hasPlayableContent: safeDuration > 0,
    resolve: (requestedTime) => {
      const timelineTime = clampTime(requestedTime, safeDuration)

      return {
        timelineTime,
        mediaTime: timelineTime,
        isPlayable: timelineTime < safeDuration,
      }
    },
  }
}

function resolvePlaybackFrame(
  segments: PlaybackSegment[],
  requestedTime: number,
  duration: number,
): ResolvedPlaybackFrame {
  const timelineTime = clampTime(requestedTime, duration)
  const activeSegment = segments.find(
    (segment) =>
      timelineTime >= segment.timelineStart &&
      timelineTime < segment.timelineEnd,
  )

  if (activeSegment) {
    return {
      timelineTime,
      mediaTime:
        activeSegment.mediaStart +
        timelineTime -
        activeSegment.timelineStart,
      isPlayable: true,
    }
  }

  const nextSegment = segments.find(
    (segment) => segment.timelineStart > timelineTime,
  )

  if (nextSegment) {
    return {
      timelineTime: nextSegment.timelineStart,
      mediaTime: nextSegment.mediaStart,
      isPlayable: true,
    }
  }

  const finalSegment = segments.at(-1)

  return {
    timelineTime,
    mediaTime: finalSegment?.mediaEnd ?? 0,
    isPlayable: false,
  }
}

function clampTime(value: number, duration: number) {
  const finiteValue = Number.isFinite(value) ? value : 0

  return Math.min(Math.max(finiteValue, 0), duration)
}
