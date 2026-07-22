import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ProjectOutputSettings } from '../types'
import type { TimelineZoom } from '../components/timeline/timelineConstants'
import type {
  DeleteOperation,
  EditOperation,
  EditOperationGroup,
  ReviewDecisionOperation,
  SplitOperation,
  TrimOperation,
} from '../models/EditOperation'
import {
  defaultProjectState,
  ProjectContext,
} from './ProjectState'
import type { CentralProjectState } from './ProjectState'
import {
  getFirstEnabledTimelineItem,
  getSuggestionReviewStatus,
  normalizeTrimRange,
} from '../selectors/editSelectors'
import {
  createOperationId,
  createOperationTimestamp,
} from '../utils/operationIds'

type ProjectProviderProps = {
  children: ReactNode
}

function applyOperationGroup(
  operations: EditOperation[],
  operationGroup: EditOperationGroup,
) {
  return {
    operations: [...operations, ...operationGroup.operations],
    undoStack: [operationGroup],
    redoStack: [],
  }
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
    status: 'accepted' | 'rejected',
  ) => {
    const suggestionIdSet = new Set(suggestionIds)

    setProjectState((currentState) => {
      const createdAt = createOperationTimestamp()
      const primaryTimelineItem = getFirstEnabledTimelineItem(currentState.project)
      const newOperations: DeleteOperation[] = status === 'accepted'
        ? currentState.project.suggestions
            .filter((suggestion) => suggestionIdSet.has(suggestion.id))
            .filter(() => Boolean(primaryTimelineItem))
            .filter(
              (suggestion) =>
                getSuggestionReviewStatus(currentState.project, suggestion.id) ===
                'pending',
            )
            .map((suggestion) => ({
              id: createOperationId('delete'),
              type: 'delete',
              timelineItemId: primaryTimelineItem?.id ?? '',
              startTime: suggestion.start,
              endTime: suggestion.end,
              createdAt,
            }))
        : []
      const reviewDecisionOperations: ReviewDecisionOperation[] =
        currentState.project.suggestions
          .filter((suggestion) => suggestionIdSet.has(suggestion.id))
          .filter(
            (suggestion) =>
              getSuggestionReviewStatus(currentState.project, suggestion.id) ===
              'pending',
          )
          .map((suggestion) => ({
            id: createOperationId('review-decision'),
            type: 'review-decision',
            suggestionId: suggestion.id,
            decision: status === 'accepted' ? 'accepted' : 'rejected',
            createdAt,
          }))
      const operationGroup: EditOperationGroup | null = reviewDecisionOperations.length
        ? {
            actionId: createOperationId('review-action'),
            operations: [...newOperations, ...reviewDecisionOperations],
          }
        : null
      const operationState = operationGroup
        ? applyOperationGroup(currentState.project.operations, operationGroup)
        : null

      return {
        ...currentState,
        project: {
          ...currentState.project,
          operations: operationState?.operations ?? currentState.project.operations,
          history: {
            ...currentState.project.history,
            undoStack: operationState
              ? [
                  ...currentState.project.history.undoStack,
                  ...operationState.undoStack,
                ]
              : currentState.project.history.undoStack,
            redoStack: operationState
              ? operationState.redoStack
              : currentState.project.history.redoStack,
          },
          updatedAt: createOperationTimestamp(),
        },
      }
    })
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
        updatedAt: createOperationTimestamp(),
      },
    }))
  }, [])

  const applyTrimOperation = useCallback((
    timelineItemId: string,
    trimStart: number,
    trimEnd: number,
    sourceDuration: number,
  ) => {
    setProjectState((currentState) => {
      const normalizedRange = normalizeTrimRange(trimStart, trimEnd, sourceDuration)
      const createdAt = createOperationTimestamp()
      const trimOperation: TrimOperation = {
        id: createOperationId('trim'),
        type: 'trim',
        timelineItemId,
        trimStart: normalizedRange.trimStart,
        trimEnd: normalizedRange.trimEnd,
        createdAt,
      }
      const operationGroup: EditOperationGroup = {
        actionId: createOperationId('trim-action'),
        operations: [trimOperation],
      }
      const operationState = applyOperationGroup(
        currentState.project.operations,
        operationGroup,
      )

      return {
        ...currentState,
        project: {
          ...currentState.project,
          operations: operationState.operations,
          history: {
            ...currentState.project.history,
            undoStack: [
              ...currentState.project.history.undoStack,
              ...operationState.undoStack,
            ],
            redoStack: operationState.redoStack,
          },
          updatedAt: createdAt,
        },
      }
    })
  }, [])

  const applySplitOperation = useCallback((
    timelineItemId: string,
    splitTime: number,
  ) => {
    if (!Number.isFinite(splitTime)) {
      return
    }

    setProjectState((currentState) => {
      const createdAt = createOperationTimestamp()
      const splitOperation: SplitOperation = {
        id: createOperationId('split'),
        type: 'split',
        timelineItemId,
        splitTime,
        leftTimelineItemId: createOperationId('timeline-item'),
        rightTimelineItemId: createOperationId('timeline-item'),
        createdAt,
      }
      const operationGroup: EditOperationGroup = {
        actionId: createOperationId('split-action'),
        operations: [splitOperation],
      }
      const operationState = applyOperationGroup(
        currentState.project.operations,
        operationGroup,
      )

      return {
        ...currentState,
        project: {
          ...currentState.project,
          operations: operationState.operations,
          history: {
            ...currentState.project.history,
            undoStack: [
              ...currentState.project.history.undoStack,
              ...operationState.undoStack,
            ],
            redoStack: operationState.redoStack,
          },
          updatedAt: createdAt,
        },
      }
    })
  }, [])

  const undo = useCallback(() => {
    setProjectState((currentState) => {
      const operation = currentState.project.history.undoStack.at(-1)

      if (!operation) {
        return currentState
      }
      const operationIds = new Set(operation.operations.map((item) => item.id))

      return {
        ...currentState,
        project: {
          ...currentState.project,
          operations: currentState.project.operations.filter(
            (item) => !operationIds.has(item.id),
          ),
          history: {
            ...currentState.project.history,
            undoStack: currentState.project.history.undoStack.slice(0, -1),
            redoStack: [...currentState.project.history.redoStack, operation],
          },
          updatedAt: createOperationTimestamp(),
        },
      }
    })
  }, [])

  const redo = useCallback(() => {
    setProjectState((currentState) => {
      const operation = currentState.project.history.redoStack.at(-1)

      if (!operation) {
        return currentState
      }

      return {
        ...currentState,
        project: {
          ...currentState.project,
          operations: [
            ...currentState.project.operations,
            ...operation.operations.filter(
              (redoOperation) =>
                !currentState.project.operations.some(
                  (item) => item.id === redoOperation.id,
                ),
            ),
          ],
          history: {
            ...currentState.project.history,
            undoStack: [...currentState.project.history.undoStack, operation],
            redoStack: currentState.project.history.redoStack.slice(0, -1),
          },
          updatedAt: createOperationTimestamp(),
        },
      }
    })
  }, [])

  const value = useMemo(
    () => ({
      ...projectState,
      undoStack: projectState.project.history.undoStack,
      redoStack: projectState.project.history.redoStack,
      canUndo: projectState.project.history.undoStack.length > 0,
      canRedo: projectState.project.history.redoStack.length > 0,
      activateSuggestion,
      toggleSuggestionSelection,
      selectSuggestions,
      updateSuggestionStatuses,
      selectTimelineItem,
      selectClips,
      setPlaybackPosition,
      setTimelineZoom,
      setOutputSettings,
      applyTrimOperation,
      applySplitOperation,
      undo,
      redo,
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
      applyTrimOperation,
      applySplitOperation,
      undo,
      redo,
    ],
  )

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}
