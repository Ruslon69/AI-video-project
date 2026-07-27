import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AISuggestion,
  EditingSubstage,
  MediaItem,
  ProjectOutputSettings,
  VideoMetadata,
} from '../../types'
import type { ComputedClip, EditProjection } from '../../selectors/editProjection'
import type { ProjectAnalysis } from '../../analysis/models'
import type {
  AnalysisReviewPresentation,
  AnalysisSeekTarget,
  AnalysisTimelineOverlay,
  RoughCutCandidate,
} from '../../selectors/analysisReviewSelectors'
import type {
  TimelineClipMediaPresentation,
  TimelineClipThumbnailPresentation,
} from '../../selectors/mediaAssetSelectors'
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
import { AnalysisReviewPanel } from './AnalysisReviewPanel'
import { RoughCutPlanPanel } from './RoughCutPlanPanel'
import type {
  RoughCutExecutionPresentation,
  RoughCutPlanItemPresentation,
  RoughCutPlanPresentation,
} from '../../planner/plannerSelectors'
import type {
  RoughCutPlanItemReviewStatus,
} from '../../planner/models'
import type { TimelineZoomState } from '../../timeline/TimelineViewportState'
import {
  usePlaybackControls,
  usePlaybackEngine,
  usePlaybackState,
} from '../../playback/PlaybackStore'
import { createPlaybackTimeline } from '../../playback/PlaybackTimeline'
import { createHTMLMediaPlaybackAdapter } from '../../playback/HTMLMediaPlaybackAdapter'

type VideoWorkspaceProps = {
  primaryItem: MediaItem | null
  hasPrimaryAsset: boolean
  sourcePreviewItem: MediaItem | null
  outputSettings: ProjectOutputSettings
  selectedSubstage: EditingSubstage
  aiSuggestions: AISuggestion[]
  computedClips: ComputedClip[]
  editProjection: EditProjection
  clipMediaPresentations: Record<string, TimelineClipMediaPresentation>
  clipThumbnailPresentations: Record<string, TimelineClipThumbnailPresentation>
  analysis: ProjectAnalysis | null
  analysisReviewPresentation: AnalysisReviewPresentation
  analysisTimelineOverlays: AnalysisTimelineOverlay[]
  roughCutCandidates: RoughCutCandidate[]
  roughCutPlanPresentation: RoughCutPlanPresentation
  roughCutExecutionPresentation: RoughCutExecutionPresentation
  activeRoughCutPlanItemId: string | null
  activeAnalysisTranscriptSegmentId: number | null
  activeAnalysisSilenceId: string | null
  selectedAISuggestionIds: string[]
  activeAISuggestionId: string | null
  selectedTimelineItemId: string | null
  previewMode: 'source' | 'timeline'
  seekRequest: SeekRequest | null
  timelineZoom: TimelineZoomState
  onReconnectSource: () => void
  isPrimarySourceConnecting: boolean
  primarySourceError: string | null
  onTimelinePreviewRequest: () => void
  onAnalysisSeek: (target: AnalysisSeekTarget) => void
  onRoughCutPlanItemActivate: (item: RoughCutPlanItemPresentation) => void
  onRoughCutPlanItemStatusChange: (
    itemId: string,
    status: RoughCutPlanItemReviewStatus,
  ) => void
  onAllRoughCutPlanItemsStatusChange: (
    status: RoughCutPlanItemReviewStatus,
  ) => void
  onRestoreRoughCutPlanDefaults: () => void
  onRebuildRoughCutPlan: () => void
  onApplyRoughCut: () => string | null
  onAISuggestionActivate: (suggestionId: string) => void
  onTimelineItemSelect: (timelineItemId: string | null) => void
  onTimelineZoomChange: (level: number) => void
  onMediaDurationChange: (mediaItemId: string, duration: number) => void
  onTrimCommit: (
    timelineItemId: string,
    relativeStart: number,
    relativeEnd: number,
    itemDuration: number,
  ) => void
  onSplitCommit: (timelineItemId: string, splitTime: number) => void
  canRippleDelete: boolean
  onRippleDeleteCommit: (
    timelineItemId: string,
    playheadTime: number,
  ) => void
  onMoveCommit: (timelineItemId: string, timelineStart: number) => void
}

// Coordinates active media preview, player seeking, timeline display, and analysis summaries.
export function VideoWorkspace({
  primaryItem,
  hasPrimaryAsset,
  sourcePreviewItem,
  outputSettings,
  selectedSubstage,
  aiSuggestions,
  computedClips,
  editProjection,
  clipMediaPresentations,
  clipThumbnailPresentations,
  analysis,
  analysisReviewPresentation,
  analysisTimelineOverlays,
  roughCutCandidates,
  roughCutPlanPresentation,
  roughCutExecutionPresentation,
  activeRoughCutPlanItemId,
  activeAnalysisTranscriptSegmentId,
  activeAnalysisSilenceId,
  selectedAISuggestionIds,
  activeAISuggestionId,
  selectedTimelineItemId,
  previewMode,
  seekRequest,
  timelineZoom,
  onReconnectSource,
  isPrimarySourceConnecting,
  primarySourceError,
  onTimelinePreviewRequest,
  onAnalysisSeek,
  onRoughCutPlanItemActivate,
  onRoughCutPlanItemStatusChange,
  onAllRoughCutPlanItemsStatusChange,
  onRestoreRoughCutPlanDefaults,
  onRebuildRoughCutPlan,
  onApplyRoughCut,
  onAISuggestionActivate,
  onTimelineItemSelect,
  onTimelineZoomChange,
  onMediaDurationChange,
  onTrimCommit,
  onSplitCommit,
  canRippleDelete,
  onRippleDeleteCommit,
  onMoveCommit,
}: VideoWorkspaceProps) {
  const displayedItem = previewMode === 'timeline'
    ? primaryItem
    : sourcePreviewItem

  return (
    <section className="video-workspace" aria-label="Видеоплеер">
      <div className="workspace-toolbar">
        <div>
          <p className="section-label">Предпросмотр</p>
          <h2>{displayedItem?.filename ?? 'Медиа не выбрано'}</h2>
          <p className="workspace-preview-mode">
            {previewMode === 'timeline' ? 'Timeline preview' : 'Source preview'}
          </p>
        </div>
        <div className="workspace-toolbar-actions">
          {previewMode === 'source' && primaryItem ? (
            <button
              type="button"
              className="ghost-button compact-button"
              onClick={onTimelinePreviewRequest}
            >
              Return to timeline
            </button>
          ) : null}
          <span className={`current-status current-status-${selectedSubstage.status}`}>
            <span aria-hidden="true" />
            {statusLabels[selectedSubstage.status]}
          </span>
        </div>
      </div>
      <MediaPreview
        primaryItem={primaryItem}
        hasPrimaryAsset={hasPrimaryAsset}
        sourcePreviewItem={sourcePreviewItem}
        previewMode={previewMode}
        aiSuggestions={aiSuggestions}
        computedClips={computedClips}
        clipMediaPresentations={clipMediaPresentations}
        clipThumbnailPresentations={clipThumbnailPresentations}
        analysisTimelineOverlays={analysisTimelineOverlays}
        activeAnalysisSilenceId={activeAnalysisSilenceId}
        selectedAISuggestionIds={selectedAISuggestionIds}
        activeAISuggestionId={activeAISuggestionId}
        selectedTimelineItemId={selectedTimelineItemId}
        seekRequest={seekRequest}
        timelineZoom={timelineZoom}
        onReconnectSource={onReconnectSource}
        isPrimarySourceConnecting={isPrimarySourceConnecting}
        primarySourceError={primarySourceError}
        onAISuggestionActivate={onAISuggestionActivate}
        onTimelineItemSelect={onTimelineItemSelect}
        onTimelineZoomChange={onTimelineZoomChange}
        onMediaDurationChange={onMediaDurationChange}
        onTrimCommit={onTrimCommit}
        onSplitCommit={onSplitCommit}
        canRippleDelete={canRippleDelete}
        onRippleDeleteCommit={onRippleDeleteCommit}
        onMoveCommit={onMoveCommit}
      />
      <AnalysisReviewPanel
        analysis={analysis}
        presentation={analysisReviewPresentation}
        projection={editProjection}
        candidates={roughCutCandidates}
        onSeek={onAnalysisSeek}
        activeTranscriptSegmentId={activeAnalysisTranscriptSegmentId}
        activePauseId={activeAnalysisSilenceId}
      />
      <RoughCutPlanPanel
        presentation={roughCutPlanPresentation}
        activeItemId={activeRoughCutPlanItemId}
        canRebuild={Boolean(analysis)}
        onActivate={onRoughCutPlanItemActivate}
        onItemStatusChange={onRoughCutPlanItemStatusChange}
        onAllStatusChange={onAllRoughCutPlanItemsStatusChange}
        onRestoreDefaults={onRestoreRoughCutPlanDefaults}
        onRebuild={onRebuildRoughCutPlan}
        execution={roughCutExecutionPresentation}
        onApply={onApplyRoughCut}
      />
      <p className="workspace-file">
        Активный подэтап: {selectedSubstage.title}
      </p>
      <VideoMetadataPanel
        item={displayedItem}
        outputSettings={outputSettings}
      />
    </section>
  )
}

function MediaPreview({
  primaryItem,
  hasPrimaryAsset,
  sourcePreviewItem,
  previewMode,
  aiSuggestions,
  computedClips,
  clipMediaPresentations,
  clipThumbnailPresentations,
  analysisTimelineOverlays,
  activeAnalysisSilenceId,
  selectedAISuggestionIds,
  activeAISuggestionId,
  selectedTimelineItemId,
  seekRequest,
  timelineZoom,
  onReconnectSource,
  isPrimarySourceConnecting,
  primarySourceError,
  onAISuggestionActivate,
  onTimelineItemSelect,
  onTimelineZoomChange,
  onMediaDurationChange,
  onTrimCommit,
  onSplitCommit,
  canRippleDelete,
  onRippleDeleteCommit,
  onMoveCommit,
}: {
  primaryItem: MediaItem | null
  hasPrimaryAsset: boolean
  sourcePreviewItem: MediaItem | null
  previewMode: 'source' | 'timeline'
  aiSuggestions: AISuggestion[]
  computedClips: ComputedClip[]
  clipMediaPresentations: Record<string, TimelineClipMediaPresentation>
  clipThumbnailPresentations: Record<string, TimelineClipThumbnailPresentation>
  analysisTimelineOverlays: AnalysisTimelineOverlay[]
  activeAnalysisSilenceId: string | null
  selectedAISuggestionIds: string[]
  activeAISuggestionId: string | null
  selectedTimelineItemId: string | null
  seekRequest: SeekRequest | null
  timelineZoom: TimelineZoomState
  onReconnectSource: () => void
  isPrimarySourceConnecting: boolean
  primarySourceError: string | null
  onAISuggestionActivate: (suggestionId: string) => void
  onTimelineItemSelect: (timelineItemId: string | null) => void
  onTimelineZoomChange: (level: number) => void
  onMediaDurationChange: (mediaItemId: string, duration: number) => void
  onTrimCommit: (
    timelineItemId: string,
    relativeStart: number,
    relativeEnd: number,
    itemDuration: number,
  ) => void
  onSplitCommit: (timelineItemId: string, splitTime: number) => void
  canRippleDelete: boolean
  onRippleDeleteCommit: (
    timelineItemId: string,
    playheadTime: number,
  ) => void
  onMoveCommit: (timelineItemId: string, timelineStart: number) => void
}) {
  const playbackEngine = usePlaybackEngine()
  const playbackControls = usePlaybackControls()
  const [videoDuration, setVideoDuration] = useState(0)
  const playbackTimeline = useMemo(
    () =>
      createPlaybackTimeline(
        computedClips,
        computedClips.length
          ? videoDuration || primaryItem?.metadata?.duration || 0
          : 0,
      ),
    [computedClips, primaryItem?.metadata?.duration, videoDuration],
  )
  const primaryMediaItemId = primaryItem?.id ?? null
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
      const duration = Number.isFinite(video.duration) ? video.duration : 0

      setVideoDuration(duration)
      if (primaryMediaItemId && duration > 0) {
        onMediaDurationChange(primaryMediaItemId, duration)
      }
      playbackEngine.synchronizeMedia(true)
    },
    [onMediaDurationChange, playbackEngine, primaryMediaItemId],
  )
  const handleSeekRequest = useCallback(
    (timestamp: number) => playbackControls.seek(timestamp),
    [playbackControls],
  )

  useEffect(() => {
    playbackEngine.configureTimeline(playbackTimeline)
  }, [playbackEngine, playbackTimeline])

  useEffect(() => {
    playbackControls.pause()
    setVideoDuration(primaryItem?.metadata?.duration ?? 0)
  }, [
    primaryItem?.id,
    primaryItem?.metadata?.duration,
    playbackControls,
  ])

  useEffect(() => {
    if (previewMode === 'source') {
      playbackControls.pause()
      return
    }

    playbackEngine.synchronizeMedia(true)
  }, [playbackControls, playbackEngine, previewMode])

  useEffect(() => {
    if (seekRequest) {
      playbackControls.seek(seekRequest.timelineTime)
    }
  }, [playbackControls, seekRequest])

  if (!primaryItem && !sourcePreviewItem && !hasPrimaryAsset) {
    return (
      <div className="video-frame">
        <div className="video-placeholder">
          <span className="play-mark" aria-hidden="true">
            ▶
          </span>
          <h2>Choose a main video</h2>
          <p>The main video becomes the single source for timeline editing.</p>
        </div>
      </div>
    )
  }

  const canPlayPrimary = Boolean(
    primaryItem?.type === 'video' && hasPlayableSource(primaryItem),
  )

  return (
    <>
      <section
        className="video-player-region"
        aria-label="Видеоплеер"
      >
        {canPlayPrimary ? (
          <div
            className="video-frame-player"
            hidden={previewMode !== 'timeline'}
          >
            <video
              ref={handleVideoRef}
              className="video-player"
              data-playback-role="timeline-primary"
              src={primaryItem?.objectUrl}
              playsInline
              preload="metadata"
              poster={primaryItem?.previews?.poster.data_url}
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
        ) : null}
        {!primaryItem ? (
          <MissingVideoSource
            isReconnecting={isPrimarySourceConnecting}
            error={primarySourceError}
            onReconnectSource={onReconnectSource}
          />
        ) : previewMode === 'source' ? (
          <SourceMediaPreview
            item={sourcePreviewItem}
            onMediaDurationChange={onMediaDurationChange}
          />
        ) : !canPlayPrimary ? (
          <MissingVideoSource
            isReconnecting={isPrimarySourceConnecting}
            error={primarySourceError}
            onReconnectSource={onReconnectSource}
          />
        ) : null}
      </section>
      {canPlayPrimary && previewMode === 'timeline' ? (
        <PlaybackControls />
      ) : null}
      {canPlayPrimary && primaryItem ? (
        <VideoTimeline
          item={primaryItem}
          duration={playbackTimeline.duration}
          aiSuggestions={aiSuggestions}
          computedClips={computedClips}
          clipMediaPresentations={clipMediaPresentations}
          clipThumbnailPresentations={clipThumbnailPresentations}
          analysisOverlays={analysisTimelineOverlays}
          activeAnalysisSilenceId={activeAnalysisSilenceId}
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
          canRippleDelete={canRippleDelete}
          onRippleDeleteCommit={onRippleDeleteCommit}
          onMoveCommit={onMoveCommit}
        />
      ) : null}
      {canPlayPrimary && primaryItem && previewMode === 'timeline' ? (
        <VideoFilmstrip
          item={primaryItem}
          onSeekRequest={handleSeekRequest}
        />
      ) : null}
    </>
  )
}

function SourceMediaPreview({
  item,
  onMediaDurationChange,
}: {
  item: MediaItem | null
  onMediaDurationChange: (mediaItemId: string, duration: number) => void
}) {
  if (!item) {
    return (
      <div className="video-frame">
        <div className="video-placeholder">
          <h2>Select a library video</h2>
          <p>Source preview does not change the edit timeline.</p>
        </div>
      </div>
    )
  }

  if (item.type === 'video' && hasPlayableSource(item)) {
    return (
      <div className="video-frame-player">
        <video
          className="video-player"
          data-playback-role="source-preview"
          src={item.objectUrl}
          controls
          playsInline
          preload="metadata"
          poster={item.previews?.poster.data_url}
          onLoadedMetadata={(event) => {
            const duration = event.currentTarget.duration

            if (Number.isFinite(duration) && duration > 0) {
              onMediaDurationChange(item.id, duration)
            }
          }}
        >
          Ваш браузер не поддерживает видео.
        </video>
      </div>
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
        <h2>{item.filename}</h2>
        <p>This source cannot be previewed in the video player.</p>
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
  isReconnecting,
  error,
  onReconnectSource,
}: {
  isReconnecting: boolean
  error: string | null
  onReconnectSource: () => void
}) {
  return (
    <div className="video-frame video-missing-source" role="status">
      <div className="video-placeholder">
        <h2>Исходный видеофайл недоступен после перезагрузки страницы.</h2>
        <p>
          {isReconnecting
            ? 'Подключаем видеофайл…'
            : 'Добавьте файл повторно, чтобы продолжить просмотр и монтаж.'}
        </p>
        {error ? <p className="video-source-error" role="alert">{error}</p> : null}
        <button
          type="button"
          className="primary-button"
          onClick={onReconnectSource}
          disabled={isReconnecting}
        >
          {isReconnecting ? 'Подключение…' : 'Выбрать видео повторно'}
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
