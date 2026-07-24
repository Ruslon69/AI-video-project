import {
  normalizeTimelineZoom,
  timelineZoomConfig,
  type TimelineZoomConfig,
  type TimelineZoomState,
} from './TimelineViewportState'

export type TimelineScaleConfig = Readonly<{
  basePixelsPerSecond: number
  minimumContentWidth: number
  endPaddingViewportCount: number
  zoom: TimelineZoomConfig
}>

export type TimelineViewportMetrics = Readonly<{
  scrollLeft: number
  width: number
}>

export type TimelineScale = Readonly<{
  duration: number
  zoom: TimelineZoomState
  pixelsPerSecond: number
  contentWidth: number
  endPaddingViewportCount: number
  timeToTimelineX: (timestamp: number) => number
  timelineXToTime: (coordinate: number) => number
  durationToPixels: (duration: number) => number
  pixelsToDuration: (pixels: number) => number
  timeToViewportX: (
    timestamp: number,
    viewport: TimelineViewportMetrics,
  ) => number
  viewportXToTime: (
    coordinate: number,
    viewport: TimelineViewportMetrics,
  ) => number
  clampScrollLeft: (scrollLeft: number, viewportWidth: number) => number
  scrollLeftForAnchor: (
    timestamp: number,
    viewportCoordinate: number,
    viewportWidth: number,
  ) => number
}>

export type TimelineGeometry = TimelineScale

export const timelineScaleConfig: TimelineScaleConfig = Object.freeze({
  basePixelsPerSecond: 8,
  minimumContentWidth: 1,
  endPaddingViewportCount: 1,
  zoom: timelineZoomConfig,
})

export function createTimelineScale(
  duration: number,
  zoom: TimelineZoomState,
  config: TimelineScaleConfig = timelineScaleConfig,
): TimelineScale {
  const safeDuration = Number.isFinite(duration) ? Math.max(duration, 0) : 0
  const safeZoom = {
    level: normalizeTimelineZoom(zoom.level, config.zoom),
  }
  const pixelsPerSecond =
    config.basePixelsPerSecond * (safeZoom.level / 100)
  const contentWidth = Math.max(
    safeDuration * pixelsPerSecond,
    config.minimumContentWidth,
  )
  const durationToPixels = (timeDuration: number) =>
    timeDuration * pixelsPerSecond
  const pixelsToDuration = (pixels: number) => pixels / pixelsPerSecond
  const timeToTimelineX = (timestamp: number) =>
    Math.min(
      Math.max(durationToPixels(Number.isFinite(timestamp) ? timestamp : 0), 0),
      contentWidth,
    )
  const timelineXToTime = (coordinate: number) =>
    Math.min(
      Math.max(pixelsToDuration(Number.isFinite(coordinate) ? coordinate : 0), 0),
      safeDuration,
    )
  const clampScrollLeft = (scrollLeft: number, viewportWidth: number) => {
    const safeViewportWidth = Number.isFinite(viewportWidth)
      ? Math.max(viewportWidth, 0)
      : 0
    const scrollableWidth = contentWidth +
      safeViewportWidth * config.endPaddingViewportCount
    const maximumScrollLeft = Math.max(scrollableWidth - safeViewportWidth, 0)
    const safeScrollLeft = Number.isFinite(scrollLeft) ? scrollLeft : 0

    return Math.min(Math.max(safeScrollLeft, 0), maximumScrollLeft)
  }

  return {
    duration: safeDuration,
    zoom: safeZoom,
    pixelsPerSecond,
    contentWidth,
    endPaddingViewportCount: config.endPaddingViewportCount,
    timeToTimelineX,
    timelineXToTime,
    durationToPixels,
    pixelsToDuration,
    timeToViewportX: (timestamp, viewport) =>
      timeToTimelineX(timestamp) - viewport.scrollLeft,
    viewportXToTime: (coordinate, viewport) =>
      timelineXToTime(viewport.scrollLeft + coordinate),
    clampScrollLeft,
    scrollLeftForAnchor: (timestamp, viewportCoordinate, viewportWidth) =>
      clampScrollLeft(
        timeToTimelineX(timestamp) - viewportCoordinate,
        viewportWidth,
      ),
  }
}

export const createTimelineGeometry = createTimelineScale
