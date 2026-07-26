import type { AISuggestion, MediaType } from '../types'
import type { EditOperation, EditOperationGroup } from './EditOperation'
import type { Timeline } from './Track'
import type { ProjectAnalysisState } from '../analysis/models'

export interface ProjectAsset {
  id: string
  mediaItemId?: string
  type: MediaType
  filename: string
  duration?: number
  width?: number
  height?: number
  fileSize?: number
  mimeType?: string
  lastModified?: number
  sourceUri?: string
  createdAt: string
}

export interface ProjectSuggestion extends AISuggestion {
  source: 'mock' | 'analysis' | 'manual'
}

export interface ProjectHistoryEntry {
  id: string
  operationId?: string
  action: 'create' | 'apply-operation' | 'undo' | 'redo' | 'status-change'
  description: string
  createdAt: string
}

export interface ProjectHistory {
  entries: ProjectHistoryEntry[]
  undoStack: EditOperationGroup[]
  redoStack: EditOperationGroup[]
}

export interface ProjectMediaRoles {
  primaryAssetId: string | null
  referenceAssetId: string | null
}

export interface Project {
  id: string
  name: string
  assets: ProjectAsset[]
  mediaRoles?: ProjectMediaRoles
  analysis?: ProjectAnalysisState
  timeline: Timeline
  suggestions: ProjectSuggestion[]
  operations: EditOperation[]
  history: ProjectHistory
  createdAt: string
  updatedAt: string
}
