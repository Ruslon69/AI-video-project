export type StageStatus =
  | 'blocked'
  | 'ready'
  | 'in_progress'
  | 'review'
  | 'approved'
  | 'revision'

export type ThemePreference = 'light' | 'dark' | 'system'

export type VersionRecord = {
  id: string
  version: number
  createdAt: string
  description: string
  status: StageStatus
  comment: string
}

export type EditingSubstage = {
  id: string
  title: string
  status: StageStatus
  comment: string
  selectedVersionId: string | null
  versions: VersionRecord[]
}

export type EditingStage = {
  id: string
  title: string
  description: string
  status: StageStatus
  substages: EditingSubstage[]
}

export type ProjectState = {
  stages: EditingStage[]
  selectedStageId: string
  selectedSubstageId: string
  expandedStageIds: string[]
}

export type ProjectStats = {
  totalStages: number
  approvedStages: number
  totalSubstages: number
  approvedSubstages: number
  progress: number
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export type VideoMetadata = {
  filename: string
  duration: number
  width: number
  height: number
  fps: number
  codec: string
  bitrate: number | null
  file_size: number
}

export type MediaType = 'video' | 'image' | 'audio'

export type MediaProcessingState = 'ready' | 'processing' | 'error'

export type TargetOutputDuration = 30 | 60 | 90 | 120 | 180 | 300 | 600

export type TargetPlatform =
  | 'tiktok'
  | 'instagram_reels'
  | 'youtube_shorts'
  | 'custom'

export type TargetAspectRatio = '9:16' | '16:9' | '1:1' | '4:5'

export type SourceOrientation = 'vertical' | 'horizontal' | 'square'

export type ProjectOutputSettings = {
  duration: TargetOutputDuration
  platform: TargetPlatform
  aspectRatio: TargetAspectRatio
  resolution: {
    width: number
    height: number
  }
  container: 'MP4'
  videoCodec: 'H.264'
  audioCodec: 'AAC'
}

export type MediaItem = {
  id: string
  file: File
  filename: string
  type: MediaType
  size: number
  lastModified: number
  objectUrl: string
  state: MediaProcessingState
  metadata: VideoMetadata | null
  error: string | null
}
