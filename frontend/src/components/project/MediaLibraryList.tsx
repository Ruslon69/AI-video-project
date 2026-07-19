import type { MediaItem } from '../../types'
import {
  formatBitrate,
  formatDuration,
  formatFileSize,
  formatNumber,
} from '../../utils/mediaFormat'
import { getSourceOrientation } from '../../utils/projectSettings'

const mediaTypeLabels: Record<MediaItem['type'], string> = {
  video: 'Видео',
  image: 'Изображение',
  audio: 'Аудио',
}

const stateLabels: Record<MediaItem['state'], string> = {
  ready: 'Готово',
  processing: 'Обработка',
  error: 'Ошибка',
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
          data-state={item.state}
        >
          <button
            type="button"
            className="media-library-select"
            onClick={() => onSelect(item.id)}
            aria-pressed={activeItemId === item.id}
          >
            <span className="media-library-name">{item.filename}</span>
            <span className="media-library-meta">
              {mediaTypeLabels[item.type]} · {formatFileSize(item.size)}
            </span>
            <span className="media-library-state">
              {stateLabels[item.state]}
            </span>
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

function MediaItemMetadata({ item }: { item: MediaItem }) {
  if (item.state === 'processing') {
    return <span className="media-library-details">Читаем метаданные...</span>
  }

  if (item.error) {
    return <span className="media-library-details">{item.error}</span>
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
    </span>
  )
}
