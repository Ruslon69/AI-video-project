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

export type MediaStatus =
  | 'uploading'
  | 'metadata'
  | 'preview'
  | 'scene-detection'
  | 'transcribing'
  | 'ready'
  | 'error'

export type MediaFileRejection = {
  filename: string
  reason: string
}

export type VideoPreviewState = 'idle' | 'processing' | 'ready' | 'error'

export type VideoSceneDetectionState =
  | 'idle'
  | 'processing'
  | 'ready'
  | 'timeout'
  | 'error'

export type VideoTranscriptionState = 'idle' | 'processing' | 'ready' | 'error'

export type VideoPreviewFrame = {
  timestamp: number
  data_url: string
}

export type VideoPreviews = {
  poster: VideoPreviewFrame
  previews: VideoPreviewFrame[]
}

export type VideoScenes = {
  outcome: 'scenes_detected' | 'no_scene_changes'
  scenes: VideoScene[]
  processingTimeMs?: number | null
}

export type VideoScene = {
  id: string
  start: number
  end: number
  duration: number
}

export type VideoTranscriptSegment = {
  id: number
  start: number
  end: number
  text: string
}

export type VideoTranscription = {
  language: string
  duration: number
  segments: VideoTranscriptSegment[]
}

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
  status: MediaStatus
  progress: number
  metadata: VideoMetadata | null
  errorMessage?: string
  previewState: VideoPreviewState
  previews: VideoPreviews | null
  previewError: string | null
  sceneState: VideoSceneDetectionState
  scenes: VideoScenes | null
  sceneError: string | null
  transcriptionState: VideoTranscriptionState
  transcription: VideoTranscription | null
  transcriptionError: string | null
}
