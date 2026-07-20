import type { AISuggestion } from '../types'

export function getAISuggestionTitle(suggestion: AISuggestion) {
  const labels: Record<AISuggestion['type'], string> = {
    cut: 'Cut',
    trim: 'Trim',
    silence: 'Silence',
  }

  return labels[suggestion.type]
}

export function getAcceptedSuggestionDuration(suggestions: AISuggestion[]) {
  return suggestions
    .filter((suggestion) => suggestion.status === 'accepted')
    .reduce((total, suggestion) => total + getSuggestionDuration(suggestion), 0)
}

export function getSuggestionDuration(suggestion: AISuggestion) {
  return Math.max(suggestion.end - suggestion.start, 0)
}
