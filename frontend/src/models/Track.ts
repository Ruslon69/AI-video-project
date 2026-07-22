import type { Clip } from './Clip'

export type TrackType = 'video' | 'audio' | 'text' | 'effect'

export interface TimelineItem {
  id: string
  trackId: string
  sourceId: string
  sourceStart: number
  sourceEnd: number
  timelineStart: number
  timelineDuration: number
  locked?: boolean
  muted?: boolean
  visible?: boolean
  reviewId?: string
  groupId?: string
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
