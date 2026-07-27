import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ProjectOutputSettings } from '../types'
import { timelineTime } from '../models/Time'
import { createTimelineZoomState } from '../timeline/TimelineViewportState'
import type {
  DeleteOperation,
  EditOperation,
  EditOperationGroup,
  MoveOperation,
  ReviewDecisionOperation,
  TrimOperation,
} from '../models/EditOperation'
import {
  defaultProject,
  defaultProjectState,
  ProjectContext,
} from './ProjectState'
import type { CentralProjectState } from './ProjectState'
import {
  getSuggestionReviewStatus,
  normalizeTrimRange,
} from '../selectors/editSelectors'
import { buildEditProjection } from '../selectors/editProjection'
import { createSplitOperation } from '../operations/SplitOperation'
import { createRippleDeleteOperation } from '../operations/RippleDeleteOperation'
import { getRippleDeleteValidation } from '../selectors/rippleDeleteSelectors'
import {
  createOperationId,
  createOperationTimestamp,
} from '../utils/operationIds'
import {
  clearPrimaryProjectMedia,
  clearReferenceProjectMedia,
  choosePrimaryProjectMedia,
  chooseReferenceProjectMedia,
  getPrimaryProjectMediaBinding,
  reconnectProjectMediaAsset,
  registerProjectMediaAssets,
  normalizeProjectMediaRoles,
  removeProjectMediaAsset as removeMediaAssetFromProject,
  swapPrimaryAndReferenceProjectMedia,
  updateProjectMediaDuration,
  type ProjectMediaDescriptor,
} from './ProjectMedia'
import { createInitialPrimaryTimelineItemOperation } from '../operations/AddTimelineItemOperation'
import {
  createIdleProjectAnalysisState,
  type ProjectAnalysis,
} from '../analysis/models'
import {
  createRoughCutPlan,
  isRoughCutPlan,
  isRoughCutPlanForAnalysis,
  restoreRoughCutPlanDefaults as restorePlanDefaults,
  setAllRoughCutPlanItemsReviewStatus,
  setRoughCutPlanItemReviewStatus,
} from '../planner/RoughCutPlanner'
import type {
  RoughCutPlanItemReviewStatus,
} from '../planner/models'
import { createRoughCutExecution } from '../execution/RoughCutExecutor'

type ProjectProviderProps = {
  children: ReactNode
}

const projectStorageKey = 'ai-video-director-editor-project-v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function restoreProjectState(value: unknown): CentralProjectState {
  if (!isRecord(value) || !isRecord(value.project)) {
    return defaultProjectState
  }

  const project = value.project

  if (
    !Array.isArray(project.assets) ||
    !isRecord(project.timeline) ||
    !Array.isArray(project.operations) ||
    !isRecord(project.history)
  ) {
    return defaultProjectState
  }

  const restoredProject = normalizeProjectMediaRoles({
    ...defaultProject,
    ...project,
    analysis: isRecord(project.analysis)
      ? project.analysis as CentralProjectState['project']['analysis']
      : createIdleProjectAnalysisState(),
  })
  const completedAnalysis = restoredProject.analysis?.status === 'completed'
    ? restoredProject.analysis.result
    : null
  const storedPlan = isRoughCutPlan(project.roughCutPlan)
    ? project.roughCutPlan
    : null
  const roughCutPlan = completedAnalysis
    ? isRoughCutPlanForAnalysis(storedPlan, completedAnalysis)
      ? storedPlan
      : createRoughCutPlan(
          completedAnalysis,
          restoredProject.analysis?.completedAt ??
            completedAnalysis.generatedAt,
        )
    : null
  const timelineViewport = isRecord(value.timelineViewport) &&
    isRecord(value.timelineViewport.zoom)
      ? value.timelineViewport as CentralProjectState['timelineViewport']
      : defaultProjectState.timelineViewport

  return {
    ...defaultProjectState,
    ...value,
    project: {
      ...restoredProject,
      roughCutPlan,
    },
    selectedSuggestionIds: Array.isArray(value.selectedSuggestionIds)
      ? value.selectedSuggestionIds.filter((id): id is string => typeof id === 'string')
      : defaultProjectState.selectedSuggestionIds,
    activeSuggestionId: typeof value.activeSuggestionId === 'string'
      ? value.activeSuggestionId
      : null,
    selection: isRecord(value.selection)
      ? value.selection as CentralProjectState['selection']
      : defaultProjectState.selection,
    selectedClipIds: Array.isArray(value.selectedClipIds)
      ? value.selectedClipIds.filter((id): id is string => typeof id === 'string')
      : defaultProjectState.selectedClipIds,
    seekRequest: isRecord(value.seekRequest)
      ? value.seekRequest as CentralProjectState['seekRequest']
      : null,
    timelineViewport,
    outputSettings: isRecord(value.outputSettings)
      ? value.outputSettings as CentralProjectState['outputSettings']
      : defaultProjectState.outputSettings,
  }
}

function usePersistentProjectState() {
  const [projectState, setProjectState] = useState<CentralProjectState>(() => {
    try {
      const storedState = window.localStorage.getItem(projectStorageKey)

      return storedState
        ? restoreProjectState(JSON.parse(storedState))
        : defaultProjectState
    } catch {
      return defaultProjectState
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(projectStorageKey, JSON.stringify(projectState))
    } catch {
      // Browser storage is optional; the active editor state remains usable.
    }
  }, [projectState])

  return [projectState, setProjectState] as const
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

function getUndoSelection(
  timelineItemId: string | null,
  operationGroup: EditOperationGroup,
) {
  if (operationGroup.roughCutExecution) {
    return operationGroup.roughCutExecution
      .selectionBeforeTimelineItemId
  }

  return [...operationGroup.operations]
    .reverse()
    .reduce((selectedTimelineItemId, operation) => {
      if (operation.type === 'ripple-delete') {
        return operation.selectionBeforeTimelineItemId
      }

      if (operation.type === 'add-timeline-item') {
        return operation.selectionBeforeTimelineItemId
      }

      return operation.type === 'split' &&
        (
          selectedTimelineItemId === operation.leftTimelineItemId ||
          selectedTimelineItemId === operation.rightTimelineItemId
        )
          ? operation.timelineItemId
          : selectedTimelineItemId
    }, timelineItemId)
}

function getRedoSelection(
  timelineItemId: string | null,
  operationGroup: EditOperationGroup,
) {
  if (operationGroup.roughCutExecution) {
    return operationGroup.roughCutExecution
      .selectionAfterTimelineItemId
  }

  return operationGroup.operations.reduce((selectedTimelineItemId, operation) => {
    if (operation.type === 'ripple-delete') {
      return operation.selectionAfterTimelineItemId
    }

    if (operation.type === 'add-timeline-item') {
      return operation.timelineItem.id
    }

    return operation.type === 'split' &&
      selectedTimelineItemId === operation.timelineItemId
        ? operation.rightTimelineItemId
        : selectedTimelineItemId
  }, timelineItemId)
}

function createRippleSeekRequest(
  state: CentralProjectState,
  timeline: number,
) {
  return {
    id: (state.seekRequest?.id ?? 0) + 1,
    timelineTime: timelineTime(timeline),
    reason: 'ripple-delete' as const,
  }
}

function getHistorySeekRequest(
  state: CentralProjectState,
  operationGroup: EditOperationGroup,
  direction: 'undo' | 'redo',
) {
  if (operationGroup.roughCutExecution) {
    return {
      id: (state.seekRequest?.id ?? 0) + 1,
      timelineTime: timelineTime(
        direction === 'undo'
          ? operationGroup.roughCutExecution.playheadBefore
          : operationGroup.roughCutExecution.playheadAfter,
      ),
      reason: 'rough-cut-apply' as const,
    }
  }

  const rippleOperations = operationGroup.operations.filter(
    (operation) => operation.type === 'ripple-delete',
  )
  const rippleOperation = direction === 'undo'
    ? rippleOperations[0]
    : rippleOperations.at(-1)

  return rippleOperation
    ? createRippleSeekRequest(
        state,
        direction === 'undo'
          ? rippleOperation.playheadBefore
          : rippleOperation.playheadAfter,
      )
    : state.seekRequest
}

function addInitialPrimaryTimelineItem(
  currentState: CentralProjectState,
  project: CentralProjectState['project'],
  clearSelection = false,
) {
  const primaryBinding = getPrimaryProjectMediaBinding(project)
  const mediaItemId = primaryBinding?.asset.mediaItemId

  if (!mediaItemId) {
    return {
      ...currentState,
      selection: clearSelection
        ? getSelectionState(null)
        : currentState.selection,
      project,
    }
  }

  const createdAt = createOperationTimestamp()
  const operation = createInitialPrimaryTimelineItemOperation(
    project,
    buildEditProjection(project),
    mediaItemId,
    {
      operationId: createOperationId('add-timeline-item'),
      timelineItemId: createOperationId('timeline-item'),
    },
    null,
    createdAt,
  )

  if (!operation) {
    return project === currentState.project
      ? currentState
      : {
          ...currentState,
          selection: clearSelection
            ? getSelectionState(null)
            : currentState.selection,
          project,
        }
  }

  const operationGroup: EditOperationGroup = {
    actionId: createOperationId('add-timeline-item-action'),
    operations: [operation],
  }
  const operationState = applyOperationGroup(
    project.operations,
    operationGroup,
  )

  return {
    ...currentState,
    selection: getSelectionState(operation.timelineItem.id),
    project: {
      ...project,
      operations: operationState.operations,
      history: {
        ...project.history,
        undoStack: [
          ...project.history.undoStack,
          ...operationState.undoStack,
        ],
        redoStack: operationState.redoStack,
      },
      updatedAt: createdAt,
    },
  }
}

function resetSourceDependentProject(
  project: CentralProjectState['project'],
) {
  const updatedAt = createOperationTimestamp()

  return {
    ...project,
    timeline: {
      ...project.timeline,
      duration: 0,
      items: [],
      updatedAt,
    },
    suggestions: [],
    operations: [],
    history: {
      entries: [],
      undoStack: [],
      redoStack: [],
    },
    analysis: createIdleProjectAnalysisState(),
    roughCutPlan: null,
    updatedAt,
  }
}

function createFreshPrimaryTimelineState(
  currentState: CentralProjectState,
  project: CentralProjectState['project'],
) {
  const resetState: CentralProjectState = {
    ...currentState,
    selectedSuggestionIds: [],
    activeSuggestionId: null,
    selectedClipIds: [],
    selection: getSelectionState(null),
    seekRequest: {
      id: (currentState.seekRequest?.id ?? 0) + 1,
      timelineTime: timelineTime(0),
      reason: 'media-change',
    },
  }
  const stateWithInitialClip = addInitialPrimaryTimelineItem(
    resetState,
    project,
    true,
  )

  return {
    ...stateWithInitialClip,
    selectedClipIds: [],
    selection: getSelectionState(null),
  }
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [projectState, setProjectState] = usePersistentProjectState()

  const activateSuggestion = useCallback((suggestionId: string) => {
    setProjectState((currentState) => ({
        ...currentState,
        selectedSuggestionIds: currentState.selectedSuggestionIds.includes(suggestionId)
          ? currentState.selectedSuggestionIds
          : [...currentState.selectedSuggestionIds, suggestionId],
        activeSuggestionId: suggestionId,
        seekRequest: createSuggestionSeekRequest(currentState, suggestionId),
    }))
  }, [setProjectState])

  const toggleSuggestionSelection = useCallback((suggestionId: string) => {
    setProjectState((currentState) => ({
      ...currentState,
      selectedSuggestionIds: currentState.selectedSuggestionIds.includes(suggestionId)
        ? currentState.selectedSuggestionIds.filter((id) => id !== suggestionId)
        : [...currentState.selectedSuggestionIds, suggestionId],
      activeSuggestionId: suggestionId,
      seekRequest: createSuggestionSeekRequest(currentState, suggestionId),
    }))
  }, [setProjectState])

  const selectSuggestions = useCallback((suggestionIds: string[]) => {
    const activeSuggestionId = suggestionIds[0] ?? null

    setProjectState((currentState) => ({
      ...currentState,
      selectedSuggestionIds: suggestionIds,
      activeSuggestionId,
      seekRequest: createSuggestionSeekRequest(currentState, activeSuggestionId),
    }))
  }, [setProjectState])

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
  }, [setProjectState])

  const selectTimelineItem = useCallback((timelineItemId: string | null) => {
    setProjectState((currentState) => ({
      ...currentState,
      selection: getSelectionState(timelineItemId),
    }))
  }, [setProjectState])

  const clearSelection = useCallback(() => {
    setProjectState((currentState) => ({
      ...currentState,
      selection: getSelectionState(null),
    }))
  }, [setProjectState])

  const selectClips = useCallback((clipIds: string[]) => {
    setProjectState((currentState) => ({
      ...currentState,
      selectedClipIds: clipIds,
    }))
  }, [setProjectState])

  const setTimelineZoom = useCallback((level: number) => {
    setProjectState((currentState) => {
      const zoom = createTimelineZoomState(level)

      if (zoom.level === currentState.timelineViewport.zoom.level) {
        return currentState
      }

      return {
        ...currentState,
        timelineViewport: {
          ...currentState.timelineViewport,
          zoom,
        },
      }
    })
  }, [setProjectState])

  const setOutputSettings = useCallback((settings: ProjectOutputSettings) => {
    setProjectState((currentState) => ({
      ...currentState,
      outputSettings: settings,
      project: {
        ...currentState.project,
        updatedAt: createOperationTimestamp(),
      },
    }))
  }, [setProjectState])

  const registerMediaAssets = useCallback((
    mediaItems: ProjectMediaDescriptor[],
  ) => {
    setProjectState((currentState) => {
      const project = registerProjectMediaAssets(
        currentState.project,
        mediaItems,
      )

      return project === currentState.project
        ? currentState
        : {
            ...currentState,
            project,
          }
    })
  }, [setProjectState])

  const setPrimaryMedia = useCallback((mediaItemId: string) => {
    setProjectState((currentState) => {
      const previousPrimaryAssetId =
        getPrimaryProjectMediaBinding(currentState.project)?.asset.id ?? null
      const projectWithRole = choosePrimaryProjectMedia(
        currentState.project,
        mediaItemId,
      )
      const nextPrimaryAssetId =
        getPrimaryProjectMediaBinding(projectWithRole)?.asset.id ?? null

      if (!nextPrimaryAssetId || nextPrimaryAssetId === previousPrimaryAssetId) {
        return currentState
      }

      return createFreshPrimaryTimelineState(
        currentState,
        resetSourceDependentProject(projectWithRole),
      )
    })
  }, [setProjectState])

  const swapPrimaryAndReference = useCallback(() => {
    setProjectState((currentState) => {
      const projectWithSwappedRoles = swapPrimaryAndReferenceProjectMedia(
        currentState.project,
      )

      if (projectWithSwappedRoles === currentState.project) {
        return currentState
      }

      return createFreshPrimaryTimelineState(
        currentState,
        resetSourceDependentProject(projectWithSwappedRoles),
      )
    })
  }, [setProjectState])

  const clearReferenceMedia = useCallback(() => {
    setProjectState((currentState) => {
      const project = clearReferenceProjectMedia(currentState.project)

      return project === currentState.project
        ? currentState
        : {
            ...currentState,
            project,
          }
    })
  }, [setProjectState])

  const removeProjectMediaAsset = useCallback((mediaItemId: string) => {
    setProjectState((currentState) => {
      const targetBinding = currentState.project.assets.find(
        (asset) => asset.mediaItemId === mediaItemId,
      )
      const primaryBinding = getPrimaryProjectMediaBinding(
        currentState.project,
      )
      const shouldResetEditor = Boolean(
        targetBinding &&
        primaryBinding?.asset.id === targetBinding.id,
      )
      const projectBeforeRemoval = shouldResetEditor
        ? resetSourceDependentProject(
            clearPrimaryProjectMedia(currentState.project),
          )
        : currentState.project
      const project = removeMediaAssetFromProject(
        projectBeforeRemoval,
        mediaItemId,
      )

      if (project === currentState.project) {
        return currentState
      }

      return shouldResetEditor
        ? {
            ...currentState,
            selectedSuggestionIds: [],
            activeSuggestionId: null,
            selectedClipIds: [],
            selection: getSelectionState(null),
            seekRequest: {
              id: (currentState.seekRequest?.id ?? 0) + 1,
              timelineTime: timelineTime(0),
              reason: 'media-change',
            },
            project,
          }
        : {
            ...currentState,
            project,
          }
    })
  }, [setProjectState])

  const connectProjectMedia = useCallback((mediaItem: ProjectMediaDescriptor) => {
    setProjectState((currentState) => {
      const project = reconnectProjectMediaAsset(
        currentState.project,
        mediaItem,
      )

      return project === currentState.project
        ? currentState
        : {
            ...currentState,
            project,
          }
    })
  }, [setProjectState])

  const startProjectAnalysis = useCallback((sourceAssetId: string) => {
    setProjectState((currentState) => {
      const primaryAssetId =
        getPrimaryProjectMediaBinding(currentState.project)?.asset.id ?? null

      if (!sourceAssetId || sourceAssetId !== primaryAssetId) {
        return currentState
      }

      const startedAt = createOperationTimestamp()

      return {
        ...currentState,
        project: {
          ...currentState.project,
          analysis: {
            status: 'running',
            progress: 5,
            sourceAssetId,
            result: null,
            error: null,
            startedAt,
            completedAt: null,
          },
          roughCutPlan: null,
          updatedAt: startedAt,
        },
      }
    })
  }, [setProjectState])

  const completeProjectAnalysis = useCallback((
    sourceAssetId: string,
    analysis: ProjectAnalysis,
  ) => {
    setProjectState((currentState) => {
      const primaryAssetId =
        getPrimaryProjectMediaBinding(currentState.project)?.asset.id ?? null
      const activeAnalysis = currentState.project.analysis

      if (
        sourceAssetId !== primaryAssetId ||
        analysis.sourceAssetId !== sourceAssetId ||
        activeAnalysis?.sourceAssetId !== sourceAssetId
      ) {
        return currentState
      }

      const completedAt = createOperationTimestamp()

      return {
        ...currentState,
        project: {
          ...currentState.project,
          analysis: {
            status: 'completed',
            progress: 100,
            sourceAssetId,
            result: analysis,
            error: null,
            startedAt: activeAnalysis.startedAt,
            completedAt,
          },
          roughCutPlan: createRoughCutPlan(analysis, completedAt),
          updatedAt: completedAt,
        },
      }
    })
  }, [setProjectState])

  const failProjectAnalysis = useCallback((
    sourceAssetId: string,
    message: string,
  ) => {
    setProjectState((currentState) => {
      const primaryAssetId =
        getPrimaryProjectMediaBinding(currentState.project)?.asset.id ?? null
      const activeAnalysis = currentState.project.analysis

      if (
        sourceAssetId !== primaryAssetId ||
        activeAnalysis?.sourceAssetId !== sourceAssetId
      ) {
        return currentState
      }

      const completedAt = createOperationTimestamp()

      return {
        ...currentState,
        project: {
          ...currentState.project,
          analysis: {
            status: 'failed',
            progress: 0,
            sourceAssetId,
            result: null,
            error: message,
            startedAt: activeAnalysis.startedAt,
            completedAt,
          },
          updatedAt: completedAt,
        },
      }
    })
  }, [setProjectState])

  const retryProjectAnalysis = useCallback(() => {
    setProjectState((currentState) => {
      const primaryAssetId =
        getPrimaryProjectMediaBinding(currentState.project)?.asset.id ?? null
      const analysis = currentState.project.analysis

      if (
        !primaryAssetId ||
        analysis?.status !== 'failed' ||
        analysis.sourceAssetId !== primaryAssetId
      ) {
        return currentState
      }

      return {
        ...currentState,
        project: {
          ...currentState.project,
          analysis: createIdleProjectAnalysisState(),
          roughCutPlan: null,
          updatedAt: createOperationTimestamp(),
        },
      }
    })
  }, [setProjectState])

  const rebuildRoughCutPlan = useCallback(() => {
    setProjectState((currentState) => {
      const analysis = currentState.project.analysis
      const result = analysis?.status === 'completed'
        ? analysis.result
        : null

      if (!result) {
        return currentState
      }

      const createdAt = createOperationTimestamp()

      return {
        ...currentState,
        project: {
          ...currentState.project,
          roughCutPlan: createRoughCutPlan(result, createdAt),
          updatedAt: createdAt,
        },
      }
    })
  }, [setProjectState])

  const setRoughCutPlanItemStatus = useCallback((
    itemId: string,
    status: RoughCutPlanItemReviewStatus,
  ) => {
    setProjectState((currentState) => {
      const plan = currentState.project.roughCutPlan
      const item = plan?.items.find((candidate) => candidate.id === itemId)

      if (
        !plan ||
        plan.execution ||
        !item ||
        item.executionStatus !== 'not-applied' ||
        item.reviewStatus === status
      ) {
        return currentState
      }

      return {
        ...currentState,
        project: {
          ...currentState.project,
          roughCutPlan: setRoughCutPlanItemReviewStatus(
            plan,
            itemId,
            status,
          ),
          updatedAt: createOperationTimestamp(),
        },
      }
    })
  }, [setProjectState])

  const setAllRoughCutPlanItemsStatus = useCallback((
    status: RoughCutPlanItemReviewStatus,
  ) => {
    setProjectState((currentState) => {
      const plan = currentState.project.roughCutPlan

      if (
        !plan ||
        plan.execution ||
        plan.items.every((item) => item.reviewStatus === status)
      ) {
        return currentState
      }

      return {
        ...currentState,
        project: {
          ...currentState.project,
          roughCutPlan: setAllRoughCutPlanItemsReviewStatus(plan, status),
          updatedAt: createOperationTimestamp(),
        },
      }
    })
  }, [setProjectState])

  const restoreRoughCutPlanDefaults = useCallback(() => {
    setProjectState((currentState) => {
      const plan = currentState.project.roughCutPlan

      if (
        !plan ||
        plan.execution ||
        plan.items.every(
          (item) => item.reviewStatus === item.defaultReviewStatus,
        )
      ) {
        return currentState
      }

      return {
        ...currentState,
        project: {
          ...currentState.project,
          roughCutPlan: restorePlanDefaults(plan),
          updatedAt: createOperationTimestamp(),
        },
      }
    })
  }, [setProjectState])

  const applyRoughCut = useCallback((
    playheadTime: number,
    sourceAvailable: boolean,
  ) => {
    const createdAt = createOperationTimestamp()
    const result = createRoughCutExecution(
      projectState.project,
      projectState.project.analysis ?? createIdleProjectAnalysisState(),
      {
        sourceAvailable,
        selectionBeforeTimelineItemId:
          projectState.selection.primaryItemId,
        playheadBefore: playheadTime,
        createdAt,
        actionId: createOperationId('rough-cut-action'),
        createId: createOperationId,
      },
    )

    if (!result.valid) {
      return result.reason
    }

    setProjectState((currentState) => {
      if (currentState.project !== projectState.project) {
        return currentState
      }

      const operationState = applyOperationGroup(
        currentState.project.operations,
        result.operationGroup,
      )

      return {
        ...currentState,
        selection: getSelectionState(
          result.selectionAfterTimelineItemId,
        ),
        seekRequest: {
          id: (currentState.seekRequest?.id ?? 0) + 1,
          timelineTime: timelineTime(result.playheadAfter),
          reason: 'rough-cut-apply',
        },
        project: {
          ...currentState.project,
          operations: operationState.operations,
          roughCutPlan: result.planAfter,
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

    return null
  }, [projectState, setProjectState])

  const setReferenceMedia = useCallback((mediaItemId: string) => {
    setProjectState((currentState) => {
      const project = chooseReferenceProjectMedia(
        currentState.project,
        mediaItemId,
      )

      return project === currentState.project
        ? currentState
        : {
            ...currentState,
            project,
          }
    })
  }, [setProjectState])

  const updateMediaDuration = useCallback((
    mediaItemId: string,
    duration: number,
  ) => {
    setProjectState((currentState) => {
      const project = updateProjectMediaDuration(
        currentState.project,
        mediaItemId,
        duration,
      )
      const primaryMediaItemId =
        getPrimaryProjectMediaBinding(project)?.asset.mediaItemId

      return primaryMediaItemId === mediaItemId
        ? addInitialPrimaryTimelineItem(currentState, project)
        : project === currentState.project
          ? currentState
          : {
              ...currentState,
              project,
            }
    })
  }, [setProjectState])

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
  }, [setProjectState])

  const applySplitOperation = useCallback((
    timelineItemId: string,
    splitTime: number,
  ) => {
    setProjectState((currentState) => {
      const splitTarget = buildEditProjection(currentState.project)
        .clipsById[timelineItemId]
      const createdAt = createOperationTimestamp()
      const splitOperation = splitTarget
        ? createSplitOperation(
            {
              timelineItemId: splitTarget.timelineItemId,
              timelineRange: splitTarget.timelineRange,
            },
            splitTime,
            {
              operationId: createOperationId('split'),
              leftTimelineItemId: createOperationId('timeline-item'),
              rightTimelineItemId: createOperationId('timeline-item'),
            },
            createdAt,
          )
        : null

      if (!splitOperation) {
        return currentState
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
        selection: getSelectionState(splitOperation.rightTimelineItemId),
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
  }, [setProjectState])

  const applyRippleDeleteOperation = useCallback((
    timelineItemId: string,
    playheadTime: number,
  ) => {
    setProjectState((currentState) => {
      if (
        currentState.selection.primaryItemId !== timelineItemId ||
        !Number.isFinite(playheadTime)
      ) {
        return currentState
      }

      const projection = buildEditProjection(currentState.project)
      const validation = getRippleDeleteValidation(
        currentState.project,
        projection,
        timelineItemId,
      )

      if (!validation.valid) {
        return currentState
      }

      const createdAt = createOperationTimestamp()
      const rippleDeleteOperation = createRippleDeleteOperation(
        validation.plan,
        {
          operationId: createOperationId('ripple-delete'),
          createdAt,
          selectionBeforeTimelineItemId:
            currentState.selection.primaryItemId,
          playheadTime,
        },
      )

      if (!rippleDeleteOperation) {
        return currentState
      }

      const operationGroup: EditOperationGroup = {
        actionId: createOperationId('ripple-delete-action'),
        operations: [rippleDeleteOperation],
      }
      const operationState = applyOperationGroup(
        currentState.project.operations,
        operationGroup,
      )

      return {
        ...currentState,
        selection: getSelectionState(
          rippleDeleteOperation.selectionAfterTimelineItemId,
        ),
        seekRequest: createRippleSeekRequest(
          currentState,
          rippleDeleteOperation.playheadAfter,
        ),
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
  }, [setProjectState])

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
  }, [setProjectState])

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
  }, [setProjectState])

  const undo = useCallback(() => {
    setProjectState((currentState) => {
      const operation = currentState.project.history.undoStack.at(-1)

      if (!operation) {
        return currentState
      }
      const operationIds = new Set(operation.operations.map((item) => item.id))
      const selectedTimelineItemId = getUndoSelection(
        currentState.selection.primaryItemId,
        operation,
      )

      return {
        ...currentState,
        selection: getSelectionState(selectedTimelineItemId),
        seekRequest: getHistorySeekRequest(
          currentState,
          operation,
          'undo',
        ),
        project: {
          ...currentState.project,
          operations: currentState.project.operations.filter(
            (item) => !operationIds.has(item.id),
          ),
          roughCutPlan:
            operation.roughCutExecution?.planBefore ??
            currentState.project.roughCutPlan,
          history: {
            ...currentState.project.history,
            undoStack: currentState.project.history.undoStack.slice(0, -1),
            redoStack: [...currentState.project.history.redoStack, operation],
          },
          updatedAt: createOperationTimestamp(),
        },
      }
    })
  }, [setProjectState])

  const redo = useCallback(() => {
    setProjectState((currentState) => {
      const operation = currentState.project.history.redoStack.at(-1)

      if (!operation) {
        return currentState
      }
      const selectedTimelineItemId = getRedoSelection(
        currentState.selection.primaryItemId,
        operation,
      )

      return {
        ...currentState,
        selection: getSelectionState(selectedTimelineItemId),
        seekRequest: getHistorySeekRequest(
          currentState,
          operation,
          'redo',
        ),
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
          roughCutPlan:
            operation.roughCutExecution?.planAfter ??
            currentState.project.roughCutPlan,
          history: {
            ...currentState.project.history,
            undoStack: [...currentState.project.history.undoStack, operation],
            redoStack: currentState.project.history.redoStack.slice(0, -1),
          },
          updatedAt: createOperationTimestamp(),
        },
      }
    })
  }, [setProjectState])

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
      setTimelineZoom,
      setOutputSettings,
      registerMediaAssets,
      updateMediaDuration,
      setPrimaryMedia,
      setReferenceMedia,
      swapPrimaryAndReference,
      clearReferenceMedia,
      removeProjectMediaAsset,
      connectProjectMedia,
      startProjectAnalysis,
      completeProjectAnalysis,
      failProjectAnalysis,
      retryProjectAnalysis,
      rebuildRoughCutPlan,
      setRoughCutPlanItemStatus,
      setAllRoughCutPlanItemsStatus,
      restoreRoughCutPlanDefaults,
      applyRoughCut,
      applyTrimOperation,
      applySplitOperation,
      applyRippleDeleteOperation,
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
      setTimelineZoom,
      setOutputSettings,
      registerMediaAssets,
      updateMediaDuration,
      setPrimaryMedia,
      setReferenceMedia,
      swapPrimaryAndReference,
      clearReferenceMedia,
      removeProjectMediaAsset,
      connectProjectMedia,
      startProjectAnalysis,
      completeProjectAnalysis,
      failProjectAnalysis,
      retryProjectAnalysis,
      rebuildRoughCutPlan,
      setRoughCutPlanItemStatus,
      setAllRoughCutPlanItemsStatus,
      restoreRoughCutPlanDefaults,
      applyRoughCut,
      applyTrimOperation,
      applySplitOperation,
      applyRippleDeleteOperation,
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
