import type { AISuggestion } from '../../types'

export type TimelineTrackId = 'video' | 'scenes' | 'transcript' | 'ai-suggestions'

export type TimelineItemKind = 'video-preview' | 'scene' | 'transcript' | 'ai-suggestion'

export type TimelineItem = {
  id: string
  trackId: TimelineTrackId
  kind: TimelineItemKind
  start: number
  end: number
  label: string
  title?: string
  thumbnailUrl?: string
  aiSuggestion?: AISuggestion
}

export type TimelineTrack = {
  id: TimelineTrackId
  label: string
  items: TimelineItem[]
  emptyLabel?: string
}
