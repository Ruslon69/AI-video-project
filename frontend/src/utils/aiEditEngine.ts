import type { AISuggestion } from '../types'
import type { EditOperation, EditPlan } from '../models/EditOperation'
import type { ExportJob } from '../models/ExportJob'
import type { Project } from '../models/Project'

export type ApplyAcceptedSuggestions = (suggestions: AISuggestion[]) => void

export const applyAcceptedSuggestions: ApplyAcceptedSuggestions = () => {
  throw new Error('applyAcceptedSuggestions is reserved for a future non-destructive edit engine.')
}

export function buildEditPlan(): EditPlan {
  throw new Error('Not implemented')
}

export function applyOperation(): Project {
  throw new Error('Not implemented')
}

export function undo(): Project {
  throw new Error('Not implemented')
}

export function redo(): Project {
  throw new Error('Not implemented')
}

export function generatePreview(): Project {
  throw new Error('Not implemented')
}

export function exportProject(): ExportJob {
  throw new Error('Not implemented')
}

export type EditEngineOperation = EditOperation
