import { createContext } from 'react'
import type { AISuggestion, ProjectOutputSettings } from '../types'
import type { Clip } from '../models/Clip'
import type { Project, ProjectSuggestion } from '../models/Project'
import type { Timeline } from '../models/Track'
import type { TimelineZoom } from '../components/timeline/timelineConstants'
import { defaultProjectOutputSettings } from '../utils/projectSettings'

const createdAt = '2026-07-21T00:00:00.000Z'

export const defaultProjectSuggestions: ProjectSuggestion[] = [
  {
    id: 'ai-silence-12',
    type: 'silence',
    start: 12.3,
    end: 14.1,
    confidence: 0.94,
    reason: 'Silence',
    status: 'pending',
    source: 'mock',
  },
  {
    id: 'ai-long-pause-28',
    type: 'cut',
    start: 28.4,
    end: 31.8,
    confidence: 0.88,
    reason: 'Long pause',
    status: 'pending',
    source: 'mock',
  },
  {
    id: 'ai-filler-44',
    type: 'cut',
    start: 44.2,
    end: 45.6,
    confidence: 0.81,
    reason: 'Remove filler',
    status: 'pending',
    source: 'mock',
  },
  {
    id: 'ai-trim-beginning',
    type: 'trim',
    start: 0,
    end: 3.5,
    confidence: 0.76,
    reason: 'Trim beginning',
    status: 'pending',
    source: 'mock',
  },
]

export const defaultProjectClips: Clip[] = [
  {
    id: 'clip-primary-video',
    assetId: 'asset-primary-video',
    trackId: 'track-video',
    name: 'Primary video',
    source: {
      start: 0,
      end: 60,
    },
    timeline: {
      start: 0,
      end: 60,
    },
    playbackRate: 1,
    enabled: true,
    createdAt,
    updatedAt: createdAt,
  },
]

export const defaultProjectTimeline: Timeline = {
  id: 'timeline-main',
  name: 'Main Timeline',
  duration: 60,
  tracks: [
    {
      id: 'track-video',
      type: 'video',
      name: 'Video',
      clips: defaultProjectClips,
      locked: false,
      muted: false,
      visible: true,
      order: 0,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'track-audio',
      type: 'audio',
      name: 'Audio',
      clips: [],
      locked: false,
      muted: false,
      visible: true,
      order: 1,
      createdAt,
      updatedAt: createdAt,
    },
  ],
  createdAt,
  updatedAt: createdAt,
}

export const defaultProject: Project = {
  id: 'project-local-default',
  name: 'My first video',
  assets: [
    {
      id: 'asset-primary-video',
      type: 'video',
      filename: 'Primary video',
      duration: 60,
      createdAt,
    },
  ],
  timeline: defaultProjectTimeline,
  suggestions: defaultProjectSuggestions,
  operations: [],
  history: {
    entries: [],
    undoStack: [],
    redoStack: [],
  },
  createdAt,
  updatedAt: createdAt,
}

export interface CentralProjectState {
  project: Project
  selectedSuggestionIds: string[]
  activeSuggestionId: string | null
  selectedTimelineItemId: string | null
  selectedClipIds: string[]
  playbackPosition: number
  timelineZoom: TimelineZoom
  outputSettings: ProjectOutputSettings
}

export interface ProjectContextValue extends CentralProjectState {
  activateSuggestion: (suggestionId: string) => void
  toggleSuggestionSelection: (suggestionId: string) => void
  selectSuggestions: (suggestionIds: string[]) => void
  updateSuggestionStatuses: (
    suggestionIds: string[],
    status: AISuggestion['status'],
  ) => void
  selectTimelineItem: (timelineItemId: string | null) => void
  selectClips: (clipIds: string[]) => void
  setPlaybackPosition: (timestamp: number) => void
  setTimelineZoom: (zoom: TimelineZoom) => void
  setOutputSettings: (settings: ProjectOutputSettings) => void
}

export const defaultProjectState: CentralProjectState = {
  project: defaultProject,
  selectedSuggestionIds: defaultProjectSuggestions[0]
    ? [defaultProjectSuggestions[0].id]
    : [],
  activeSuggestionId: defaultProjectSuggestions[0]?.id ?? null,
  selectedTimelineItemId: null,
  selectedClipIds: [],
  playbackPosition: 0,
  timelineZoom: 100,
  outputSettings: defaultProjectOutputSettings,
}

export const ProjectContext = createContext<ProjectContextValue | null>(null)
