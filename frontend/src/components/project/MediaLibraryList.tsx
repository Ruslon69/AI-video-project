import type { CSSProperties } from 'react'
import type { MediaItem } from '../../types'
import type { MediaLibraryAssetPresentation } from '../../selectors/mediaAssetSelectors'
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
  primaryMediaItemId: string | null
  referenceMediaItemId: string | null
  assetPresentations: Record<string, MediaLibraryAssetPresentation>
  onSelect: (itemId: string) => void
  onPrimaryChoose: (itemId: string) => void
  onReferenceChoose: (itemId: string) => void
  onSwapPrimaryAndReference: () => void
  onClearReference: () => void
  onReconnect: () => void
  onRemove: (itemId: string) => void
}

export function MediaLibraryList({
  items,
  activeItemId,
  primaryMediaItemId,
  referenceMediaItemId,
  assetPresentations,
  onSelect,
  onPrimaryChoose,
  onReferenceChoose,
  onSwapPrimaryAndReference,
  onClearReference,
  onReconnect,
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
      {items.map((item) => {
        const assetPresentation = assetPresentations[item.id]
        const instanceCount = assetPresentation?.timelineInstanceCount ?? 0
        const isPrimary = primaryMediaItemId === item.id
        const isReference = referenceMediaItemId === item.id
        const isVideo = item.type === 'video'
        const roleLabel = isPrimary
          ? 'Главное видео'
          : isReference
            ? 'Пример монтажа'
            : 'Без роли'

        return (
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
            <span className="media-library-title">
              <span className="media-library-name-row">
                <span
                  className="media-source-marker"
                  style={{
                    '--media-source-color': assetPresentation?.sourceColor ?? '#7d8797',
                  } as CSSProperties}
                  aria-hidden="true"
                />
                <span className="media-library-name">{item.filename}</span>
              </span>
              <span className="media-library-meta">
                {mediaTypeLabels[item.type]} · {formatFileSize(item.size)}
              </span>
              <span className="media-library-usage">
                {isPrimary
                  ? `На таймлайне: ${instanceCount}`
                  : isReference
                    ? 'Не добавляется на таймлайн'
                    : instanceCount > 0
                  ? `На таймлайне: ${instanceCount}`
                  : 'Не на таймлайне'}
              </span>
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
          <div className="media-library-actions">
            <span
              className="media-role-badge"
              data-role={isPrimary ? 'primary' : isReference ? 'reference' : 'none'}
            >
              {roleLabel}
            </span>
            <details className="media-library-menu">
              <summary aria-label={`Действия для ${item.filename}`}>...</summary>
              <span className="media-library-menu-items">
                {item.status === 'unavailable' ? (
                  <button type="button" onClick={onReconnect}>
                    Подключить файл
                  </button>
                ) : null}
                {isVideo && isPrimary && referenceMediaItemId ? (
                  <button type="button" onClick={onSwapPrimaryAndReference}>
                    Поменять с примером
                  </button>
                ) : null}
                {isVideo && isReference ? (
                  <>
                    <button type="button" onClick={() => onPrimaryChoose(item.id)}>
                      Сделать главным
                    </button>
                    <button type="button" onClick={onClearReference}>
                      Снять роль примера
                    </button>
                  </>
                ) : isVideo && isPrimary ? null : isVideo ? (
                  <>
                    <button type="button" onClick={() => onPrimaryChoose(item.id)}>
                      Сделать главным
                    </button>
                    <button type="button" onClick={() => onReferenceChoose(item.id)}>
                      Сделать примером
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="media-remove-button"
                  onClick={() => onRemove(item.id)}
                >
                  {isReference ? 'Удалить из медиатеки' : 'Удалить'}
                </button>
              </span>
            </details>
          </div>
          </li>
        )
      })}
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
    return (
      <span className="media-library-details">
        <span>Читаем метаданные...</span>
      </span>
    )
  }

  if (item.type !== 'video' || !item.metadata) {
    return null
  }

  const details = [
    formatDuration(item.metadata.duration),
    `${item.metadata.width} × ${item.metadata.height}`,
    `${formatNumber(item.metadata.fps)} FPS`,
    item.metadata.codec,
    formatBitrate(item.metadata.bitrate),
    orientationLabels[getSourceOrientation(item.metadata)],
  ]
  const stageDetails = [
    item.previewState === 'processing' ? 'Готовим кадры...' : null,
    item.previewError,
    item.sceneState === 'processing' ? 'Ищем сцены...' : null,
    item.scenes?.outcome === 'scenes_detected'
      ? `Scenes detected: ${item.scenes.scenes.length}`
      : null,
    item.scenes?.outcome === 'no_scene_changes'
      ? 'No scene changes detected'
      : null,
    item.sceneError,
    item.transcriptionState === 'processing' ? 'Расшифровываем речь...' : null,
    item.transcription ? 'Транскрипция готова' : null,
    item.transcriptionError,
  ]

  return (
    <span className="media-library-details">
      {[...details, ...stageDetails].filter(Boolean).map((detail) => (
        <span key={detail}>{detail}</span>
      ))}
    </span>
  )
}
