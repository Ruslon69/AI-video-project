import type { EditingSubstage } from '../../types'
import { statusLabels } from '../../utils/projectState'

type VideoWorkspaceProps = {
  fileName: string | null
  videoUrl: string | null
  selectedSubstage: EditingSubstage
}

export function VideoWorkspace({
  fileName,
  videoUrl,
  selectedSubstage,
}: VideoWorkspaceProps) {
  return (
    <section className="video-workspace" aria-label="Видеоплеер">
      <div className="workspace-toolbar">
        <div>
          <p className="section-label">Предпросмотр</p>
          <h2>{fileName ?? 'Видео не выбрано'}</h2>
        </div>
        <span className={`current-status current-status-${selectedSubstage.status}`}>
          <span aria-hidden="true" />
          {statusLabels[selectedSubstage.status]}
        </span>
      </div>
      <div className="video-frame">
        {videoUrl ? (
          <video className="video-player" src={videoUrl} controls>
            Ваш браузер не поддерживает видео.
          </video>
        ) : (
          <div className="video-placeholder">
            <span className="play-mark" aria-hidden="true">
              ▶
            </span>
            <h2>Загрузите видео для предпросмотра</h2>
            <p>Локальный файл появится здесь с элементами управления.</p>
          </div>
        )}
      </div>
      <p className="workspace-file">
        Активный подэтап: {selectedSubstage.title}
      </p>
    </section>
  )
}
