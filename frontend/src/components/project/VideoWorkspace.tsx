import { useRef } from 'react'
import type {
  EditingSubstage,
  MediaItem,
  ProjectOutputSettings,
  VideoMetadata,
} from '../../types'
import {
  formatBitrate,
  formatDuration,
  formatFileSize,
  formatNumber,
} from '../../utils/mediaFormat'
import {
  getSourceOrientation,
  isVideoCompatibleWithTarget,
} from '../../utils/projectSettings'
import { statusLabels } from '../../utils/projectState'

type VideoWorkspaceProps = {
  activeItem: MediaItem | null
  outputSettings: ProjectOutputSettings
  selectedSubstage: EditingSubstage
}

export function VideoWorkspace({
  activeItem,
  outputSettings,
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
      <VideoMetadataPanel item={activeItem} outputSettings={outputSettings} />
    </section>
  )
}

function MediaPreview({ item }: { item: MediaItem | null }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

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
      <div className="video-preview-stack">
        <video
          ref={videoRef}
          className="video-player"
          src={item.objectUrl}
          controls
          poster={item.previews?.poster.data_url}
        >
          Ваш браузер не поддерживает видео.
        </video>
        <VideoFilmstrip
          item={item}
          onSeek={(timestamp) => {
            if (videoRef.current) {
              videoRef.current.currentTime = timestamp
            }
          }}
        />
      </div>
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

function VideoFilmstrip({
  item,
  onSeek,
}: {
  item: MediaItem
  onSeek: (timestamp: number) => void
}) {
  if (item.previewState === 'processing') {
    return (
      <div className="video-filmstrip video-filmstrip-message" aria-live="polite">
        Готовим кадры предпросмотра...
      </div>
    )
  }

  if (item.previewState === 'error' && item.previewError) {
    return (
      <div className="video-filmstrip video-filmstrip-error" aria-live="polite">
        {item.previewError}
      </div>
    )
  }

  if (!item.previews?.previews.length) {
    return null
  }

  return (
    <div className="video-filmstrip" aria-label="Кадры предпросмотра">
      {item.previews.previews.map((frame) => (
        <button
          key={frame.timestamp}
          type="button"
          className="video-filmstrip-frame"
          onClick={() => onSeek(frame.timestamp)}
          aria-label={`Перейти к ${formatDuration(frame.timestamp)}`}
        >
          <img src={frame.data_url} alt="" aria-hidden="true" />
          <span>{formatDuration(frame.timestamp)}</span>
        </button>
      ))}
    </div>
  )
}

function VideoMetadataPanel({
  item,
  outputSettings,
}: {
  item: MediaItem | null
  outputSettings: ProjectOutputSettings
}) {
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
  const isCompatible = isVideoCompatibleWithTarget(
    metadata,
    outputSettings.aspectRatio,
  )
  const items = [
    ['Файл', metadata.filename],
    ['Длительность', formatDuration(metadata.duration)],
    ['Размер кадра', `${metadata.width} x ${metadata.height}`],
    ['Ориентация', getOrientationLabel(metadata)],
    ['FPS', formatNumber(metadata.fps)],
    ['Кодек', metadata.codec],
    ['Битрейт', formatBitrate(metadata.bitrate)],
    ['Размер файла', formatFileSize(metadata.file_size)],
  ]
  const sceneTimestamps = item.scenes?.timestamps ?? []
  const transcription = item.transcription

  return (
    <div className="metadata-panel">
      <p className="section-label">Метаданные видео</p>
      <div
        className="compatibility-status"
        data-compatible={isCompatible}
      >
        <strong>{isCompatible ? 'Compatible' : 'Adaptation required'}</strong>
        <span>
          Цель: {outputSettings.aspectRatio} · {outputSettings.resolution.width} x{' '}
          {outputSettings.resolution.height}
        </span>
        {!isCompatible ? (
          <p>
            The source video will be adapted to the selected output format during editing.
          </p>
        ) : null}
      </div>
      <dl className="metadata-grid">
        {items.map(([label, value]) => (
          <div key={label} className="metadata-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="scene-summary" aria-live="polite">
        <div className="scene-summary-head">
          <p className="section-label">Сцены</p>
          <strong>
            {item.sceneState === 'ready'
              ? `${item.scenes?.scene_count ?? 0}`
              : item.sceneState === 'processing'
                ? '...'
                : '0'}
          </strong>
        </div>
        {item.sceneState === 'processing' ? (
          <p className="metadata-message">Определяем смены сцен...</p>
        ) : null}
        {item.sceneError ? (
          <p className="metadata-message metadata-message-error">
            {item.sceneError}
          </p>
        ) : null}
        {item.sceneState === 'ready' && sceneTimestamps.length === 0 ? (
          <p className="metadata-message">Смены сцен не найдены.</p>
        ) : null}
        {sceneTimestamps.length > 0 ? (
          <div className="scene-timestamp-list" aria-label="Таймкоды сцен">
            {sceneTimestamps.map((timestamp) => (
              <span key={timestamp}>{formatDuration(timestamp)}</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="scene-summary" aria-live="polite">
        <div className="scene-summary-head">
          <p className="section-label">Транскрипция</p>
          <strong>
            {item.transcriptionState === 'ready'
              ? '✓'
              : item.transcriptionState === 'processing'
                ? '...'
                : '0'}
          </strong>
        </div>
        {item.transcriptionState === 'processing' ? (
          <p className="metadata-message">Расшифровываем речь...</p>
        ) : null}
        {item.transcriptionError ? (
          <p className="metadata-message metadata-message-error">
            {item.transcriptionError}
          </p>
        ) : null}
        {transcription ? (
          <p className="metadata-message">
            ✓ transcription complete · {transcription.segments.length} segments ·{' '}
            language: {transcription.language}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function getOrientationLabel(metadata: VideoMetadata) {
  const orientationLabels = {
    vertical: 'Вертикальная',
    horizontal: 'Горизонтальная',
    square: 'Квадратная',
  }

  return orientationLabels[getSourceOrientation(metadata)]
}
