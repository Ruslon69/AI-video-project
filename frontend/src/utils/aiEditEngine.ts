import type { AISuggestion } from '../types'

export type ApplyAcceptedSuggestions = (suggestions: AISuggestion[]) => void

export const applyAcceptedSuggestions: ApplyAcceptedSuggestions = () => {
  throw new Error('applyAcceptedSuggestions is reserved for a future non-destructive edit engine.')
}
