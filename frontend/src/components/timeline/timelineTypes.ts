export type TimelineTrackId = 'video' | 'scenes' | 'transcript'

export type TimelineItemKind = 'video-preview' | 'scene' | 'transcript'

export type TimelineItem = {
  id: string
  trackId: TimelineTrackId
  kind: TimelineItemKind
  start: number
  end: number
  label: string
  title?: string
  thumbnailUrl?: string
}

export type TimelineTrack = {
  id: TimelineTrackId
  label: string
  items: TimelineItem[]
  emptyLabel?: string
}
