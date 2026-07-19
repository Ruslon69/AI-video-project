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
