export type TimelineZoomConfig = Readonly<{
  minimum: number
  maximum: number
  defaultLevel: number
  sliderStep: number
  buttonScaleFactor: number
  wheelSensitivity: number
}>

export type TimelineZoomState = Readonly<{
  level: number
}>

export type TimelineViewportState = Readonly<{
  zoom: TimelineZoomState
}>

export const timelineZoomConfig: TimelineZoomConfig = Object.freeze({
  minimum: 25,
  maximum: 800,
  defaultLevel: 100,
  sliderStep: 5,
  buttonScaleFactor: 1.25,
  wheelSensitivity: 0.002,
})

const ZOOM_PRECISION_FACTOR = 100

export function normalizeTimelineZoom(
  level: number,
  config: TimelineZoomConfig = timelineZoomConfig,
) {
  const finiteLevel = Number.isFinite(level) ? level : config.defaultLevel
  const clampedLevel = Math.min(
    Math.max(finiteLevel, config.minimum),
    config.maximum,
  )

  return Math.round(clampedLevel * ZOOM_PRECISION_FACTOR) /
    ZOOM_PRECISION_FACTOR
}

export function createTimelineZoomState(
  level: number,
  config: TimelineZoomConfig = timelineZoomConfig,
): TimelineZoomState {
  return {
    level: normalizeTimelineZoom(level, config),
  }
}

export function createTimelineViewportState(
  level = timelineZoomConfig.defaultLevel,
): TimelineViewportState {
  return {
    zoom: createTimelineZoomState(level),
  }
}

export function stepTimelineZoom(
  level: number,
  direction: -1 | 1,
  config: TimelineZoomConfig = timelineZoomConfig,
) {
  const factor = direction > 0
    ? config.buttonScaleFactor
    : 1 / config.buttonScaleFactor
  const scaledLevel = level * factor
  const steppedLevel =
    Math.round(scaledLevel / config.sliderStep) * config.sliderStep

  return normalizeTimelineZoom(steppedLevel, config)
}

export function zoomTimelineFromWheel(
  level: number,
  deltaY: number,
  config: TimelineZoomConfig = timelineZoomConfig,
) {
  const scaledLevel = level * Math.exp(-deltaY * config.wheelSensitivity)

  return normalizeTimelineZoom(scaledLevel, config)
}
