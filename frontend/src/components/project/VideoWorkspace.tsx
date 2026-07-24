import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AISuggestion,
  EditingSubstage,
  MediaItem,
  ProjectOutputSettings,
  VideoMetadata,
} from '../../types'
import type { ComputedClip } from '../../selectors/editProjection'
import type {
  SeekRequest,
  SeekRequestReason,
} from '../../state/ProjectState'
import {
  formatBitrate,
  formatDuration,
  formatFileSize,
  formatNumber,
  formatPlaybackTime,
} from '../../utils/mediaFormat'
import {
  getSourceOrientation,
  isVideoCompatibleWithTarget,
} from '../../utils/projectSettings'
import { hasPlayableSource } from '../../utils/mediaSource'
import { statusLabels } from '../../utils/projectState'
import { VideoTimeline } from '../timeline/VideoTimeline'
import type { TimelineZoomState } from '../../timeline/TimelineViewportState'
import {
  usePlaybackControls,
  usePlaybackEngine,
  usePlaybackState,
} from '../../playback/PlaybackStore'
import { createPlaybackTimeline } from '../../playback/PlaybackTimeline'
import { createHTMLMediaPlaybackAdapter } from '../../playback/HTMLMediaPlaybackAdapter'

type VideoWorkspaceProps = {
  activeItem: MediaItem | null
  outputSettings: ProjectOutputSettings
  selectedSubstage: EditingSubstage
  aiSuggestions: AISuggestion[]
  computedClips: ComputedClip[]
  selectedAISuggestionIds: string[]
  activeAISuggestionId: string | null
  selectedTimelineItemId: string | null
  seekRequest: SeekRequest | null
  timelineZoom: TimelineZoomState
  onReconnectSource: () => void
  onAISuggestionActivate: (suggestionId: string) => void
  onTimelineItemSelect: (timelineItemId: string | null) => void
  onTimelineZoomChange: (level: number) => void
  onTrimCommit: (
    timelineItemId: string,
    relativeStart: number,
    relativeEnd: number,
    itemDuration: number,
  ) => void
  onSplitCommit: (timelineItemId: string, splitTime: number) => void
  onMoveCommit: (timelineItemId: string, timelineStart: number) => void
}

// Coordinates active media preview, player seeking, timeline display, and analysis summaries.
export function VideoWorkspace({
  activeItem,
  outputSettings,
  selectedSubstage,
  aiSuggestions,
  computedClips,
  selectedAISuggestionIds,
  activeAISuggestionId,
  selectedTimelineItemId,
  seekRequest,
  timelineZoom,
  onReconnectSource,
  onAISuggestionActivate,
  onTimelineItemSelect,
  onTimelineZoomChange,
  onTrimCommit,
  onSplitCommit,
  onMoveCommit,
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
      <MediaPreview
        item={activeItem}
        aiSuggestions={aiSuggestions}
        computedClips={computedClips}
        selectedAISuggestionIds={selectedAISuggestionIds}
        activeAISuggestionId={activeAISuggestionId}
        selectedTimelineItemId={selectedTimelineItemId}
        seekRequest={seekRequest}
        timelineZoom={timelineZoom}
        onReconnectSource={onReconnectSource}
        onAISuggestionActivate={onAISuggestionActivate}
        onTimelineItemSelect={onTimelineItemSelect}
        onTimelineZoomChange={onTimelineZoomChange}
        onTrimCommit={onTrimCommit}
        onSplitCommit={onSplitCommit}
        onMoveCommit={onMoveCommit}
      />
      <p className="workspace-file">
        Активный подэтап: {selectedSubstage.title}
      </p>
      <VideoMetadataPanel
        item={activeItem}
        outputSettings={outputSettings}
      />
    </section>
  )
}

function MediaPreview({
  item,
  aiSuggestions,
  computedClips,
  selectedAISuggestionIds,
  activeAISuggestionId,
  selectedTimelineItemId,
  seekRequest,
  timelineZoom,
  onReconnectSource,
  onAISuggestionActivate,
  onTimelineItemSelect,
  onTimelineZoomChange,
  onTrimCommit,
  onSplitCommit,
  onMoveCommit,
}: {
  item: MediaItem | null
  aiSuggestions: AISuggestion[]
  computedClips: ComputedClip[]
  selectedAISuggestionIds: string[]
  activeAISuggestionId: string | null
  selectedTimelineItemId: string | null
  seekRequest: SeekRequest | null
  timelineZoom: TimelineZoomState
  onReconnectSource: () => void
  onAISuggestionActivate: (suggestionId: string) => void
  onTimelineItemSelect: (timelineItemId: string | null) => void
  onTimelineZoomChange: (level: number) => void
  onTrimCommit: (
    timelineItemId: string,
    relativeStart: number,
    relativeEnd: number,
    itemDuration: number,
  ) => void
  onSplitCommit: (timelineItemId: string, splitTime: number) => void
  onMoveCommit: (timelineItemId: string, timelineStart: number) => void
}) {
  const playbackEngine = usePlaybackEngine()
  const playbackControls = usePlaybackControls()
  const [videoDuration, setVideoDuration] = useState(0)
  const playbackTimeline = useMemo(
    () =>
      createPlaybackTimeline(
        computedClips,
        videoDuration || item?.metadata?.duration || 0,
      ),
    [computedClips, item?.metadata?.duration, videoDuration],
  )
  const handleVideoRef = useCallback(
    (video: HTMLVideoElement | null) => {
      playbackEngine.attachMedia(
        video ? createHTMLMediaPlaybackAdapter(video) : null,
      )
    },
    [playbackEngine],
  )
  const handleVideoMetadata = useCallback(
    (video: HTMLVideoElement) => {
      setVideoDuration(Number.isFinite(video.duration) ? video.duration : 0)
      playbackEngine.synchronizeMedia(true)
    },
    [playbackEngine],
  )
  const handleSeekRequest = useCallback(
    (timestamp: number) => playbackControls.seek(timestamp),
    [playbackControls],
  )

  useEffect(() => {
    playbackEngine.configureTimeline(playbackTimeline)
  }, [playbackEngine, playbackTimeline])

  useEffect(() => {
    playbackControls.stop()
    setVideoDuration(item?.metadata?.duration ?? 0)
  }, [
    item?.id,
    item?.metadata?.duration,
    playbackControls,
  ])

  useEffect(() => {
    if (seekRequest) {
      playbackControls.seek(seekRequest.timelineTime)
    }
  }, [playbackControls, seekRequest])

  if (!item) {
    return (
      <div className="video-frame">
        <div className="video-placeholder">
          <span className="play-mark" aria-hidden="true">
            ▶
          </span>
          <h2>Добавьте медиа для предпросмотра</h2>
          <p>Видео и изображения из медиатеки появятся здесь.</p>
        </div>
      </div>
    )
  }

  if (item.type === 'video') {
    const canPlayVideo = hasPlayableSource(item)

    return (
      <>
        <section
          className="video-player-region"
          aria-label="Видеоплеер"
        >
          {canPlayVideo ? (
            <div className="video-frame-player">
              <video
                ref={handleVideoRef}
                className="video-player"
                src={item.objectUrl}
                playsInline
                preload="metadata"
                poster={item.previews?.poster.data_url}
                onLoadedMetadata={(event) =>
                  handleVideoMetadata(event.currentTarget)
                }
                onDurationChange={(event) =>
                  handleVideoMetadata(event.currentTarget)
                }
              >
                Ваш браузер не поддерживает видео.
              </video>
            </div>
          ) : (
            <MissingVideoSource onReconnectSource={onReconnectSource} />
          )}
        </section>
        {canPlayVideo ? (
          <>
            <PlaybackControls />
            <VideoTimeline
              item={item}
              duration={playbackTimeline.duration}
              aiSuggestions={aiSuggestions}
              computedClips={computedClips}
              selectedAISuggestionIds={selectedAISuggestionIds}
              activeAISuggestionId={activeAISuggestionId}
              selectedTimelineItemId={selectedTimelineItemId}
              zoom={timelineZoom}
              onSeekRequest={handleSeekRequest}
              onScrubStart={playbackControls.beginScrub}
              onScrubEnd={playbackControls.endScrub}
              onAISuggestionActivate={onAISuggestionActivate}
              onTimelineItemSelect={onTimelineItemSelect}
              onZoomChange={onTimelineZoomChange}
              onTrimCommit={onTrimCommit}
              onSplitCommit={onSplitCommit}
              onMoveCommit={onMoveCommit}
            />
          </>
        ) : null}
        <VideoFilmstrip
          item={item}
          onSeekRequest={handleSeekRequest}
        />
      </>
    )
  }

  if (item.type === 'image') {
    return (
      <div className="video-frame">
        <img
          className="image-player"
          src={item.objectUrl}
          alt={`Предпросмотр ${item.filename}`}
        />
      </div>
    )
  }

  return (
    <div className="video-frame">
      <div className="video-placeholder">
        <span className="play-mark" aria-hidden="true">
          ♪
        </span>
        <h2>{item.filename}</h2>
        <p>Аудиофайл добавлен в медиатеку. Предпросмотр доступен для видео и изображений.</p>
      </div>
    </div>
  )
}

function PlaybackControls() {
  const { status, currentTime, duration } = usePlaybackState()
  const { toggle, stop } = usePlaybackControls()
  const isPlaying = status === 'playing'
  const hasDuration = duration > 0

  return (
    <div
      className="playback-transport"
      data-playback-status={status}
      aria-label="Playback controls"
    >
      <div className="playback-transport-buttons">
        <button
          type="button"
          className="playback-control-button"
          disabled={!hasDuration}
          onClick={stop}
          aria-label="Stop"
          title="Stop"
        >
          <span aria-hidden="true">■</span>
        </button>
        <button
          type="button"
          className="playback-control-button playback-control-primary"
          disabled={!hasDuration}
          onClick={toggle}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
        </button>
      </div>
      <output
        className="playback-time-display"
        aria-label="Current playback time"
      >
        <span>{formatPlaybackTime(currentTime)}</span>
        <span aria-hidden="true">/</span>
        <span>{formatPlaybackTime(duration)}</span>
      </output>
    </div>
  )
}

function MissingVideoSource({
  onReconnectSource,
}: {
  onReconnectSource: () => void
}) {
  return (
    <div className="video-frame video-missing-source" role="status">
      <div className="video-placeholder">
        <h2>Исходный видеофайл недоступен после перезагрузки страницы.</h2>
        <p>Добавьте файл повторно, чтобы продолжить просмотр и монтаж.</p>
        <button
          type="button"
          className="primary-button"
          onClick={onReconnectSource}
        >
          Выбрать видео повторно
        </button>
      </div>
    </div>
  )
}

function VideoFilmstrip({
  item,
  onSeekRequest,
}: {
  item: MediaItem
  onSeekRequest: (
    timestamp: number,
    reason: SeekRequestReason,
  ) => void
}) {
  if (item.previewState === 'processing') {
    return (
      <section className="video-filmstrip video-filmstrip-message" aria-live="polite">
        Готовим кадры предпросмотра...
      </section>
    )
  }

  if (item.previewState === 'error' && item.previewError) {
    return (
      <section className="video-filmstrip video-filmstrip-error" aria-live="polite">
        {item.previewError}
      </section>
    )
  }

  if (!item.previews?.previews.length) {
    return null
  }

  return (
    <section className="video-filmstrip" aria-label="Кадры предпросмотра">
      <div className="video-filmstrip-scroll">
        {item.previews.previews.map((frame) => (
          <button
            key={frame.timestamp}
            type="button"
            className="video-filmstrip-frame"
            onClick={() => onSeekRequest(frame.timestamp, 'filmstrip')}
            aria-label={`Перейти к ${formatDuration(frame.timestamp)}`}
          >
            <img src={frame.data_url} alt="" aria-hidden="true" />
            <span>{formatDuration(frame.timestamp)}</span>
          </button>
        ))}
      </div>
    </section>
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

  const metadata: VideoMetadata | null = item.metadata
  const isCompatible = metadata
    ? isVideoCompatibleWithTarget(metadata, outputSettings.aspectRatio)
    : true
  const items = metadata
    ? [
        ['Файл', metadata.filename],
        ['Длительность', formatDuration(metadata.duration)],
        ['Размер кадра', `${metadata.width}×${metadata.height}`],
        ['Ориентация', getOrientationLabel(metadata)],
        ['FPS', formatNumber(metadata.fps)],
        ['Кодек', metadata.codec],
        ['Битрейт', formatBitrate(metadata.bitrate)],
        ['Размер файла', formatFileSize(metadata.file_size)],
      ]
    : []
  const sceneSegments = item.scenes?.scenes ?? []
  const transcription = item.transcription

  return (
    <section className="video-analysis" aria-label="Анализ видео">
      <section
        className={`video-analysis-section metadata-panel${
          item.status === 'error' && item.errorMessage ? ' metadata-panel-error' : ''
        }`}
        aria-live="polite"
      >
        <p className="section-label">Метаданные видео</p>
        {item.status === 'uploading' || item.status === 'metadata' ? (
          <p className="metadata-message">Анализируем видео...</p>
        ) : null}
        {item.status === 'error' && item.errorMessage ? (
          <p className="metadata-message metadata-message-error">
            {item.errorMessage}
          </p>
        ) : null}
        {!metadata && item.status !== 'uploading' && item.status !== 'metadata' ? (
          <p className="metadata-message">Метаданные пока недоступны.</p>
        ) : null}
        {metadata ? (
          <>
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
          </>
        ) : null}
      </section>

      <section
        className="video-analysis-section scene-summary"
        aria-live="polite"
      >
        <div className="scene-summary-head">
          <p className="section-label">Сцены</p>
          <strong>
            {item.sceneState === 'ready' && item.scenes?.outcome === 'scenes_detected'
              ? `${sceneSegments.length}`
              : item.sceneState === 'processing'
                ? '...'
                : '0'}
          </strong>
        </div>
        {item.sceneState === 'processing' ? (
          <p className="metadata-message">Определяем смены сцен...</p>
        ) : null}
        {item.sceneState === 'ready' && item.scenes?.outcome === 'scenes_detected' ? (
          <p className="metadata-message">
            Scenes detected: {sceneSegments.length}
          </p>
        ) : null}
        {item.sceneState === 'ready' && item.scenes?.outcome === 'no_scene_changes' ? (
          <p className="metadata-message">No scene changes detected</p>
        ) : null}
        {item.sceneError ? (
          <p className="metadata-message metadata-message-error">
            {item.sceneError}
          </p>
        ) : null}
        {item.sceneState === 'idle' ? (
          <p className="metadata-message">Анализ сцен еще не выполнен.</p>
        ) : null}
        {item.scenes?.outcome === 'scenes_detected' ? (
          <div className="scene-timestamp-list" aria-label="Сегменты сцен">
            {sceneSegments.map((scene) => (
              <span key={scene.id}>
                {formatDuration(scene.start)} - {formatDuration(scene.end)}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section
        className="video-analysis-section scene-summary"
        aria-live="polite"
      >
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
        {!transcription && item.transcriptionState === 'idle' ? (
          <p className="metadata-message">Транскрипция еще не выполнена.</p>
        ) : null}
        {!transcription &&
          item.transcriptionState !== 'idle' &&
          item.transcriptionState !== 'processing' &&
          !item.transcriptionError ? (
            <p className="metadata-message">Транскрипция пока недоступна.</p>
          ) : null}
      </section>
    </section>
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
