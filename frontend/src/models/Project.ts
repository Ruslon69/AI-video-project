import type { AISuggestion, MediaType } from '../types'
import type { EditOperation } from './EditOperation'
import type { Timeline } from './Track'

export interface ProjectAsset {
  id: string
  type: MediaType
  filename: string
  duration?: number
  width?: number
  height?: number
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
  undoStack: EditOperation[]
  redoStack: EditOperation[]
}

export interface Project {
  id: string
  name: string
  assets: ProjectAsset[]
  timeline: Timeline
  suggestions: ProjectSuggestion[]
  operations: EditOperation[]
  history: ProjectHistory
  createdAt: string
  updatedAt: string
}
