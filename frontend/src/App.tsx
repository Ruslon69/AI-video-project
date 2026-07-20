import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { AssistantPanel } from './components/assistant/AssistantPanel'
import { HelpPanel } from './components/help/HelpPanel'
import { AppHeader } from './components/layout/AppHeader'
import { ProjectSidebar } from './components/project/ProjectSidebar'
import { VideoWorkspace } from './components/project/VideoWorkspace'
import { ReviewPanel } from './components/review/ReviewPanel'
import { mockAISuggestions } from './data/aiSuggestions'
import { initialProjectState } from './data/stages'
import { helpContent } from './data/helpContent'
import { useMediaLibrary } from './hooks/useMediaLibrary'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import { useTheme } from './hooks/useTheme'
import { checkBackendHealth } from './services/api'
import type { ProjectOutputSettings } from './types'
import type { AISuggestion } from './types'
import {
  applyPlatformDefaults,
  defaultProjectOutputSettings,
} from './utils/projectSettings'
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
  const [aiSuggestions, setAISuggestions] = useState<AISuggestion[]>(mockAISuggestions)
  const [selectedAISuggestionIds, setSelectedAISuggestionIds] = useState<string[]>(
    mockAISuggestions[0] ? [mockAISuggestions[0].id] : [],
  )
  const [activeAISuggestionId, setActiveAISuggestionId] = useState<string | null>(
    mockAISuggestions[0]?.id ?? null,
  )
  const [outputSettings, setOutputSettings] = useState<ProjectOutputSettings>(
    defaultProjectOutputSettings,
  )
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
	  const activeHelpContent = openHelpId ? helpContent[openHelpId] : null

  useEffect(() => {
    void checkBackendHealth().then(setIsBackendConnected)
  }, [])

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
	    setOutputSettings((currentSettings) => {
	      if (settings.platform !== currentSettings.platform) {
	        return applyPlatformDefaults(settings, settings.platform)
	      }

	      return settings
	    })
	  }

	  const handleReconnectMediaSource = () => {
	    document.getElementById('media-upload')?.click()
	  }

  const activateAISuggestion = (suggestionId: string) => {
    setActiveAISuggestionId(suggestionId)
    setSelectedAISuggestionIds((currentIds) =>
      currentIds.includes(suggestionId) ? currentIds : [...currentIds, suggestionId],
    )
  }

  const toggleAISuggestionSelection = (suggestionId: string) => {
    setActiveAISuggestionId(suggestionId)
    setSelectedAISuggestionIds((currentIds) =>
      currentIds.includes(suggestionId)
        ? currentIds.filter((id) => id !== suggestionId)
        : [...currentIds, suggestionId],
    )
  }

  const selectAISuggestions = (suggestionIds: string[]) => {
    setSelectedAISuggestionIds(suggestionIds)
    setActiveAISuggestionId(suggestionIds[0] ?? null)
  }

  const updateAISuggestionStatuses = (
    suggestionIds: string[],
    status: AISuggestion['status'],
  ) => {
    const suggestionIdSet = new Set(suggestionIds)

    setAISuggestions((currentSuggestions) =>
      currentSuggestions.map((suggestion) =>
        suggestionIdSet.has(suggestion.id)
          ? { ...suggestion, status }
          : suggestion,
      ),
    )
    setActiveAISuggestionId(suggestionIds[0] ?? null)
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
          fileRejections={fileRejections}
          outputSettings={outputSettings}
          stats={stats}
          openHelpId={openHelpId}
          onFilesAdd={addFiles}
          onMediaSelect={selectItem}
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
	          activeItem={activeMediaItem}
	          outputSettings={outputSettings}
	          selectedSubstage={selectedSubstage}
            aiSuggestions={aiSuggestions}
            selectedAISuggestionIds={selectedAISuggestionIds}
            activeAISuggestionId={activeAISuggestionId}
	          onReconnectSource={handleReconnectMediaSource}
            onAISuggestionActivate={activateAISuggestion}
	        />
        <ReviewPanel
          stage={selectedStage}
          substage={selectedSubstage}
          aiSuggestions={aiSuggestions}
          selectedAISuggestionIds={selectedAISuggestionIds}
          activeAISuggestionId={activeAISuggestionId}
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
          onAISuggestionActivate={activateAISuggestion}
          onAISuggestionSelectionToggle={toggleAISuggestionSelection}
          onAISuggestionsSelect={selectAISuggestions}
          onAISuggestionAccept={(suggestionId) =>
            updateAISuggestionStatuses([suggestionId], 'accepted')
          }
          onAISuggestionReject={(suggestionId) =>
            updateAISuggestionStatuses([suggestionId], 'rejected')
          }
          onAISuggestionsAccept={(suggestionIds) =>
            updateAISuggestionStatuses(suggestionIds, 'accepted')
          }
          onAISuggestionsReject={(suggestionIds) =>
            updateAISuggestionStatuses(suggestionIds, 'rejected')
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

export default App
