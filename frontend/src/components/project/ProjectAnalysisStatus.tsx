import type { ProjectAnalysisState } from '../../analysis/models'

const statusLabels: Record<ProjectAnalysisState['status'], string> = {
  idle: 'Не проанализировано',
  running: 'Идёт анализ',
  completed: 'Анализ готов',
  failed: 'Анализ не завершён',
}

export function ProjectAnalysisStatus({
  analysis,
  isSourceAvailable,
  onRetry,
}: {
  analysis: ProjectAnalysisState
  isSourceAvailable: boolean
  onRetry: () => void
}) {
  const result = analysis.result
  const sourceNeedsReconnect = !isSourceAvailable && analysis.sourceAssetId !== null
  const label = sourceNeedsReconnect
    ? 'Нужно снова выбрать видео'
    : statusLabels[analysis.status]

  return (
    <section
      className="project-analysis-status"
      data-status={sourceNeedsReconnect ? 'source-unavailable' : analysis.status}
      aria-label="Анализ основного видео"
    >
      <div className="project-analysis-status-head">
        <span>Анализ видео</span>
        <strong>{label}</strong>
      </div>
      {sourceNeedsReconnect ? (
        <p>
          Проект сохранён. Выберите исходное видео снова, чтобы продолжить анализ и монтаж.
        </p>
      ) : null}
      {analysis.status === 'running' ? (
        <div
          className="project-analysis-progress"
          role="progressbar"
          aria-label="Ход анализа"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={analysis.progress}
        >
          <span style={{ width: `${analysis.progress}%` }} />
        </div>
      ) : null}
      {result ? (
        <p>
          Найдено: {result.transcript.segments.length} фрагментов речи,{' '}
          {result.scenes.length} сцен и {result.silences.length} пауз.
        </p>
      ) : null}
      {analysis.status === 'failed' ? (
        <>
          <p className="project-analysis-error">
            {getAnalysisErrorMessage(analysis.error)}
          </p>
          <button
            type="button"
            className="ghost-button compact-button"
            onClick={onRetry}
            disabled={!isSourceAvailable}
          >
            Повторить анализ
          </button>
        </>
      ) : null}
    </section>
  )
}

function getAnalysisErrorMessage(error: string | null) {
  if (!error) {
    return 'Не удалось завершить анализ видео. Попробуйте ещё раз.'
  }

  return 'Не удалось завершить анализ видео. Проверьте подключение и повторите попытку.'
}
