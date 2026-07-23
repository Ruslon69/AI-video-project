import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AISuggestion,
  EditingSubstage,
  MediaItem,
  ProjectOutputSettings,
  VideoMetadata,
} from '../../types'
import {
  normalizePlaybackTime,
  type ComputedClip,
} from '../../selectors/editProjection'
import type {
  SeekRequest,
  SeekRequestReason,
} from '../../state/ProjectState'
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
import { hasPlayableSource } from '../../utils/mediaSource'
import { statusLabels } from '../../utils/projectState'
import { VideoTimeline } from '../timeline/VideoTimeline'
import type { TimelineZoom } from '../timeline/timelineConstants'

const PLAYHEAD_UPDATE_EPSILON_SECONDS = 1 / 60

type VideoWorkspaceProps = {
  activeItem: MediaItem | null
  outputSettings: ProjectOutputSettings
  selectedSubstage: EditingSubstage
  aiSuggestions: AISuggestion[]
  computedClips: ComputedClip[]
  selectedAISuggestionIds: string[]
  activeAISuggestionId: string | null
  selectedTimelineItemId: string | null
  reportedPlaybackPosition: number
  seekRequest: SeekRequest | null
  timelineZoom: TimelineZoom
  onReconnectSource: () => void
  onAISuggestionActivate: (suggestionId: string) => void
  onTimelineItemSelect: (timelineItemId: string | null) => void
  onPlaybackPositionReport: (timestamp: number) => void
  onSeekRequest: (
    timestamp: number,
    reason: SeekRequestReason,
  ) => void
  onTimelineZoomChange: (zoom: TimelineZoom) => void
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
  reportedPlaybackPosition,
  seekRequest,
  timelineZoom,
  onReconnectSource,
  onAISuggestionActivate,
  onTimelineItemSelect,
  onPlaybackPositionReport,
  onSeekRequest,
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
        reportedPlaybackPosition={reportedPlaybackPosition}
        seekRequest={seekRequest}
        timelineZoom={timelineZoom}
        onReconnectSource={onReconnectSource}
        onAISuggestionActivate={onAISuggestionActivate}
        onTimelineItemSelect={onTimelineItemSelect}
        onPlaybackPositionReport={onPlaybackPositionReport}
        onSeekRequest={onSeekRequest}
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
  reportedPlaybackPosition,
  seekRequest,
  timelineZoom,
  onReconnectSource,
  onAISuggestionActivate,
  onTimelineItemSelect,
  onPlaybackPositionReport,
  onSeekRequest,
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
  reportedPlaybackPosition: number
  seekRequest: SeekRequest | null
  timelineZoom: TimelineZoom
  onReconnectSource: () => void
  onAISuggestionActivate: (suggestionId: string) => void
  onTimelineItemSelect: (timelineItemId: string | null) => void
  onPlaybackPositionReport: (timestamp: number) => void
  onSeekRequest: (
    timestamp: number,
    reason: SeekRequestReason,
  ) => void
  onTimelineZoomChange: (zoom: TimelineZoom) => void
  onTrimCommit: (
    timelineItemId: string,
    relativeStart: number,
    relativeEnd: number,
    itemDuration: number,
  ) => void
  onSplitCommit: (timelineItemId: string, splitTime: number) => void
  onMoveCommit: (timelineItemId: string, timelineStart: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const computedClipsRef = useRef(computedClips)
  const reportedPlaybackPositionRef = useRef(reportedPlaybackPosition)
  const [videoDuration, setVideoDuration] = useState(0)
  useEffect(() => {
    computedClipsRef.current = computedClips
  }, [computedClips])

  useEffect(() => {
    reportedPlaybackPositionRef.current = reportedPlaybackPosition
  }, [reportedPlaybackPosition])

  const stopPlayheadUpdates = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const syncPlaybackState = useCallback(() => {
    const video = videoRef.current
    if (!video) {
      return
    }
    const normalizedPlaybackTime = normalizePlaybackTime(
      computedClipsRef.current,
      video.currentTime,
    )

    if (video.currentTime !== normalizedPlaybackTime.time) {
      video.currentTime = normalizedPlaybackTime.time
    }
    if (!normalizedPlaybackTime.isPlayable) {
      video.pause()
      stopPlayheadUpdates()
    }
    onPlaybackPositionReport(normalizedPlaybackTime.time)
    setVideoDuration(Number.isFinite(video.duration) ? video.duration : 0)
  }, [onPlaybackPositionReport, stopPlayheadUpdates])

  const startPlayheadUpdates = useCallback(() => {
    stopPlayheadUpdates()
    const video = videoRef.current
    const initialPlaybackTime = normalizePlaybackTime(
      computedClipsRef.current,
      video?.currentTime ?? reportedPlaybackPositionRef.current,
    )

    if (!video || !initialPlaybackTime.isPlayable) {
      if (video) {
        video.pause()
        video.currentTime = initialPlaybackTime.time
      }
      onPlaybackPositionReport(initialPlaybackTime.time)
      return
    }

    const update = () => {
      const video = videoRef.current
      if (!video || video.paused || video.ended) {
        animationFrameRef.current = null
        return
      }

      const nextPlaybackTime = normalizePlaybackTime(
        computedClipsRef.current,
        video.currentTime,
      )

      if (!nextPlaybackTime.isPlayable) {
        video.pause()
        video.currentTime = nextPlaybackTime.time
        onPlaybackPositionReport(nextPlaybackTime.time)
        animationFrameRef.current = null
        return
      }

      if (nextPlaybackTime.time !== video.currentTime) {
        video.currentTime = nextPlaybackTime.time
        onPlaybackPositionReport(nextPlaybackTime.time)
      } else if (
        Math.abs(reportedPlaybackPositionRef.current - video.currentTime) >=
          PLAYHEAD_UPDATE_EPSILON_SECONDS
      ) {
        onPlaybackPositionReport(nextPlaybackTime.time)
      }
      animationFrameRef.current = window.requestAnimationFrame(update)
    }

    animationFrameRef.current = window.requestAnimationFrame(update)
  }, [onPlaybackPositionReport, stopPlayheadUpdates])

  const applySeekRequest = useCallback((timestamp: number) => {
    const video = videoRef.current
    const duration = video && Number.isFinite(video.duration)
      ? video.duration
      : item?.metadata?.duration ?? 0
    const normalizedPlaybackTime = normalizePlaybackTime(
      computedClipsRef.current,
      Math.min(Math.max(timestamp, 0), Math.max(duration, 0)),
    )

    if (video) {
      video.currentTime = normalizedPlaybackTime.time
      if (!normalizedPlaybackTime.isPlayable) {
        video.pause()
        stopPlayheadUpdates()
      }
    }

    onPlaybackPositionReport(normalizedPlaybackTime.time)
  }, [
    item?.metadata?.duration,
    onPlaybackPositionReport,
    stopPlayheadUpdates,
  ])

  useEffect(() => {
    stopPlayheadUpdates()
    const firstComputedClip = computedClipsRef.current[0] ?? null
    const resetPlaybackTime = normalizePlaybackTime(
      computedClipsRef.current,
      firstComputedClip?.visibleStart ?? 0,
    )

    if (videoRef.current) {
      videoRef.current.currentTime = resetPlaybackTime.time
      if (!resetPlaybackTime.isPlayable) {
        videoRef.current.pause()
      }
    }
    onPlaybackPositionReport(resetPlaybackTime.time)
    setVideoDuration(item?.metadata?.duration ?? 0)

    return stopPlayheadUpdates
  }, [
    item?.id,
    item?.metadata?.duration,
    onPlaybackPositionReport,
    stopPlayheadUpdates,
  ])

  useEffect(() => {
    if (seekRequest) {
      applySeekRequest(seekRequest.timelineTime)
    }
  }, [applySeekRequest, seekRequest])

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    const normalizedPlaybackTime = normalizePlaybackTime(
      computedClips,
      video.currentTime,
    )

    if (video.currentTime !== normalizedPlaybackTime.time) {
      video.currentTime = normalizedPlaybackTime.time
      onPlaybackPositionReport(normalizedPlaybackTime.time)
    }

    if (!normalizedPlaybackTime.isPlayable) {
      video.pause()
      stopPlayheadUpdates()
      return
    }

    if (!video.paused && animationFrameRef.current === null) {
      startPlayheadUpdates()
    }
  }, [
    computedClips,
    onPlaybackPositionReport,
    startPlayheadUpdates,
    stopPlayheadUpdates,
  ])

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
                ref={videoRef}
                className="video-player"
                src={item.objectUrl}
                controls
                playsInline
                preload="metadata"
                poster={item.previews?.poster.data_url}
                onLoadedMetadata={syncPlaybackState}
                onDurationChange={syncPlaybackState}
                onPlay={startPlayheadUpdates}
                onPause={syncPlaybackState}
                onEnded={() => {
                  stopPlayheadUpdates()
                  syncPlaybackState()
                }}
                onSeeked={syncPlaybackState}
              >
                Ваш браузер не поддерживает видео.
              </video>
            </div>
          ) : (
            <MissingVideoSource onReconnectSource={onReconnectSource} />
          )}
        </section>
        {canPlayVideo ? (
          <VideoTimeline
            item={item}
            currentTime={reportedPlaybackPosition}
            duration={videoDuration || item.metadata?.duration || 0}
            aiSuggestions={aiSuggestions}
            computedClips={computedClips}
            selectedAISuggestionIds={selectedAISuggestionIds}
            activeAISuggestionId={activeAISuggestionId}
            selectedTimelineItemId={selectedTimelineItemId}
            zoom={timelineZoom}
            onSeekRequest={onSeekRequest}
            onAISuggestionActivate={onAISuggestionActivate}
            onTimelineItemSelect={onTimelineItemSelect}
            onZoomChange={onTimelineZoomChange}
            onTrimCommit={onTrimCommit}
            onSplitCommit={onSplitCommit}
            onMoveCommit={onMoveCommit}
          />
        ) : null}
        <VideoFilmstrip
          item={item}
          onSeekRequest={onSeekRequest}
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
