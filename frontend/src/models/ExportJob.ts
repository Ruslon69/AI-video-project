import type { EditPlan } from './EditOperation'

export type ExportJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ExportSettings {
  format: 'mp4'
  videoCodec: 'h264'
  audioCodec: 'aac'
  width: number
  height: number
  fps: number
  bitrate?: number
}

export interface ExportJob {
  id: string
  projectId: string
  editPlan: EditPlan
  settings: ExportSettings
  status: ExportJobStatus
  progress: number
  outputUrl?: string
  errorMessage?: string
  createdAt: string
  updatedAt: string
}
