import type { Clip } from './Clip'

export type TrackType = 'video' | 'audio' | 'text' | 'effect'

export interface TimelineItem {
  id: string
  sourceClipId: string
  trackId: string
  start: number
  end: number
}

export interface Track {
  id: string
  type: TrackType
  name: string
  clips: Clip[]
  locked: boolean
  muted: boolean
  visible: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export interface Timeline {
  id: string
  name: string
  duration: number
  items: TimelineItem[]
  tracks: Track[]
  createdAt: string
  updatedAt: string
}
