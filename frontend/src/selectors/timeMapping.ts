import {
  playbackTime,
  sourceTime,
  timelineTime,
  timeSeconds,
  type PlaybackTime,
  type SourceTime,
  type TimelineTime,
  type TimeRange,
} from '../models/Time'

export interface TimelineTimeMapping {
  sourceRange: TimeRange<SourceTime>
  timelineRange: TimeRange<TimelineTime>
}

export function createTimelineTimeMapping(
  sourceRange: TimeRange<SourceTime>,
  timelineStart: TimelineTime,
): TimelineTimeMapping {
  return {
    sourceRange,
    timelineRange: {
      start: timelineStart,
      end: timelineTime(
        timeSeconds(timelineStart) +
          timeSeconds(sourceRange.end) -
          timeSeconds(sourceRange.start),
      ),
    },
  }
}

export function sourceToTimeline(
  source: SourceTime,
  mapping: TimelineTimeMapping,
): TimelineTime {
  return timelineTime(
    timeSeconds(mapping.timelineRange.start) +
      timeSeconds(source) -
      timeSeconds(mapping.sourceRange.start),
  )
}

export function timelineToSource(
  timeline: TimelineTime,
  mapping: TimelineTimeMapping,
): SourceTime {
  return sourceTime(
    timeSeconds(mapping.sourceRange.start) +
      timeSeconds(timeline) -
      timeSeconds(mapping.timelineRange.start),
  )
}

export function sourceRangeToTimeline(
  range: TimeRange<SourceTime>,
  mapping: TimelineTimeMapping,
): TimeRange<TimelineTime> {
  return {
    start: sourceToTimeline(range.start, mapping),
    end: sourceToTimeline(range.end, mapping),
  }
}

export function timelineRangeToSource(
  range: TimeRange<TimelineTime>,
  mapping: TimelineTimeMapping,
): TimeRange<SourceTime> {
  return {
    start: timelineToSource(range.start, mapping),
    end: timelineToSource(range.end, mapping),
  }
}

export function timelineToPlayback(
  timeline: TimelineTime,
  playableTimelineRanges: TimeRange<TimelineTime>[],
): {
  time: PlaybackTime
  isPlayable: boolean
} {
  const activeRange = playableTimelineRanges.find(
    (range) => timeline >= range.start && timeline < range.end,
  )

  if (activeRange) {
    return {
      time: playbackTime(timeline),
      isPlayable: true,
    }
  }

  const nextRange = playableTimelineRanges.find(
    (range) => range.start > timeline,
  )

  return nextRange
    ? {
        time: playbackTime(nextRange.start),
        isPlayable: true,
      }
    : {
        time: playbackTime(timeline),
        isPlayable: false,
      }
}

export function playbackToTimeline(playback: PlaybackTime): TimelineTime {
  return timelineTime(playback)
}
