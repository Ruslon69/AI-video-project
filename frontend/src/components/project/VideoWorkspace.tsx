import type { EditingSubstage, MediaItem, VideoMetadata } from '../../types'
import {
  formatBitrate,
  formatDuration,
  formatFileSize,
  formatNumber,
} from '../../utils/mediaFormat'
import { statusLabels } from '../../utils/projectState'

type VideoWorkspaceProps = {
  activeItem: MediaItem | null
  selectedSubstage: EditingSubstage
}

export function VideoWorkspace({
  activeItem,
  selectedSubstage,
}: VideoWorkspaceProps) {
  return (
    <section className="video-workspace" aria-label="Видеоплеер">
      <div className="workspace-toolbar">
        <div>
          <p className="section-label">Предпросмотр</p>
          <h2>{activeItem?.filename ?? 'Медиа не выбрано'}</h2>
        </div>
        <span className={`current-status current-status-${selectedSubstage.status}`}>
          <span aria-hidden="true" />
          {statusLabels[selectedSubstage.status]}
        </span>
      </div>
      <div className="video-frame">
        <MediaPreview item={activeItem} />
      </div>
      <p className="workspace-file">
        Активный подэтап: {selectedSubstage.title}
      </p>
      <VideoMetadataPanel item={activeItem} />
    </section>
  )
}

function MediaPreview({ item }: { item: MediaItem | null }) {
  if (!item) {
    return (
      <div className="video-placeholder">
        <span className="play-mark" aria-hidden="true">
          ▶
        </span>
        <h2>Добавьте медиа для предпросмотра</h2>
        <p>Видео и изображения из медиатеки появятся здесь.</p>
      </div>
    )
  }

  if (item.type === 'video') {
    return (
      <video className="video-player" src={item.objectUrl} controls>
        Ваш браузер не поддерживает видео.
      </video>
    )
  }

  if (item.type === 'image') {
    return (
      <img
        className="image-player"
        src={item.objectUrl}
        alt={`Предпросмотр ${item.filename}`}
      />
    )
  }

  return (
    <div className="video-placeholder">
      <span className="play-mark" aria-hidden="true">
        ♪
      </span>
      <h2>{item.filename}</h2>
      <p>Аудиофайл добавлен в медиатеку. Предпросмотр доступен для видео и изображений.</p>
    </div>
  )
}

function VideoMetadataPanel({ item }: { item: MediaItem | null }) {
  if (!item) {
    return null
  }

  if (item.type !== 'video') {
    return (
      <div className="metadata-panel">
        <p className="section-label">Сведения о медиа</p>
        <dl className="metadata-grid">
          <div className="metadata-row">
            <dt>Файл</dt>
            <dd>{item.filename}</dd>
          </div>
          <div className="metadata-row">
            <dt>Тип</dt>
            <dd>{item.type === 'image' ? 'Изображение' : 'Аудио'}</dd>
          </div>
          <div className="metadata-row">
            <dt>Размер файла</dt>
            <dd>{formatFileSize(item.size)}</dd>
          </div>
        </dl>
      </div>
    )
  }

  if (item.state === 'processing') {
    return (
      <div className="metadata-panel" aria-live="polite">
        <p className="section-label">Метаданные видео</p>
        <p className="metadata-message">Анализируем видео...</p>
      </div>
    )
  }

  if (item.error) {
    return (
      <div className="metadata-panel metadata-panel-error" aria-live="polite">
        <p className="section-label">Метаданные видео</p>
        <p className="metadata-message">
          Не удалось прочитать метаданные видео. Можно выбрать другой файл или попробовать снова позже.
        </p>
      </div>
    )
  }

  if (!item.metadata) {
    return null
  }

  const metadata: VideoMetadata = item.metadata
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
      <p className="section-label">Метаданные видео</p>
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
