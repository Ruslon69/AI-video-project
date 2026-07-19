import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { AssistantPanel } from './components/assistant/AssistantPanel'
import { HelpPanel } from './components/help/HelpPanel'
import { AppHeader } from './components/layout/AppHeader'
import { ProjectSidebar } from './components/project/ProjectSidebar'
import { VideoWorkspace } from './components/project/VideoWorkspace'
import { ReviewPanel } from './components/review/ReviewPanel'
import { initialProjectState } from './data/stages'
import { helpContent } from './data/helpContent'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import { useTheme } from './hooks/useTheme'
import { checkBackendHealth, uploadVideoMetadata } from './services/api'
import type { VideoMetadata } from './types'
import {
  createReviewVersion,
  ensureProjectState,
  getProjectStats,
  getSelectedStage,
  getSelectedSubstage,
  restoreSelectedSubstageVersion,
  setSelectedSubstageStatus,
  updateSelectedSubstageComment,
} from './utils/projectState'

const projectStorageKey = 'ai-video-director-project-state-v2'

function App() {
  const { themePreference, setThemePreference } = useTheme()
  const [projectState, setProjectState] = useLocalStorageState(
    projectStorageKey,
    initialProjectState,
    ensureProjectState,
  )
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [assistantDraftQuestion, setAssistantDraftQuestion] = useState('')
  const [openHelpId, setOpenHelpId] = useState<string | null>(null)
  const [isBackendConnected, setIsBackendConnected] = useState(false)
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [isMetadataLoading, setIsMetadataLoading] = useState(false)
  const [metadataError, setMetadataError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!videoFile) {
      setVideoUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(videoFile)
    setVideoUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [videoFile])

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

  const handleFileSelect = (file: File | null) => {
    setVideoFile(file)
    setVideoMetadata(null)
    setMetadataError(null)

    if (!file) {
      setIsMetadataLoading(false)
      return
    }

    setIsMetadataLoading(true)
    void uploadVideoMetadata(file)
      .then((metadata) => {
        setVideoMetadata(metadata)
        setIsBackendConnected(true)
      })
      .catch(() => {
        setMetadataError(
          'Не удалось прочитать метаданные видео. Проверьте файл или запустите backend.',
        )
        setIsBackendConnected(false)
      })
      .finally(() => setIsMetadataLoading(false))
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
          selectedFileName={videoFile?.name ?? null}
          stats={stats}
          openHelpId={openHelpId}
          onFileSelect={handleFileSelect}
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
          fileName={videoFile?.name ?? null}
          videoUrl={videoUrl}
          metadata={videoMetadata}
          isMetadataLoading={isMetadataLoading}
          metadataError={metadataError}
          selectedSubstage={selectedSubstage}
        />
        <ReviewPanel
          stage={selectedStage}
          substage={selectedSubstage}
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
