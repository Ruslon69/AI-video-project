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
  getMediaLibraryAssetPresentations,
  getTimelineClipThumbnailPresentations,
  getTimelineClipMediaPresentations,
} from './selectors/mediaAssetSelectors'
import { canRippleDeleteTimelineItem } from './selectors/rippleDeleteSelectors'
import { usePlaybackControls } from './playback/PlaybackStore'
import { checkBackendHealth } from './services/api'
import { useProject } from './state/useProject'
import {
  canChoosePrimaryMedia,
  canChooseReferenceMedia,
  getPrimaryMediaReconnectError,
  getPrimaryProjectMediaBinding,
  getReferenceProjectMediaBinding,
  type ProjectMediaDescriptor,
} from './state/ProjectMedia'
import { createIdleProjectAnalysisState } from './analysis/models'
import { useProjectAnalysisPipeline } from './analysis/useProjectAnalysisPipeline'
import { applyProjectAnalysisToPrimaryMedia } from './selectors/projectAnalysisSelectors'
import type { MediaItem, ProjectOutputSettings } from './types'
import { applyPlatformDefaults } from './utils/projectSettings'
import { hasPlayableSource } from './utils/mediaSource'
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

function createFileDescriptor(file: File): Omit<ProjectMediaDescriptor, 'id'> {
  return {
    filename: file.name,
    fileSize: file.size,
    mimeType: file.type || undefined,
    lastModified: file.lastModified,
  }
}

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
    choosePrimaryMedia,
    connectPrimaryMedia,
    chooseReferenceMedia,
    startProjectAnalysis,
    completeProjectAnalysis,
    failProjectAnalysis,
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
  const { toggle: togglePlayback } = usePlaybackControls()
  const {
    items: mediaItems,
    activeItem: activeMediaItem,
    activeItemId: activeMediaItemId,
    fileRejections,
    addFiles,
    selectItem,
    removeItem,
    clearLibrary,
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
  const primaryMediaBinding = useMemo(
    () => getPrimaryProjectMediaBinding(project),
    [project],
  )
  const referenceMediaBinding = useMemo(
    () => getReferenceProjectMediaBinding(project),
    [project],
  )
  const primaryMediaItemId =
    primaryMediaBinding?.asset.mediaItemId ?? null
  const referenceMediaItemId =
    referenceMediaBinding?.asset.mediaItemId ?? null
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
  const primaryCandidateItemIds = useMemo(
    () => mediaItems
      .filter(
        (mediaItem) =>
          mediaItem.type === 'video' &&
          canChoosePrimaryMedia(project, mediaItem.id),
      )
      .map((mediaItem) => mediaItem.id),
    [mediaItems, project],
  )
  const referenceCandidateItemIds = useMemo(
    () => mediaItems
      .filter(
        (mediaItem) =>
          mediaItem.type === 'video' &&
          canChooseReferenceMedia(project, mediaItem.id),
      )
      .map((mediaItem) => mediaItem.id),
    [mediaItems, project],
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
    sourceAssetId: primaryMediaBinding?.asset.id ?? null,
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
    if (isPrimarySourceConnecting && primaryMediaItem && hasPlayableSource(primaryMediaItem)) {
      setIsPrimarySourceConnecting(false)
      setPrimarySourceError(null)
    }
  }, [isPrimarySourceConnecting, primaryMediaItem])

  const handleMediaFilesAdd = useCallback((files: FileList) => {
    if (isPrimarySourceConnecting) {
      return
    }

    const shouldConnectPrimary = !primaryMediaItem
    const candidateFile = Array.from(files).find(isVideoFile)

    if (shouldConnectPrimary && candidateFile) {
      const mismatchError = getPrimaryMediaReconnectError(
        project,
        createFileDescriptor(candidateFile),
      )

      if (mismatchError) {
        setPrimarySourceError(mismatchError)
        return
      }

      setIsPrimarySourceConnecting(true)
      setPrimarySourceError(null)
    }

    const importedItems = addFiles(files)

    if (!shouldConnectPrimary) {
      return
    }

    const primaryItem = importedItems.find((item) => item.type === 'video')

    if (!primaryItem) {
      setIsPrimarySourceConnecting(false)
      return
    }

    connectPrimaryMedia(createProjectMediaDescriptor(primaryItem))
    selectItem(primaryItem.id)
    setPreviewMode('timeline')
  }, [
    addFiles,
    connectPrimaryMedia,
    isPrimarySourceConnecting,
    primaryMediaItem,
    project,
    selectItem,
  ])

  const handleMediaSelect = useCallback((mediaItemId: string) => {
    selectItem(mediaItemId)
    clearSelection()
    setPreviewMode('source')
  }, [clearSelection, selectItem])

  const handlePrimaryMediaChoose = useCallback((mediaItemId: string) => {
    selectItem(mediaItemId)
    choosePrimaryMedia(mediaItemId)
    setPreviewMode('timeline')
  }, [choosePrimaryMedia, selectItem])

  const handleReferenceMediaChoose = useCallback((mediaItemId: string) => {
    chooseReferenceMedia(mediaItemId)
    selectItem(mediaItemId)
    clearSelection()
    setPreviewMode('source')
  }, [chooseReferenceMedia, clearSelection, selectItem])

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
          primaryAsset={primaryMediaBinding?.asset ?? null}
          referenceAsset={referenceMediaBinding?.asset ?? null}
          primaryMediaItemId={primaryMediaItemId}
          referenceMediaItemId={referenceMediaItemId}
          primaryCandidateItemIds={primaryCandidateItemIds}
          referenceCandidateItemIds={referenceCandidateItemIds}
          analysis={projectAnalysis}
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
          onMediaRemove={removeItem}
          onMediaClear={clearLibrary}
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
            hasPrimaryAsset={Boolean(primaryMediaBinding)}
            sourcePreviewItem={activeMediaItem}
	          outputSettings={outputSettings}
	          selectedSubstage={selectedSubstage}
            aiSuggestions={reviewSuggestions}
            computedClips={editProjection.clips}
            clipMediaPresentations={timelineClipMediaPresentations}
            clipThumbnailPresentations={timelineClipThumbnailPresentations}
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
