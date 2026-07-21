import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AISuggestion, ProjectOutputSettings } from '../types'
import type { TimelineZoom } from '../components/timeline/timelineConstants'
import {
  defaultProjectState,
  ProjectContext,
} from './ProjectState'
import type { CentralProjectState } from './ProjectState'

type ProjectProviderProps = {
  children: ReactNode
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [projectState, setProjectState] = useState<CentralProjectState>(
    defaultProjectState,
  )

  const activateSuggestion = useCallback((suggestionId: string) => {
    setProjectState((currentState) => ({
      ...currentState,
      selectedSuggestionIds: currentState.selectedSuggestionIds.includes(suggestionId)
        ? currentState.selectedSuggestionIds
        : [...currentState.selectedSuggestionIds, suggestionId],
      activeSuggestionId: suggestionId,
    }))
  }, [])

  const toggleSuggestionSelection = useCallback((suggestionId: string) => {
    setProjectState((currentState) => ({
      ...currentState,
      selectedSuggestionIds: currentState.selectedSuggestionIds.includes(suggestionId)
        ? currentState.selectedSuggestionIds.filter((id) => id !== suggestionId)
        : [...currentState.selectedSuggestionIds, suggestionId],
      activeSuggestionId: suggestionId,
    }))
  }, [])

  const selectSuggestions = useCallback((suggestionIds: string[]) => {
    setProjectState((currentState) => ({
      ...currentState,
      selectedSuggestionIds: suggestionIds,
      activeSuggestionId: suggestionIds[0] ?? null,
    }))
  }, [])

  const updateSuggestionStatuses = useCallback((
    suggestionIds: string[],
    status: AISuggestion['status'],
  ) => {
    const suggestionIdSet = new Set(suggestionIds)

    setProjectState((currentState) => ({
      ...currentState,
      activeSuggestionId: suggestionIds[0] ?? currentState.activeSuggestionId,
      project: {
        ...currentState.project,
        suggestions: currentState.project.suggestions.map((suggestion) =>
          suggestionIdSet.has(suggestion.id)
            ? { ...suggestion, status }
            : suggestion,
        ),
        updatedAt: new Date().toISOString(),
      },
    }))
  }, [])

  const selectTimelineItem = useCallback((timelineItemId: string | null) => {
    setProjectState((currentState) => ({
      ...currentState,
      selectedTimelineItemId: timelineItemId,
    }))
  }, [])

  const selectClips = useCallback((clipIds: string[]) => {
    setProjectState((currentState) => ({
      ...currentState,
      selectedClipIds: clipIds,
    }))
  }, [])

  const setPlaybackPosition = useCallback((timestamp: number) => {
    setProjectState((currentState) => ({
      ...currentState,
      playbackPosition: timestamp,
    }))
  }, [])

  const setTimelineZoom = useCallback((zoom: TimelineZoom) => {
    setProjectState((currentState) => ({
      ...currentState,
      timelineZoom: zoom,
    }))
  }, [])

  const setOutputSettings = useCallback((settings: ProjectOutputSettings) => {
    setProjectState((currentState) => ({
      ...currentState,
      outputSettings: settings,
      project: {
        ...currentState.project,
        updatedAt: new Date().toISOString(),
      },
    }))
  }, [])

  const value = useMemo(
    () => ({
      ...projectState,
      activateSuggestion,
      toggleSuggestionSelection,
      selectSuggestions,
      updateSuggestionStatuses,
      selectTimelineItem,
      selectClips,
      setPlaybackPosition,
      setTimelineZoom,
      setOutputSettings,
    }),
    [
      projectState,
      activateSuggestion,
      toggleSuggestionSelection,
      selectSuggestions,
      updateSuggestionStatuses,
      selectTimelineItem,
      selectClips,
      setPlaybackPosition,
      setTimelineZoom,
      setOutputSettings,
    ],
  )

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}
