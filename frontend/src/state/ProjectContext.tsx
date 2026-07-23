import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ProjectOutputSettings } from '../types'
import type { TimelineZoom } from '../components/timeline/timelineConstants'
import { timelineTime } from '../models/Time'
import type {
  DeleteOperation,
  EditOperation,
  EditOperationGroup,
  MoveOperation,
  ReviewDecisionOperation,
  SplitOperation,
  TrimOperation,
} from '../models/EditOperation'
import {
  defaultProjectState,
  ProjectContext,
} from './ProjectState'
import type {
  CentralProjectState,
  SeekRequestReason,
} from './ProjectState'
import {
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

function createSuggestionSeekRequest(
  state: CentralProjectState,
  suggestionId: string | null,
) {
  const suggestion = suggestionId
    ? state.project.suggestions.find((item) => item.id === suggestionId)
    : null

  return suggestion
    ? {
        id: (state.seekRequest?.id ?? 0) + 1,
        timelineTime: timelineTime(suggestion.start),
        reason: 'suggestion-selection' as const,
      }
    : state.seekRequest
}

function getSelectionState(timelineItemId: string | null) {
  return {
    primaryItemId: timelineItemId,
    selectedItemIds: timelineItemId ? [timelineItemId] : [],
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
        seekRequest: createSuggestionSeekRequest(currentState, suggestionId),
    }))
  }, [])

  const toggleSuggestionSelection = useCallback((suggestionId: string) => {
    setProjectState((currentState) => ({
      ...currentState,
      selectedSuggestionIds: currentState.selectedSuggestionIds.includes(suggestionId)
        ? currentState.selectedSuggestionIds.filter((id) => id !== suggestionId)
        : [...currentState.selectedSuggestionIds, suggestionId],
      activeSuggestionId: suggestionId,
      seekRequest: createSuggestionSeekRequest(currentState, suggestionId),
    }))
  }, [])

  const selectSuggestions = useCallback((suggestionIds: string[]) => {
    const activeSuggestionId = suggestionIds[0] ?? null

    setProjectState((currentState) => ({
      ...currentState,
      selectedSuggestionIds: suggestionIds,
      activeSuggestionId,
      seekRequest: createSuggestionSeekRequest(currentState, activeSuggestionId),
    }))
  }, [])

  const updateSuggestionStatuses = useCallback((
    suggestionIds: string[],
    status: 'accepted' | 'rejected',
  ) => {
    const suggestionIdSet = new Set(suggestionIds)

    setProjectState((currentState) => {
      const createdAt = createOperationTimestamp()
      const primaryTimelineItemId = currentState.selection.primaryItemId
      const primaryTimelineItem = currentState.project.timeline.items.find(
        (timelineItem) => timelineItem.id === primaryTimelineItemId,
      )
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
              relativeStart: suggestion.start -
                (primaryTimelineItem?.timelineStart ?? 0),
              relativeEnd: suggestion.end -
                (primaryTimelineItem?.timelineStart ?? 0),
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
      selection: getSelectionState(timelineItemId),
    }))
  }, [])

  const clearSelection = useCallback(() => {
    setProjectState((currentState) => ({
      ...currentState,
      selection: getSelectionState(null),
    }))
  }, [])

  const selectClips = useCallback((clipIds: string[]) => {
    setProjectState((currentState) => ({
      ...currentState,
      selectedClipIds: clipIds,
    }))
  }, [])

  const reportPlaybackPosition = useCallback((timestamp: number) => {
    setProjectState((currentState) => ({
      ...currentState,
      reportedPlaybackPosition: timestamp,
    }))
  }, [])

  const requestSeek = useCallback((
    timestamp: number,
    reason: SeekRequestReason,
  ) => {
    setProjectState((currentState) => ({
      ...currentState,
      seekRequest: {
        id: (currentState.seekRequest?.id ?? 0) + 1,
        timelineTime: timelineTime(timestamp),
        reason,
      },
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
    relativeStart: number,
    relativeEnd: number,
    itemDuration: number,
  ) => {
    setProjectState((currentState) => {
      const normalizedRange = normalizeTrimRange(
        relativeStart,
        relativeEnd,
        itemDuration,
      )
      const createdAt = createOperationTimestamp()
      const trimOperation: TrimOperation = {
        id: createOperationId('trim'),
        type: 'trim',
        timelineItemId,
        relativeStart: normalizedRange.trimStart,
        relativeEnd: normalizedRange.trimEnd,
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

  const applyDeleteOperation = useCallback((
    timelineItemId: string,
    relativeStart: number,
    relativeEnd: number,
  ) => {
    if (!Number.isFinite(relativeStart) || !Number.isFinite(relativeEnd)) {
      return
    }

    setProjectState((currentState) => {
      const createdAt = createOperationTimestamp()
      const deleteOperation: DeleteOperation = {
        id: createOperationId('delete'),
        type: 'delete',
        timelineItemId,
        relativeStart,
        relativeEnd,
        createdAt,
      }
      const operationGroup: EditOperationGroup = {
        actionId: createOperationId('delete-action'),
        operations: [deleteOperation],
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

  const applyMoveOperation = useCallback((
    timelineItemId: string,
    timelineStart: number,
  ) => {
    if (!Number.isFinite(timelineStart)) {
      return
    }

    setProjectState((currentState) => {
      const createdAt = createOperationTimestamp()
      const moveOperation: MoveOperation = {
        id: createOperationId('move'),
        type: 'move',
        timelineItemId,
        timelineStart: Math.max(timelineStart, 0),
        createdAt,
      }
      const operationGroup: EditOperationGroup = {
        actionId: createOperationId('move-action'),
        operations: [moveOperation],
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
      selectedTimelineItemId: projectState.selection.primaryItemId,
      undoStack: projectState.project.history.undoStack,
      redoStack: projectState.project.history.redoStack,
      canUndo: projectState.project.history.undoStack.length > 0,
      canRedo: projectState.project.history.redoStack.length > 0,
      activateSuggestion,
      toggleSuggestionSelection,
      selectSuggestions,
      updateSuggestionStatuses,
      selectTimelineItem,
      clearSelection,
      selectClips,
      reportPlaybackPosition,
      requestSeek,
      setTimelineZoom,
      setOutputSettings,
      applyTrimOperation,
      applySplitOperation,
      applyDeleteOperation,
      applyMoveOperation,
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
      clearSelection,
      selectClips,
      reportPlaybackPosition,
      requestSeek,
      setTimelineZoom,
      setOutputSettings,
      applyTrimOperation,
      applySplitOperation,
      applyDeleteOperation,
      applyMoveOperation,
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
