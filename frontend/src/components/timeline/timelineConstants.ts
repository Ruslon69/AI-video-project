export const KEYBOARD_SEEK_SECONDS = 5
export const SNAP_ENTER_THRESHOLD_PIXELS = 8
export const SNAP_RELEASE_THRESHOLD_PIXELS = 14
export const SNAP_SWITCH_MARGIN_PIXELS = 2
export const TIMELINE_ZOOM_OPTIONS = [50, 100, 150, 200] as const
export const BASE_PIXELS_PER_SECOND = 8

export type TimelineZoom = (typeof TIMELINE_ZOOM_OPTIONS)[number]
