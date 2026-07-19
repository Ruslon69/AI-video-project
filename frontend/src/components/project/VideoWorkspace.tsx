import type { EditingSubstage } from '../../types'
import type { VideoMetadata } from '../../types'
import { statusLabels } from '../../utils/projectState'

type VideoWorkspaceProps = {
  fileName: string | null
  videoUrl: string | null
  metadata: VideoMetadata | null
  isMetadataLoading: boolean
  metadataError: string | null
  selectedSubstage: EditingSubstage
}

export function VideoWorkspace({
  fileName,
  videoUrl,
  metadata,
  isMetadataLoading,
  metadataError,
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
      <VideoMetadataPanel
        metadata={metadata}
        isLoading={isMetadataLoading}
        error={metadataError}
      />
    </section>
  )
}

type VideoMetadataPanelProps = {
  metadata: VideoMetadata | null
  isLoading: boolean
  error: string | null
}

function VideoMetadataPanel({
  metadata,
  isLoading,
  error,
}: VideoMetadataPanelProps) {
  if (isLoading) {
    return (
      <div className="metadata-panel" aria-live="polite">
        <p className="section-label">Метаданные</p>
        <p className="metadata-message">Анализируем видео...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="metadata-panel metadata-panel-error" aria-live="polite">
        <p className="section-label">Метаданные</p>
        <p className="metadata-message">{error}</p>
      </div>
    )
  }

  if (!metadata) {
    return null
  }

  const items = [
    ['Файл', metadata.filename],
    ['Длительность', formatDuration(metadata.duration)],
    ['Размер кадра', `${metadata.width} x ${metadata.height}`],
    ['FPS', formatNumber(metadata.fps)],
    ['Кодек', metadata.codec],
    ['Битрейт', formatBitrate(metadata.bitrate)],
    ['Размер файла', formatFileSize(metadata.file_size)],
  ]

  return (
    <div className="metadata-panel">
      <p className="section-label">Метаданные</p>
      <dl className="metadata-grid">
        {items.map(([label, value]) => (
          <div key={label} className="metadata-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 3,
  }).format(value)
}

function formatBitrate(bitrate: number | null) {
  if (!bitrate) {
    return 'Не указан'
  }

  return `${formatNumber(bitrate / 1_000_000)} Мбит/с`
}

function formatFileSize(bytes: number) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
    style: 'unit',
    unit: 'megabyte',
  }).format(bytes / 1_000_000)
}
