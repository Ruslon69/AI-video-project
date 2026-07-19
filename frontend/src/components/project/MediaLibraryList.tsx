import type { MediaItem } from '../../types'
import {
  formatBitrate,
  formatDuration,
  formatFileSize,
  formatNumber,
} from '../../utils/mediaFormat'
import { getMediaStatusLabel } from '../../utils/mediaStatus'
import { getSourceOrientation } from '../../utils/projectSettings'

const mediaTypeLabels: Record<MediaItem['type'], string> = {
  video: 'Видео',
  image: 'Изображение',
  audio: 'Аудио',
}

const orientationLabels = {
  vertical: 'Вертикальное',
  horizontal: 'Горизонтальное',
  square: 'Квадратное',
}

type MediaLibraryListProps = {
  items: MediaItem[]
  activeItemId: string | null
  onSelect: (itemId: string) => void
  onRemove: (itemId: string) => void
}

export function MediaLibraryList({
  items,
  activeItemId,
  onSelect,
  onRemove,
}: MediaLibraryListProps) {
  if (items.length === 0) {
    return (
      <p className="selected-file muted">
        Добавьте видео, изображения или аудио для проекта.
      </p>
    )
  }

  return (
    <ul className="media-library-list" aria-label="Медиатека проекта">
      {items.map((item) => (
        <li
          key={item.id}
          className="media-library-item"
          data-active={activeItemId === item.id}
          data-status={item.status}
        >
          <button
            type="button"
            className="media-library-select"
            onClick={() => onSelect(item.id)}
            aria-pressed={activeItemId === item.id}
          >
            <MediaLibraryThumb item={item} />
            <span className="media-library-name">{item.filename}</span>
            <span className="media-library-meta">
              {mediaTypeLabels[item.type]} · {formatFileSize(item.size)}
            </span>
            <span className="media-library-state">
              {getMediaStatusLabel(item.status)}
            </span>
            <span className="media-library-progress-row">
              <span
                className="media-library-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={item.progress}
                aria-label={`${item.filename}: ${getMediaStatusLabel(item.status)}`}
              >
                <span
                  className="media-library-progress-fill"
                  style={{ width: `${item.progress}%` }}
                />
              </span>
              <span className="media-library-progress-value">
                {item.progress}%
              </span>
            </span>
            {item.status === 'error' && item.errorMessage ? (
              <span className="media-library-error" role="status">
                {item.errorMessage}
              </span>
            ) : null}
            <MediaItemMetadata item={item} />
          </button>
          <button
            type="button"
            className="ghost-button compact-button media-remove-button"
            onClick={() => onRemove(item.id)}
            aria-label={`Удалить файл ${item.filename}`}
          >
            Удалить
          </button>
        </li>
      ))}
    </ul>
  )
}

function MediaLibraryThumb({ item }: { item: MediaItem }) {
  if (item.type === 'video') {
    if (item.previews?.poster.data_url) {
      return (
        <img
          className="media-library-thumb"
          src={item.previews.poster.data_url}
          alt=""
          aria-hidden="true"
        />
      )
    }

    return (
      <span
        className="media-library-thumb media-library-thumb-placeholder"
        aria-hidden="true"
      >
        {item.previewState === 'processing' ? '...' : '▶'}
      </span>
    )
  }

  if (item.type === 'image') {
    return (
      <img
        className="media-library-thumb"
        src={item.objectUrl}
        alt=""
        aria-hidden="true"
      />
    )
  }

  return (
    <span
      className="media-library-thumb media-library-thumb-placeholder"
      aria-hidden="true"
    >
      ♪
    </span>
  )
}

function MediaItemMetadata({ item }: { item: MediaItem }) {
  if (item.status === 'uploading' || item.status === 'metadata') {
    return <span className="media-library-details">Читаем метаданные...</span>
  }

  if (item.type !== 'video' || !item.metadata) {
    return null
  }

  return (
    <span className="media-library-details">
      {formatDuration(item.metadata.duration)} · {item.metadata.width} x{' '}
      {item.metadata.height} · {formatNumber(item.metadata.fps)} FPS ·{' '}
      {item.metadata.codec} · {formatBitrate(item.metadata.bitrate)} ·{' '}
      {orientationLabels[getSourceOrientation(item.metadata)]}
      {item.previewState === 'processing' ? ' · Готовим кадры...' : ''}
      {item.previewError ? ` · ${item.previewError}` : ''}
      {item.sceneState === 'processing' ? ' · Ищем сцены...' : ''}
      {item.scenes ? ` · Сцен: ${item.scenes.scene_count}` : ''}
      {item.sceneError ? ` · ${item.sceneError}` : ''}
      {item.transcriptionState === 'processing' ? ' · Расшифровываем речь...' : ''}
      {item.transcription ? ' · Транскрипция готова' : ''}
      {item.transcriptionError ? ` · ${item.transcriptionError}` : ''}
    </span>
  )
}
