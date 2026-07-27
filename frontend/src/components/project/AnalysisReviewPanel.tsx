import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { ProjectAnalysis } from '../../analysis/models'
import type {
  AnalysisReviewPresentation,
  AnalysisSeekTarget,
  RoughCutCandidate,
} from '../../selectors/analysisReviewSelectors'
import { getActiveAnalysisIds, shouldShowConfidence } from '../../selectors/analysisReviewSelectors'
import type { EditProjection } from '../../selectors/editProjection'
import { usePlaybackState } from '../../playback/PlaybackStore'
import { formatDuration } from '../../utils/mediaFormat'

type ReviewTab = 'transcript' | 'pauses' | 'scenes'

const tabLabels: Record<ReviewTab, string> = {
  transcript: 'Речь',
  pauses: 'Паузы',
  scenes: 'Сцены',
}

export function AnalysisReviewPanel({
  analysis,
  presentation,
  projection,
  candidates,
  onSeek,
  activeTranscriptSegmentId,
  activePauseId,
}: {
  analysis: ProjectAnalysis | null
  presentation: AnalysisReviewPresentation
  projection: EditProjection
  candidates: RoughCutCandidate[]
  onSeek: (target: AnalysisSeekTarget) => void
  activeTranscriptSegmentId: number | null
  activePauseId: string | null
}) {
  const [activeTab, setActiveTab] = useState<ReviewTab>('transcript')
  const panelRef = useRef<HTMLElement | null>(null)

  return (
    <section
      ref={panelRef}
      className="analysis-review-panel"
      aria-label="Результаты анализа видео"
    >
      <AnalysisReviewPlaybackHighlights
        analysis={analysis}
        projection={projection}
        panelRef={panelRef}
        selectedTranscriptSegmentId={activeTranscriptSegmentId}
        selectedPauseId={activePauseId}
        activeTab={activeTab}
      />
      <div className="analysis-review-head">
        <div>
          <p className="section-label">Анализ видео</p>
          <h3>Проверьте, что нашлось</h3>
        </div>
        <span className="analysis-review-status" data-status={presentation.status}>
          {getStatusText(presentation.status)}
        </span>
      </div>
      {presentation.summary ? (
        <AnalysisSummary summary={presentation.summary} />
      ) : (
        <AnalysisReviewEmptyState status={presentation.status} />
      )}
      {presentation.summary ? (
        <>
          <div className="analysis-review-tabs" role="tablist" aria-label="Разделы анализа">
            {(Object.keys(tabLabels) as ReviewTab[]).map((tab) => (
              <button
                key={tab}
                id={`analysis-review-tab-${tab}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`analysis-review-panel-${tab}`}
                className="analysis-review-tab"
                onClick={() => setActiveTab(tab)}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>
          <div
            id={`analysis-review-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`analysis-review-tab-${activeTab}`}
          >
            {activeTab === 'transcript' ? (
              <TranscriptReview segments={presentation.transcript} onSeek={onSeek} />
            ) : null}
            {activeTab === 'pauses' ? (
              <PauseReview
                pauses={presentation.pauses}
                candidates={candidates}
                onSeek={onSeek}
              />
            ) : null}
            {activeTab === 'scenes' ? (
              <SceneReview scenes={presentation.scenes} onSeek={onSeek} />
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  )
}

function AnalysisSummary({
  summary,
}: {
  summary: NonNullable<AnalysisReviewPresentation['summary']>
}) {
  return (
    <div className="analysis-review-summary" aria-label="Краткая сводка анализа">
      <span><strong>{formatDuration(summary.duration)}</strong> видео</span>
      <span><strong>{summary.transcriptSegmentCount}</strong> фрагментов речи</span>
      <span><strong>{summary.sceneCount}</strong> сцен</span>
      <span><strong>{summary.pauseCount}</strong> пауз</span>
      <span><strong>{formatDuration(summary.totalSilenceDuration)}</strong> тишины</span>
    </div>
  )
}

function AnalysisReviewEmptyState({ status }: { status: AnalysisReviewPresentation['status'] }) {
  const message = status === 'running'
    ? 'Анализ ещё выполняется. Результаты появятся здесь после завершения.'
    : status === 'failed'
      ? 'Не удалось подготовить результаты анализа. Повторите анализ в панели проекта.'
      : 'Выберите основное видео, чтобы увидеть результаты анализа.'

  return <p className="analysis-review-empty">{message}</p>
}

function TranscriptReview({
  segments,
  onSeek,
}: {
  segments: AnalysisReviewPresentation['transcript']
  onSeek: (target: AnalysisSeekTarget) => void
}) {
  if (!segments.length) {
    return <p className="analysis-review-empty">В этом видео не удалось обнаружить речь.</p>
  }

  return (
    <div className="analysis-review-list" aria-label="Фрагменты речи">
      {segments.map((segment) => (
        <button
          key={segment.id}
          type="button"
          className="analysis-review-row analysis-review-transcript"
          data-analysis-kind="transcript"
          data-analysis-id={segment.id}
          data-low-confidence={segment.isLowConfidence || undefined}
          disabled={segment.seekTarget.availability !== 'timeline'}
          onClick={() => onSeek(segment.seekTarget)}
          aria-label={`${formatRange(segment.start, segment.end)}. ${segment.text}`}
        >
          <span className="analysis-review-time">{formatRange(segment.start, segment.end)}</span>
          <span className="analysis-review-copy">{segment.text}</span>
          {shouldShowConfidence(segment.confidence) ? (
            <span className="analysis-review-confidence">
              Распознано с уверенностью {Math.round((segment.confidence ?? 0) * 100)}%
            </span>
          ) : null}
          <AvailabilityHint target={segment.seekTarget} />
        </button>
      ))}
    </div>
  )
}

function PauseReview({
  pauses,
  candidates,
  onSeek,
}: {
  pauses: AnalysisReviewPresentation['pauses']
  candidates: RoughCutCandidate[]
  onSeek: (target: AnalysisSeekTarget) => void
}) {
  const longPauseCount = pauses.filter((pause) => pause.classification === 'long').length
  const totalDuration = pauses.reduce((total, pause) => total + pause.duration, 0)
  const longCandidates = candidates.filter((candidate) => candidate.priority === 'high')

  if (!pauses.length) {
    return <p className="analysis-review-empty">Заметных пауз не найдено.</p>
  }

  return (
    <>
      <p className="analysis-review-section-summary">
        Найдено пауз: {pauses.length}. Всего тишины: {formatDuration(totalDuration)}. Длинных пауз: {longPauseCount}.
      </p>
      {longCandidates.length ? (
        <p className="analysis-review-candidate-note">
          {longCandidates.length} длинных пауз будут предложены для будущего чернового монтажа. Они не будут удалены автоматически.
        </p>
      ) : null}
      <div className="analysis-review-list" aria-label="Обнаруженные паузы">
        {pauses.map((pause) => (
          <button
            key={pause.id}
            type="button"
            className="analysis-review-row analysis-review-pause"
            data-analysis-kind="pause"
            data-analysis-id={pause.id}
            data-candidate={pause.isRoughCutCandidate || undefined}
            disabled={pause.seekTarget.availability !== 'timeline'}
            onClick={() => onSeek(pause.seekTarget)}
            aria-label={`${getPauseLabel(pause.classification)}: ${formatRange(pause.start, pause.end)}, ${formatDuration(pause.duration)}`}
          >
            <span className="analysis-review-time">{formatRange(pause.start, pause.end)}</span>
            <span className="analysis-review-copy">{getPauseLabel(pause.classification)}</span>
            <span className="analysis-review-duration">{formatDuration(pause.duration)}</span>
            <AvailabilityHint target={pause.seekTarget} />
          </button>
        ))}
      </div>
    </>
  )
}

function SceneReview({
  scenes,
  onSeek,
}: {
  scenes: AnalysisReviewPresentation['scenes']
  onSeek: (target: AnalysisSeekTarget) => void
}) {
  if (!scenes.length) {
    return <p className="analysis-review-empty">Сцены не были обнаружены.</p>
  }

  return (
    <div className="analysis-review-list" aria-label="Обнаруженные сцены">
      {scenes.map((scene) => (
        <button
          key={scene.id}
          type="button"
          className="analysis-review-row analysis-review-scene"
          data-analysis-kind="scene"
          data-analysis-id={scene.id}
          disabled={scene.seekTarget.availability !== 'timeline'}
          onClick={() => onSeek(scene.seekTarget)}
          aria-label={`Сцена ${scene.number}, ${formatRange(scene.start, scene.end)}, ${formatDuration(scene.duration)}`}
        >
          {scene.thumbnailUrl ? (
            <img className="analysis-review-scene-thumbnail" src={scene.thumbnailUrl} alt="" />
          ) : (
            <span className="analysis-review-scene-placeholder" aria-hidden="true" />
          )}
          <span className="analysis-review-copy">
            Сцена {scene.number}
            <small>{formatRange(scene.start, scene.end)} · {formatDuration(scene.duration)}</small>
          </span>
          {shouldShowConfidence(scene.confidence) ? (
            <span className="analysis-review-confidence">
              Уверенность {Math.round(scene.confidence * 100)}%
            </span>
          ) : null}
          <AvailabilityHint target={scene.seekTarget} />
        </button>
      ))}
    </div>
  )
}

function AvailabilityHint({ target }: { target: AnalysisSeekTarget }) {
  return target.availability === 'removed' ? (
    <span className="analysis-review-unavailable">Фрагмент удалён из текущего монтажа</span>
  ) : null
}

function AnalysisReviewPlaybackHighlights({
  analysis,
  projection,
  panelRef,
  selectedTranscriptSegmentId,
  selectedPauseId,
  activeTab,
}: {
  analysis: ProjectAnalysis | null
  projection: EditProjection
  panelRef: RefObject<HTMLElement | null>
  selectedTranscriptSegmentId: number | null
  selectedPauseId: string | null
  activeTab: ReviewTab
}) {
  const { currentTime } = usePlaybackState()

  useEffect(() => {
    const panel = panelRef.current

    if (!panel) {
      return
    }

    const active = getActiveAnalysisIds(analysis, projection, currentTime)

    for (const row of panel.querySelectorAll<HTMLElement>('[data-analysis-kind]')) {
      const kind = row.dataset.analysisKind
      const id = row.dataset.analysisId
      const transcriptSegmentId =
        selectedTranscriptSegmentId ?? active.transcriptSegmentId
      const pauseId = selectedPauseId ?? active.pauseId
      const isActive =
        (kind === 'transcript' && id === String(transcriptSegmentId)) ||
        (kind === 'pause' && id === pauseId) ||
        (kind === 'scene' && id === active.sceneId)

      if (isActive) {
        row.dataset.active = 'true'
      } else {
        delete row.dataset.active
      }
    }
  }, [
    analysis,
    activeTab,
    currentTime,
    panelRef,
    projection,
    selectedPauseId,
    selectedTranscriptSegmentId,
  ])

  return null
}

function getPauseLabel(classification: AnalysisReviewPresentation['pauses'][number]['classification']) {
  if (classification === 'long') {
    return 'Длинная пауза'
  }

  return classification === 'noticeable' ? 'Заметная пауза' : 'Короткая пауза'
}

function getStatusText(status: AnalysisReviewPresentation['status']) {
  if (status === 'completed') {
    return 'Готово'
  }

  if (status === 'running') {
    return 'Выполняется'
  }

  return status === 'failed' ? 'Нужна проверка' : 'Ожидает видео'
}

function formatRange(start: number, end: number) {
  return `${formatDuration(start)} - ${formatDuration(end)}`
}
