import type { ProjectAnalysisState } from '../../analysis/models'

const statusLabels: Record<ProjectAnalysisState['status'], string> = {
  idle: 'Idle',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
}

export function ProjectAnalysisStatus({
  analysis,
}: {
  analysis: ProjectAnalysisState
}) {
  const result = analysis.result

  return (
    <section
      className="project-analysis-status"
      data-status={analysis.status}
      aria-label="Primary video analysis"
    >
      <div className="project-analysis-status-head">
        <span>Analysis</span>
        <strong>{statusLabels[analysis.status]}</strong>
      </div>
      {analysis.status === 'running' ? (
        <div
          className="project-analysis-progress"
          role="progressbar"
          aria-label="Analysis progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={analysis.progress}
        >
          <span style={{ width: `${analysis.progress}%` }} />
        </div>
      ) : null}
      {result ? (
        <p>
          {result.scenes.length} scenes ·{' '}
          {result.transcript.segments.length} transcript segments ·{' '}
          {result.silences.length} pauses
        </p>
      ) : null}
      {analysis.error ? (
        <p className="project-analysis-error">{analysis.error}</p>
      ) : null}
    </section>
  )
}
