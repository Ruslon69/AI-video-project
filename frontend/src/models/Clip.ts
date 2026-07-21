export interface ClipSourceRange {
  start: number
  end: number
}

export interface ClipTimelineRange {
  start: number
  end: number
}

export interface Clip {
  id: string
  assetId: string
  trackId: string
  name: string
  source: ClipSourceRange
  timeline: ClipTimelineRange
  playbackRate: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface VideoClip extends Clip {
  kind: 'video'
}

export interface AudioClip extends Clip {
  kind: 'audio'
  volume: number
  muted: boolean
}

export interface TextClip extends Clip {
  kind: 'text'
  text: string
}
