import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { AssistantPanel } from './components/assistant/AssistantPanel'
import { HelpPanel } from './components/help/HelpPanel'
import { AppHeader } from './components/layout/AppHeader'
import { ProjectSidebar } from './components/project/ProjectSidebar'
import { VideoWorkspace } from './components/project/VideoWorkspace'
import { ReviewPanel } from './components/review/ReviewPanel'
import { InspectorPanel } from './components/inspector/InspectorPanel'
import { initialProjectState } from './data/stages'
import { helpContent } from './data/helpContent'
import { useMediaLibrary } from './hooks/useMediaLibrary'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import { useTheme } from './hooks/useTheme'
import {
  buildEditProjection,
} from './selectors/editProjection'
import {
  getProjectedSuggestions,
} from './selectors/editSelectors'
import { getInspectorSelection } from './selectors/inspectorSelectors'
import {
  getAnalysisReviewPresentation,
  getAnalysisTimelineOverlays,
  getRoughCutCandidates,
  type AnalysisSeekTarget,
} from './selectors/analysisReviewSelectors'
import {
  getMediaLibraryAssetPresentations,
  getTimelineClipThumbnailPresentations,
  getTimelineClipMediaPresentations,
} from './selectors/mediaAssetSelectors'
import { canRippleDeleteTimelineItem } from './selectors/rippleDeleteSelectors'
import {
  usePlaybackControls,
  usePlaybackEngine,
} from './playback/PlaybackStore'
import { checkBackendHealth } from './services/api'
import { useProject } from './state/useProject'
import {
  getPrimaryProjectMediaAsset,
  getReferenceProjectMediaAsset,
  type ProjectMediaDescriptor,
} from './state/ProjectMedia'
import { createIdleProjectAnalysisState } from './analysis/models'
import { useProjectAnalysisPipeline } from './analysis/useProjectAnalysisPipeline'
import { applyProjectAnalysisToPrimaryMedia } from './selectors/projectAnalysisSelectors'
import {
  getRoughCutExecutionPresentation,
  getRoughCutPlanPresentation,
  type RoughCutPlanItemPresentation,
} from './planner/plannerSelectors'
import { getRoughCutExecutionPreview } from './execution/RoughCutExecutor'
import type { MediaItem, ProjectOutputSettings } from './types'
import { applyPlatformDefaults } from './utils/projectSettings'
import {
  hasPlayableSource,
  matchesPersistedMediaFile,
} from './utils/mediaSource'
import {
  createReviewVersion,
  deleteSelectedSubstageVersion,
  duplicateSelectedSubstageVersion,
  ensureProjectState,
  getProjectStats,
  getSelectedStage,
  getSelectedSubstage,
  keepOnlySelectedSubstageVersion,
  renameSelectedSubstageVersion,
  restoreSelectedSubstageVersion,
  setSelectedSubstageStatus,
  updateSelectedSubstageComment,
} from './utils/projectState'

const projectStorageKey = 'ai-video-director-project-state-v2'
const videoExtensions = new Set(['mp4', 'mov', 'm4v', 'webm', 'mkv'])

function isVideoFile(file: File) {
  return file.type.startsWith('video/') ||
    videoExtensions.has(file.name.split('.').pop()?.toLowerCase() ?? '')
}

function createProjectMediaDescriptor(mediaItem: MediaItem): ProjectMediaDescriptor {
  return {
    id: mediaItem.id,
    filename: mediaItem.filename,
    duration: mediaItem.metadata?.duration,
    fileSize: mediaItem.size,
    mimeType: mediaItem.file?.type || undefined,
    lastModified: mediaItem.lastModified,
  }
}

type PendingMediaRoleAction =
  | {
      kind: 'set-primary' | 'swap-primary-reference' | 'remove-main' | 'remove-library'
      mediaItemId: string
      filename: string
    }
  | null

// Coordinates application-wide project, media, review, and AI suggestion state.
function App() {
  const { themePreference, setThemePreference } = useTheme()
  const [projectState, setProjectState] = useLocalStorageState(
    projectStorageKey,
    initialProjectState,
    ensureProjectState,
  )
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [assistantDraftQuestion, setAssistantDraftQuestion] = useState('')
  const [openHelpId, setOpenHelpId] = useState<string | null>(null)
  const [isBackendConnected, setIsBackendConnected] = useState(false)
  const [previewMode, setPreviewMode] = useState<'source' | 'timeline'>(
    'timeline',
  )
  const [isPrimarySourceConnecting, setIsPrimarySourceConnecting] = useState(false)
  const [primarySourceError, setPrimarySourceError] = useState<string | null>(null)
  const [activeRoughCutPlanItemId, setActiveRoughCutPlanItemId] = useState<
    string | null
  >(null)
  const [previewRoughCutPlanItemId, setPreviewRoughCutPlanItemId] = useState<
    string | null
  >(null)
  const [pendingMediaRoleAction, setPendingMediaRoleAction] =
    useState<PendingMediaRoleAction>(null)
  const {
    project,
    selectedSuggestionIds,
    activeSuggestionId,
    selectedTimelineItemId,
    seekRequest,
    timelineViewport,
    activateSuggestion,
    toggleSuggestionSelection,
    selectSuggestions,
    updateSuggestionStatuses,
    selectTimelineItem,
    clearSelection,
    setTimelineZoom,
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
    outputSettings,
    setOutputSettings,
    applyTrimOperation,
    applySplitOperation,
    applyRippleDeleteOperation,
    applyDeleteOperation,
    applyMoveOperation,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useProject()
  const {
    toggle: togglePlayback,
    seek: seekPlayback,
  } = usePlaybackControls()
  const playbackEngine = usePlaybackEngine()
  const {
    items: mediaItems,
    activeItem: activeMediaItem,
    activeItemId: activeMediaItemId,
    fileRejections,
    addFiles,
    selectItem,
    removeItem,
    restorePersistedItems,
  } = useMediaLibrary(setIsBackendConnected)

  const selectedStage = useMemo(
    () => getSelectedStage(projectState),
    [projectState],
  )
  const selectedSubstage = useMemo(
    () => getSelectedSubstage(projectState),
    [projectState],
  )
  const stats = useMemo(
    () => getProjectStats(projectState.stages),
    [projectState.stages],
  )
  const editProjection = useMemo(
    () => buildEditProjection(project),
    [project],
  )
  const primaryMediaAsset = useMemo(
    () => getPrimaryProjectMediaAsset(project),
    [project],
  )
  const referenceMediaAsset = useMemo(
    () => getReferenceProjectMediaAsset(project),
    [project],
  )
  const primaryMediaItemId =
    primaryMediaAsset?.mediaItemId ?? null
  const referenceMediaItemId =
    referenceMediaAsset?.mediaItemId ?? null
  const persistedMediaItems = useMemo(
    () => project.assets
      .filter(
        (asset) => asset.type === 'video' && Boolean(asset.mediaItemId),
      )
      .map((asset) => ({
        id: asset.mediaItemId as string,
        filename: asset.filename,
        type: asset.type,
        size: asset.fileSize,
        lastModified: asset.lastModified,
      })),
    [project.assets],
  )
  const primaryMediaItem = mediaItems.find(
    (mediaItem) => mediaItem.id === primaryMediaItemId,
  ) ?? null
  const projectAnalysis = project.analysis ??
    createIdleProjectAnalysisState()
  const analyzedPrimaryMediaItem = useMemo(
    () => applyProjectAnalysisToPrimaryMedia(
      primaryMediaItem,
      projectAnalysis,
    ),
    [primaryMediaItem, projectAnalysis],
  )
  const timelineClipMediaPresentations = useMemo(
    () => getTimelineClipMediaPresentations(project, editProjection),
    [editProjection, project],
  )
  const timelineClipThumbnailPresentations = useMemo(
    () => getTimelineClipThumbnailPresentations(
      project,
      editProjection,
      mediaItems,
    ),
    [editProjection, mediaItems, project],
  )
  const mediaLibraryAssetPresentations = useMemo(
    () => getMediaLibraryAssetPresentations(
      project,
      editProjection,
      mediaItems.map((mediaItem) => mediaItem.id),
    ),
    [editProjection, mediaItems, project],
  )
  const inspectorSelection = useMemo(
    () => getInspectorSelection(project, editProjection, selectedTimelineItemId),
    [editProjection, project, selectedTimelineItemId],
  )
  const analysisReviewPresentation = useMemo(
    () => getAnalysisReviewPresentation(
      projectAnalysis,
      editProjection,
      primaryMediaItem?.previews?.previews ?? [],
    ),
    [editProjection, primaryMediaItem?.previews?.previews, projectAnalysis],
  )
  const analysisTimelineOverlays = useMemo(
    () => getAnalysisTimelineOverlays(projectAnalysis, editProjection),
    [editProjection, projectAnalysis],
  )
  const roughCutCandidates = useMemo(
    () => getRoughCutCandidates(projectAnalysis, editProjection),
    [editProjection, projectAnalysis],
  )
  const roughCutPlanPresentation = useMemo(
    () => getRoughCutPlanPresentation(
      project.roughCutPlan,
      projectAnalysis.result,
      editProjection,
    ),
    [editProjection, project.roughCutPlan, projectAnalysis.result],
  )
  const isPrimarySourceAvailable = Boolean(
    primaryMediaItem && hasPlayableSource(primaryMediaItem),
  )
  const roughCutExecutionPreview = useMemo(
    () => getRoughCutExecutionPreview(
      project,
      projectAnalysis,
      editProjection,
      isPrimarySourceAvailable,
    ),
    [
      editProjection,
      isPrimarySourceAvailable,
      project,
      projectAnalysis,
    ],
  )
  const roughCutExecutionPresentation = useMemo(
    () => getRoughCutExecutionPresentation(
      roughCutExecutionPreview,
      project.roughCutPlan,
    ),
    [project.roughCutPlan, roughCutExecutionPreview],
  )
  const activeRoughCutPlanItem = roughCutPlanPresentation.items.find(
    (item) => item.item.id === activeRoughCutPlanItemId,
  ) ?? null
  const previewRoughCutPlanItem = roughCutPlanPresentation.items.find(
    (item) => item.item.id === previewRoughCutPlanItemId,
  ) ?? activeRoughCutPlanItem
  const selectedComputedClip = inspectorSelection?.computedClip ?? null
  const canRippleDelete = useMemo(
    () => canRippleDeleteTimelineItem(
      project,
      editProjection,
      selectedTimelineItemId,
    ),
    [editProjection, project, selectedTimelineItemId],
  )
  const reviewSuggestions = useMemo(
    () => getProjectedSuggestions(project),
    [project],
  )
	  const activeHelpContent = openHelpId ? helpContent[openHelpId] : null

  useProjectAnalysisPipeline({
    sourceAssetId: primaryMediaAsset?.id ?? null,
    primaryItem: primaryMediaItem,
    analysis: projectAnalysis,
    onStart: startProjectAnalysis,
    onComplete: completeProjectAnalysis,
    onFail: failProjectAnalysis,
  })

  useEffect(() => {
    void checkBackendHealth().then(setIsBackendConnected)
  }, [])

  useEffect(() => {
    registerMediaAssets(
      mediaItems
        .filter((mediaItem) => mediaItem.type === 'video')
        .map(createProjectMediaDescriptor),
    )
  }, [mediaItems, registerMediaAssets])

  useEffect(() => {
    restorePersistedItems(persistedMediaItems)
  }, [persistedMediaItems, restorePersistedItems])

  useEffect(() => {
    if (isPrimarySourceConnecting && primaryMediaItem && hasPlayableSource(primaryMediaItem)) {
      setIsPrimarySourceConnecting(false)
      setPrimarySourceError(null)
    }
  }, [isPrimarySourceConnecting, primaryMediaItem])

  const handleMediaFilesAdd = useCallback((files: FileList) => {
    if (isPrimarySourceConnecting) {
      return
    }

    const primaryNeedsReconnect = Boolean(
      primaryMediaItem && !hasPlayableSource(primaryMediaItem),
    )
    const candidateFile = Array.from(files).find(
      (file) => isVideoFile(file) &&
        primaryMediaItem &&
        matchesPersistedMediaFile(primaryMediaItem, file),
    )

    if (primaryNeedsReconnect && candidateFile) {
      setIsPrimarySourceConnecting(true)
      setPrimarySourceError(null)
    }

    const importedItems = addFiles(files)

    for (const item of importedItems) {
      if (item.type === 'video') {
        connectProjectMedia(createProjectMediaDescriptor(item))
      }
    }
  }, [
    addFiles,
    connectProjectMedia,
    isPrimarySourceConnecting,
    primaryMediaItem,
  ])

  const handleMediaSelect = useCallback((mediaItemId: string) => {
    selectItem(mediaItemId)
    clearSelection()
    setPreviewMode('source')
  }, [clearSelection, selectItem])

  const handlePrimaryMediaChoose = useCallback((mediaItemId: string) => {
    const item = mediaItems.find((candidate) => candidate.id === mediaItemId)

    if (!item) {
      return
    }

    if (primaryMediaItemId && primaryMediaItemId !== mediaItemId) {
      setPendingMediaRoleAction({
        kind: 'set-primary',
        mediaItemId,
        filename: item.filename,
      })
      return
    }

    setPrimaryMedia(mediaItemId)
    selectItem(mediaItemId)
    setPreviewMode('timeline')
  }, [mediaItems, primaryMediaItemId, selectItem, setPrimaryMedia])

  const handleReferenceMediaChoose = useCallback((mediaItemId: string) => {
    setReferenceMedia(mediaItemId)
    selectItem(mediaItemId)
    clearSelection()
    setPreviewMode('source')
  }, [clearSelection, selectItem, setReferenceMedia])

  const handleSwapPrimaryAndReference = useCallback(() => {
    if (!primaryMediaItemId || !referenceMediaItemId) {
      return
    }

    const referenceItem = mediaItems.find(
      (item) => item.id === referenceMediaItemId,
    )

    if (!referenceItem) {
      return
    }

    setPendingMediaRoleAction({
      kind: 'swap-primary-reference',
      mediaItemId: referenceItem.id,
      filename: referenceItem.filename,
    })
  }, [mediaItems, primaryMediaItemId, referenceMediaItemId])

  const handleClearReference = useCallback(() => {
    const wasActiveReference = activeMediaItemId === referenceMediaItemId

    clearReferenceMedia()

    if (wasActiveReference && primaryMediaItemId) {
      selectItem(primaryMediaItemId)
      setPreviewMode('timeline')
    }
  }, [
    activeMediaItemId,
    clearReferenceMedia,
    primaryMediaItemId,
    referenceMediaItemId,
    selectItem,
  ])

  const handleMediaRemoveRequest = useCallback((mediaItemId: string) => {
    const item = mediaItems.find((candidate) => candidate.id === mediaItemId)

    if (!item) {
      return
    }

    setPendingMediaRoleAction({
      kind: mediaItemId === primaryMediaItemId
        ? 'remove-main'
        : 'remove-library',
      mediaItemId,
      filename: item.filename,
    })
  }, [mediaItems, primaryMediaItemId])

  const handleConfirmMediaRoleAction = useCallback(() => {
    const action = pendingMediaRoleAction

    if (!action) {
      return
    }

    if (action.kind === 'set-primary') {
      setPrimaryMedia(action.mediaItemId)
      selectItem(action.mediaItemId)
      setPreviewMode('timeline')
    }

    if (action.kind === 'swap-primary-reference') {
      swapPrimaryAndReference()
      selectItem(action.mediaItemId)
      setPreviewMode('timeline')
    }

    if (action.kind === 'remove-main' || action.kind === 'remove-library') {
      const wasPrimary = action.mediaItemId === primaryMediaItemId
      const wasReference = action.mediaItemId === referenceMediaItemId

      removeProjectMediaAsset(action.mediaItemId)
      removeItem(action.mediaItemId)

      if (wasPrimary) {
        setPreviewMode('timeline')
      } else if (wasReference && primaryMediaItemId) {
        selectItem(primaryMediaItemId)
        setPreviewMode('timeline')
      }
    }

    setPendingMediaRoleAction(null)
  }, [
    pendingMediaRoleAction,
    primaryMediaItemId,
    referenceMediaItemId,
    removeItem,
    removeProjectMediaAsset,
    selectItem,
    setPrimaryMedia,
    swapPrimaryAndReference,
  ])

  const handleTimelineItemSelect = useCallback(
    (timelineItemId: string | null) => {
      selectTimelineItem(timelineItemId)

      if (timelineItemId) {
        setPreviewMode('timeline')
        if (primaryMediaItemId) {
          selectItem(primaryMediaItemId)
        }
      }
    },
    [primaryMediaItemId, selectItem, selectTimelineItem],
  )

  const handleTimelinePreviewRequest = useCallback(() => {
    setPreviewMode('timeline')
    if (primaryMediaItemId) {
      selectItem(primaryMediaItemId)
    }
  }, [primaryMediaItemId, selectItem])

  const handleAnalysisSeek = useCallback((target: AnalysisSeekTarget) => {
    if (target.timelineTime === null) {
      return
    }

    setPreviewMode('timeline')
    if (primaryMediaItemId) {
      selectItem(primaryMediaItemId)
    }
    seekPlayback(target.timelineTime)
  }, [primaryMediaItemId, seekPlayback, selectItem])

  const handleRoughCutPlanItemActivate = useCallback((
    item: RoughCutPlanItemPresentation,
  ) => {
    setActiveRoughCutPlanItemId(item.item.id)
    setPreviewRoughCutPlanItemId(null)
    handleAnalysisSeek(item.seekTarget)
  }, [handleAnalysisSeek])

  const handleRoughCutPlanItemPreview = useCallback((
    item: RoughCutPlanItemPresentation | null,
  ) => {
    setPreviewRoughCutPlanItemId(item?.item.id ?? null)
  }, [])

  const handleApplyRoughCut = useCallback(() => {
    const result = applyRoughCut(
      playbackEngine.getCurrentTime(),
      isPrimarySourceAvailable,
    )

    if (!result) {
      setPreviewMode('timeline')
      if (primaryMediaItemId) {
        selectItem(primaryMediaItemId)
      }
    }

    return result
  }, [
    applyRoughCut,
    isPrimarySourceAvailable,
    playbackEngine,
    primaryMediaItemId,
    selectItem,
  ])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) {
        return
      }

      if (
        event.code === 'Space' &&
        previewMode === 'timeline' &&
        !event.repeat &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isInteractiveShortcutTarget(event.target)
      ) {
        event.preventDefault()
        togglePlayback()
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        clearSelection()
        return
      }

      if (event.key === 'Delete' && selectedComputedClip) {
        event.preventDefault()
        applyDeleteOperation(
          selectedComputedClip.timelineItemId,
          0,
          selectedComputedClip.segmentEnd - selectedComputedClip.segmentStart,
        )
        return
      }

      if (
        event.key.toLowerCase() !== 'z' ||
        (!event.metaKey && !event.ctrlKey)
      ) {
        return
      }

      if (event.shiftKey) {
        if (canRedo) {
          event.preventDefault()
          redo()
        }
        return
      }

      if (canUndo) {
        event.preventDefault()
        undo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    applyDeleteOperation,
    canRedo,
    canUndo,
    clearSelection,
    redo,
    selectedComputedClip,
    togglePlayback,
    undo,
    previewMode,
  ])

  const handleStageSelect = (stageId: string, substageId?: string) => {
    setProjectState((currentState) => {
      const stage = currentState.stages.find((item) => item.id === stageId)

      if (!stage) {
        return currentState
      }

      return {
        ...currentState,
        selectedStageId: stage.id,
        selectedSubstageId: substageId ?? stage.substages[0].id,
        expandedStageIds: currentState.expandedStageIds.includes(stage.id)
          ? currentState.expandedStageIds
          : [...currentState.expandedStageIds, stage.id],
      }
    })
  }

  const handleStageToggle = (stageId: string) => {
    setProjectState((currentState) => ({
      ...currentState,
      expandedStageIds: currentState.expandedStageIds.includes(stageId)
        ? currentState.expandedStageIds.filter((id) => id !== stageId)
        : [...currentState.expandedStageIds, stageId],
    }))
  }

	  const handleOutputSettingsChange = (settings: ProjectOutputSettings) => {
	    setOutputSettings(
        settings.platform !== outputSettings.platform
          ? applyPlatformDefaults(settings, settings.platform)
          : settings,
      )
	  }

  const handleReconnectMediaSource = () => {
    if (!isPrimarySourceConnecting) {
      document.getElementById('media-upload')?.click()
    }
  }

  return (
    <div className="app-shell">
      <AppHeader
        themePreference={themePreference}
        isBackendConnected={isBackendConnected}
        onThemeChange={setThemePreference}
        onAssistantOpen={() => setIsAssistantOpen(true)}
      />
      <main
        className="director-layout"
        aria-label="Рабочая область монтажа"
      >
        <ProjectSidebar
          stages={projectState.stages}
          selectedStageId={projectState.selectedStageId}
          selectedSubstageId={projectState.selectedSubstageId}
          expandedStageIds={projectState.expandedStageIds}
          mediaItems={mediaItems}
          activeMediaItemId={activeMediaItemId}
          primaryAsset={primaryMediaAsset}
          referenceAsset={referenceMediaAsset}
          primaryMediaItemId={primaryMediaItemId}
          referenceMediaItemId={referenceMediaItemId}
          analysis={projectAnalysis}
          isPrimarySourceAvailable={isPrimarySourceAvailable}
          onAnalysisRetry={retryProjectAnalysis}
          isPrimarySourceConnecting={isPrimarySourceConnecting}
          primarySourceError={primarySourceError}
          assetPresentations={mediaLibraryAssetPresentations}
          fileRejections={fileRejections}
          outputSettings={outputSettings}
          stats={stats}
          openHelpId={openHelpId}
          onFilesAdd={handleMediaFilesAdd}
          onMediaSelect={handleMediaSelect}
          onPrimaryMediaChoose={handlePrimaryMediaChoose}
          onReferenceMediaChoose={handleReferenceMediaChoose}
          onSwapPrimaryAndReference={handleSwapPrimaryAndReference}
          onClearReference={handleClearReference}
          onReconnectMedia={handleReconnectMediaSource}
          onMediaRemove={handleMediaRemoveRequest}
          onOutputSettingsChange={handleOutputSettingsChange}
          onStageSelect={handleStageSelect}
          onStageToggle={handleStageToggle}
          onHelpOpenChange={(helpId, isOpen) =>
            setOpenHelpId(isOpen ? helpId : null)
          }
        />
        <HelpPanel
          content={activeHelpContent}
          onClose={() => setOpenHelpId(null)}
          onExplainMore={(helpTitle) => {
            setAssistantDraftQuestion(
              `Расскажи подробнее про этот этап: ${helpTitle}`,
            )
            setIsAssistantOpen(true)
          }}
        />
			        <VideoWorkspace
            primaryItem={analyzedPrimaryMediaItem}
            hasPrimaryAsset={Boolean(primaryMediaAsset)}
            sourcePreviewItem={activeMediaItem}
	          outputSettings={outputSettings}
	          selectedSubstage={selectedSubstage}
            aiSuggestions={reviewSuggestions}
            computedClips={editProjection.clips}
            editProjection={editProjection}
            clipMediaPresentations={timelineClipMediaPresentations}
            clipThumbnailPresentations={timelineClipThumbnailPresentations}
            analysis={projectAnalysis.result}
            analysisReviewPresentation={analysisReviewPresentation}
            analysisTimelineOverlays={analysisTimelineOverlays}
            roughCutCandidates={roughCutCandidates}
            roughCutPlanPresentation={roughCutPlanPresentation}
            roughCutExecutionPresentation={
              roughCutExecutionPresentation
            }
            activeRoughCutPlanItemId={activeRoughCutPlanItemId}
            activeAnalysisTranscriptSegmentId={
              previewRoughCutPlanItem?.relatedTranscriptSegmentId ?? null
            }
            activeAnalysisSilenceId={
              previewRoughCutPlanItem?.item.analysisSourceId ?? null
            }
            activeAnalysisSceneId={
              previewRoughCutPlanItem?.relatedSceneId ?? null
            }
            selectedAISuggestionIds={selectedSuggestionIds}
            activeAISuggestionId={activeSuggestionId}
            selectedTimelineItemId={selectedTimelineItemId}
            previewMode={previewMode}
            seekRequest={seekRequest}
            timelineZoom={timelineViewport.zoom}
		          onReconnectSource={handleReconnectMediaSource}
            isPrimarySourceConnecting={isPrimarySourceConnecting}
            primarySourceError={primarySourceError}
            onTimelinePreviewRequest={handleTimelinePreviewRequest}
            onAnalysisSeek={handleAnalysisSeek}
            onRoughCutPlanItemActivate={handleRoughCutPlanItemActivate}
            onRoughCutPlanItemPreview={handleRoughCutPlanItemPreview}
            onRoughCutPlanItemStatusChange={setRoughCutPlanItemStatus}
            onAllRoughCutPlanItemsStatusChange={setAllRoughCutPlanItemsStatus}
            onRestoreRoughCutPlanDefaults={restoreRoughCutPlanDefaults}
            onRebuildRoughCutPlan={rebuildRoughCutPlan}
            onApplyRoughCut={handleApplyRoughCut}
            onAISuggestionActivate={activateSuggestion}
            onTimelineItemSelect={handleTimelineItemSelect}
            onTimelineZoomChange={setTimelineZoom}
            onMediaDurationChange={updateMediaDuration}
            onTrimCommit={applyTrimOperation}
            onSplitCommit={applySplitOperation}
            canRippleDelete={canRippleDelete}
            onRippleDeleteCommit={applyRippleDeleteOperation}
            onMoveCommit={applyMoveOperation}
	        />
        <InspectorPanel selection={inspectorSelection} />
        <ReviewPanel
          stage={selectedStage}
          substage={selectedSubstage}
          aiSuggestions={reviewSuggestions}
          selectedAISuggestionIds={selectedSuggestionIds}
          activeAISuggestionId={activeSuggestionId}
          onAccept={() =>
            setProjectState((currentState) =>
              setSelectedSubstageStatus(
                currentState,
                'approved',
                'Подэтап принят пользователем',
              ),
            )
          }
          onCommentChange={(comment) =>
            setProjectState((currentState) =>
              updateSelectedSubstageComment(currentState, comment),
            )
          }
          onCreateReview={() =>
            setProjectState((currentState) => createReviewVersion(currentState))
          }
          onRequestChanges={() =>
            setProjectState((currentState) =>
              setSelectedSubstageStatus(
                currentState,
                'revision',
                'Отправлено на доработку',
              ),
            )
          }
          onRestoreVersion={(versionId) =>
            setProjectState((currentState) =>
              restoreSelectedSubstageVersion(currentState, versionId),
            )
          }
          onViewVersion={(versionId) =>
            setProjectState((currentState) =>
              restoreSelectedSubstageVersion(currentState, versionId),
            )
          }
          onRenameVersion={(versionId, description) =>
            setProjectState((currentState) =>
              renameSelectedSubstageVersion(currentState, versionId, description),
            )
          }
          onDuplicateVersion={(versionId) =>
            setProjectState((currentState) =>
              duplicateSelectedSubstageVersion(currentState, versionId),
            )
          }
          onDeleteVersion={(versionId) =>
            setProjectState((currentState) =>
              deleteSelectedSubstageVersion(currentState, versionId),
            )
          }
          onKeepOnlyVersion={(versionId) =>
            setProjectState((currentState) =>
              keepOnlySelectedSubstageVersion(currentState, versionId),
            )
          }
          onAISuggestionActivate={activateSuggestion}
          onAISuggestionSelectionToggle={toggleSuggestionSelection}
          onAISuggestionsSelect={selectSuggestions}
          onAISuggestionAccept={(suggestionId) =>
            updateSuggestionStatuses([suggestionId], 'accepted')
          }
          onAISuggestionReject={(suggestionId) =>
            updateSuggestionStatuses([suggestionId], 'rejected')
          }
          onAISuggestionsAccept={(suggestionIds) =>
            updateSuggestionStatuses(suggestionIds, 'accepted')
          }
          onAISuggestionsReject={(suggestionIds) =>
            updateSuggestionStatuses(suggestionIds, 'rejected')
          }
        />
      </main>
      <AssistantPanel
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        draftQuestion={assistantDraftQuestion}
      />
      {pendingMediaRoleAction ? (
        <MediaRoleConfirmationDialog
          action={pendingMediaRoleAction}
          onCancel={() => setPendingMediaRoleAction(null)}
          onConfirm={handleConfirmMediaRoleAction}
        />
      ) : null}
    </div>
  )
}

function MediaRoleConfirmationDialog({
  action,
  onCancel,
  onConfirm,
}: {
  action: Exclude<PendingMediaRoleAction, null>
  onCancel: () => void
  onConfirm: () => void
}) {
  const isMainChange = action.kind === 'set-primary' ||
    action.kind === 'swap-primary-reference'
  const isMainRemoval = action.kind === 'remove-main'
  const title = isMainChange
    ? 'Сменить главное видео?'
    : isMainRemoval
      ? 'Удалить главное видео?'
      : `Удалить «${action.filename}» из медиатеки?`
  const description = isMainChange
    ? 'Текущий таймлайн и черновой монтаж относятся к другому видео. Для нового главного видео будет создан новый таймлайн и новый анализ.'
    : isMainRemoval
      ? 'Будут очищены таймлайн, история правок, анализ и черновой монтаж. Остальные видео останутся в медиатеке.'
      : 'Файл будет удалён из медиатеки проекта. Это не затронет другие видео.'
  const confirmLabel = isMainChange
    ? 'Сменить главное видео'
    : isMainRemoval
      ? 'Удалить главное видео'
      : 'Удалить'

  return (
    <div className="media-role-dialog-backdrop" role="presentation">
      <section
        className="media-role-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-role-dialog-title"
        aria-describedby="media-role-dialog-description"
      >
        <h2 id="media-role-dialog-title">{title}</h2>
        <p id="media-role-dialog-description">{description}</p>
        <div className="media-role-dialog-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="button"
            className={isMainRemoval || action.kind === 'remove-library'
              ? 'danger-button'
              : 'primary-button'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  )
}

function isInteractiveShortcutTarget(target: EventTarget | null) {
  return target instanceof HTMLElement &&
    Boolean(target.closest('button, a, summary'))
}

export default App
