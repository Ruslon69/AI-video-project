import type { AISuggestion } from '../types'

export const mockAISuggestions: AISuggestion[] = [
  {
    id: 'ai-silence-12',
    type: 'silence',
    start: 12.3,
    end: 14.1,
    confidence: 0.94,
    reason: 'Silence',
    status: 'pending',
  },
  {
    id: 'ai-long-pause-28',
    type: 'cut',
    start: 28.4,
    end: 31.8,
    confidence: 0.88,
    reason: 'Long pause',
    status: 'pending',
  },
  {
    id: 'ai-filler-44',
    type: 'cut',
    start: 44.2,
    end: 45.6,
    confidence: 0.81,
    reason: 'Remove filler',
    status: 'pending',
  },
  {
    id: 'ai-trim-beginning',
    type: 'trim',
    start: 0,
    end: 3.5,
    confidence: 0.76,
    reason: 'Trim beginning',
    status: 'pending',
  },
]
