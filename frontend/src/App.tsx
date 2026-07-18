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

  return (
    <div className="app-shell">
      <AppHeader
        themePreference={themePreference}
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
          onFileSelect={setVideoFile}
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
