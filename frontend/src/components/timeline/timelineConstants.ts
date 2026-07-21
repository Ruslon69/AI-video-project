export const KEYBOARD_SEEK_SECONDS = 5
export const TIMELINE_ZOOM_OPTIONS = [50, 100, 150, 200] as const
export const BASE_PIXELS_PER_SECOND = 8

export type TimelineZoom = (typeof TIMELINE_ZOOM_OPTIONS)[number]
