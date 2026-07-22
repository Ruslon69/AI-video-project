type TimeBrand<TName extends string> = number & {
  readonly __timeCoordinate: TName
}

export type SourceTime = TimeBrand<'source'>
export type TimelineTime = TimeBrand<'timeline'>
export type PlaybackTime = TimeBrand<'playback'>

export interface TimeRange<TTime extends number> {
  start: TTime
  end: TTime
}

export function sourceTime(value: number): SourceTime {
  return value as SourceTime
}

export function timelineTime(value: number): TimelineTime {
  return value as TimelineTime
}

export function playbackTime(value: number): PlaybackTime {
  return value as PlaybackTime
}

export function timeSeconds(value: number) {
  return value
}
