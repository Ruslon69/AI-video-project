import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { CSSProperties } from 'react'
import type {
  AISuggestion,
  MediaItem,
  VideoScene,
  VideoTranscriptSegment,
} from '../../types'
import {
  canSplitComputedClipAtTime,
  type ComputedClip,
  type DeleteRange,
} from '../../selectors/editProjection'
import {
  minimumTrimDuration,
  normalizeTrimRange,
  type ClipTrimRange,
} from '../../selectors/editSelectors'
import { getAISuggestionTitle } from '../../utils/aiSuggestions'
import { formatDuration } from '../../utils/mediaFormat'
import type {
  TimelineItem as TimelineItemModel,
  TimelineTrack as TimelineTrackModel,
} from './timelineTypes'
import type { SeekRequestReason } from '../../state/ProjectState'
import {
  sampleTimelineClipThumbnailFrames,
  type TimelineClipMediaPresentation,
  type TimelineClipThumbnailPresentation,
} from '../../selectors/mediaAssetSelectors'
import type { AnalysisTimelineOverlay } from '../../selectors/analysisReviewSelectors'
import {
  KEYBOARD_SEEK_SECONDS,
  SNAP_ENTER_THRESHOLD_PIXELS,
  SNAP_RELEASE_THRESHOLD_PIXELS,
  SNAP_SWITCH_MARGIN_PIXELS,
  TIMELINE_CLIP_LABEL_COMPACT_WIDTH_PIXELS,
  TIMELINE_CLIP_LABEL_MINIMAL_WIDTH_PIXELS,
  TIMELINE_CLIP_THUMBNAIL_TARGET_WIDTH_PIXELS,
  TIMELINE_ITEM_MIN_WIDTH_PIXELS,
  TIMELINE_RULER_TARGET_TICK_SPACING_PIXELS,
} from './timelineConstants'
import {
  createTimelineGeometry,
  type TimelineGeometry,
} from '../../timeline/TimelineScale'
import {
  createTimelineZoomState,
  stepTimelineZoom,
  timelineZoomConfig,
  zoomTimelineFromWheel,
  type TimelineZoomState,
} from '../../timeline/TimelineViewportState'
import {
  usePlaybackEngine,
  usePlaybackState,
} from '../../playback/PlaybackStore'

type VideoTimelineProps = {
  item: MediaItem
  duration: number
  aiSuggestions: AISuggestion[]
  computedClips: ComputedClip[]
  clipMediaPresentations: Record<string, TimelineClipMediaPresentation>
  clipThumbnailPresentations: Record<string, TimelineClipThumbnailPresentation>
  analysisOverlays: AnalysisTimelineOverlay[]
  activeAnalysisSilenceId: string | null
  selectedAISuggestionIds: string[]
  activeAISuggestionId: string | null
  selectedTimelineItemId: string | null
  zoom: TimelineZoomState
  onSeekRequest: (
    timestamp: number,
    reason: SeekRequestReason,
  ) => void
  onScrubStart: () => void
  onScrubEnd: () => void
  onAISuggestionActivate: (suggestionId: string) => void
  onTimelineItemSelect: (timelineItemId: string | null) => void
  onZoomChange: (level: number) => void
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

type TimelineHeaderProps = {
  duration: number
  zoom: TimelineZoomState
  computedClips: ComputedClip[]
  selectedTimelineItemId: string | null
  canRippleDelete: boolean
  showAnalysisMarkers: boolean
  onZoomChange: (level: number) => void
  onShowAnalysisMarkersChange: (show: boolean) => void
  onSplitCommit: (timelineItemId: string, splitTime: number) => void
  onRippleDeleteCommit: (
    timelineItemId: string,
    playheadTime: number,
  ) => void
}

type TimelineRulerProps = {
  ticks: TimelineTick[]
  geometry: TimelineGeometry
}

type TimelinePlayheadProps = {
  duration: number
  geometry: TimelineGeometry
}

type TimelineTrackProps = {
  track: TimelineTrackModel
  geometry: TimelineGeometry
  duration: number
  getCurrentTime: () => number
  computedClips: ComputedClip[]
  clipMediaPresentations: Record<string, TimelineClipMediaPresentation>
  clipThumbnailPresentations: Record<string, TimelineClipThumbnailPresentation>
  selectedItemId: string | null
  activeMoveDragItemId: string | null
  snapGuide: SnapGuide | null
  selectedAISuggestionIds: string[]
  activeAISuggestionId: string | null
  onItemSelect: (item: TimelineItemModel) => void
  onClipSelect: (timelineItemId: string) => void
  onClipSeek: (timestamp: number) => void
  onMoveDragStart: (
    timelineItemId: string,
    cancelMoveDrag: () => void,
  ) => void
  onMoveDragEnd: () => void
  onMovePreviewEndChange: (previewEnd: number | null) => void
  onSnapGuideChange: (snapGuide: SnapGuide | null) => void
  onTrimCommit: (
    timelineItemId: string,
    relativeStart: number,
    relativeEnd: number,
    itemDuration: number,
  ) => void
  onMoveCommit: (timelineItemId: string, timelineStart: number) => void
}

type TimelineTick = {
  id: string
  timestamp: number
  label?: string
  isMajor: boolean
}

type SnapGuide = {
  id: string
  timestamp: number
  kind: 'clip-boundary' | 'playhead'
}

type DraggedSnapEdge = 'start' | 'end'

type ActiveSnapTarget = SnapGuide & {
  timelineStart: number
  draggedEdge: DraggedSnapEdge
  priority: number
}

type VisibleRange = {
  start: number
  end: number
}

type PendingZoomAnchor = {
  timestamp: number
  viewportCoordinate: number
  targetZoomLevel: number
}

const DRAG_EXTENSION_PADDING_SECONDS = 5
const TIME_EPSILON = 0.0001

// Renders timeline tracks, playhead/ruler controls, and maps media analysis into timeline blocks.
export function VideoTimeline({
  item,
  duration,
  aiSuggestions,
  computedClips,
  clipMediaPresentations,
  clipThumbnailPresentations,
  analysisOverlays,
  activeAnalysisSilenceId,
  selectedAISuggestionIds,
  activeAISuggestionId,
  selectedTimelineItemId,
  zoom,
  onSeekRequest,
  onScrubStart,
  onScrubEnd,
  onAISuggestionActivate,
  onTimelineItemSelect,
  onZoomChange,
  onTrimCommit,
  onSplitCommit,
  canRippleDelete,
  onRippleDeleteCommit,
  onMoveCommit,
}: VideoTimelineProps) {
  const playbackEngine = usePlaybackEngine()
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const pendingZoomAnchorRef = useRef<PendingZoomAnchor | null>(null)
  const isScrubbingRef = useRef(false)
  const activeMoveDragRef = useRef<{
    cancel: () => void
  } | null>(null)
  const [activeMoveDragItemId, setActiveMoveDragItemId] = useState<string | null>(null)
  const [moveDragPreviewEnd, setMoveDragPreviewEnd] = useState<number | null>(null)
  const [snapGuide, setSnapGuide] = useState<SnapGuide | null>(null)
  const [showAnalysisMarkers, setShowAnalysisMarkers] = useState(true)
  const projectedTimelineEnd = computedClips.length
    ? Math.max(...computedClips.map((clip) => clip.visibleEnd))
    : 0
  const safeDuration = Math.max(
    duration || item.metadata?.duration || 0,
    projectedTimelineEnd,
    0,
  )
  const timelineContentDuration = moveDragPreviewEnd
    ? Math.max(safeDuration, moveDragPreviewEnd + DRAG_EXTENSION_PADDING_SECONDS)
    : safeDuration
  const geometry = useMemo(
    () => createTimelineGeometry(timelineContentDuration, zoom),
    [timelineContentDuration, zoom],
  )
  const ticks = useMemo(
    () => getTimelineTicks(timelineContentDuration, geometry),
    [timelineContentDuration, geometry],
  )
  const tracks = useMemo(
    () => buildTimelineTracks(item, safeDuration, aiSuggestions),
    [item, safeDuration, aiSuggestions],
  )
  useEffect(() => {
    if (!activeMoveDragItemId) {
      return
    }

    const handleCancelMoveDrag = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()
      activeMoveDragRef.current?.cancel()
      activeMoveDragRef.current = null
      setActiveMoveDragItemId(null)
    }

    window.addEventListener('keydown', handleCancelMoveDrag)

    return () => {
      window.removeEventListener('keydown', handleCancelMoveDrag)
    }
  }, [activeMoveDragItemId])

  const handleMoveDragStart = (
    timelineItemId: string,
    cancelMoveDrag: () => void,
  ) => {
    activeMoveDragRef.current = {
      cancel: cancelMoveDrag,
    }
    setActiveMoveDragItemId(timelineItemId)
  }

  const handleMoveDragEnd = () => {
    activeMoveDragRef.current = null
    setActiveMoveDragItemId(null)
    setMoveDragPreviewEnd(null)
    setSnapGuide(null)
  }

  useLayoutEffect(() => {
    const scrollViewport = scrollViewportRef.current
    const zoomAnchor = pendingZoomAnchorRef.current

    if (!scrollViewport || !zoomAnchor) {
      return
    }

    scrollViewport.scrollLeft = geometry.scrollLeftForAnchor(
      zoomAnchor.timestamp,
      zoomAnchor.viewportCoordinate,
      scrollViewport.clientWidth,
    )
    pendingZoomAnchorRef.current = null
  }, [geometry])

  const handleSeekFromClientX = (
    clientX: number,
    element: HTMLElement,
    reason: SeekRequestReason,
  ) => {
    const rect = element.getBoundingClientRect()
    const timestamp = rect.width > 0
      ? geometry.timelineXToTime(clientX - rect.left)
      : 0
    onSeekRequest(timestamp, reason)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      isTimelineItemTarget(event.target) ||
      isTrimHandleTarget(event.target)
    ) {
      return
    }

    event.preventDefault()
    onTimelineItemSelect(null)
    onScrubStart()
    isScrubbingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    handleSeekFromClientX(event.clientX, event.currentTarget, 'timeline-pointer')
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) {
      return
    }

    event.preventDefault()
    handleSeekFromClientX(event.clientX, event.currentTarget, 'timeline-pointer')
  }

  const stopScrubbing = (event: PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) {
      return
    }

    isScrubbingRef.current = false
    onScrubEnd()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }

    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    onSeekRequest(
      clampTime(playbackEngine.getCurrentTime(), safeDuration) +
        direction * KEYBOARD_SEEK_SECONDS,
      'timeline-keyboard',
    )
  }

  const handleItemSelect = (timelineItem: TimelineItemModel) => {
    onTimelineItemSelect(timelineItem.id)
    if (timelineItem.aiSuggestion) {
      onAISuggestionActivate(timelineItem.aiSuggestion.id)
      return
    }
    onSeekRequest(timelineItem.start, 'timeline-item')
  }

  const handleZoomChange = useCallback((
    requestedLevel: number,
    clientX?: number,
  ) => {
    const scrollViewport = scrollViewportRef.current
    const nextZoom = createTimelineZoomState(requestedLevel)
    const activeZoomLevel =
      pendingZoomAnchorRef.current?.targetZoomLevel ?? zoom.level

    if (nextZoom.level === activeZoomLevel) {
      return
    }

    if (scrollViewport) {
      const viewportRect = scrollViewport.getBoundingClientRect()
      const viewportWidth = scrollViewport.clientWidth
      const requestedViewportCoordinate = clientX === undefined
        ? viewportWidth / 2
        : clientX - viewportRect.left
      const viewportCoordinate = Math.min(
        Math.max(requestedViewportCoordinate, 0),
        viewportWidth,
      )

      pendingZoomAnchorRef.current = {
        timestamp: geometry.viewportXToTime(viewportCoordinate, {
          scrollLeft: scrollViewport.scrollLeft,
          width: viewportWidth,
        }),
        viewportCoordinate,
        targetZoomLevel: nextZoom.level,
      }
    }

    onZoomChange(nextZoom.level)
  }, [geometry, onZoomChange, zoom.level])

  const handleZoomWheel = useCallback((event: globalThis.WheelEvent) => {
    if ((!event.ctrlKey && !event.metaKey) || event.deltaY === 0) {
      return
    }

    event.preventDefault()
    const currentZoomLevel =
      pendingZoomAnchorRef.current?.targetZoomLevel ?? zoom.level
    handleZoomChange(
      zoomTimelineFromWheel(currentZoomLevel, event.deltaY),
      event.clientX,
    )
  }, [handleZoomChange, zoom.level])

  useEffect(() => {
    const scrollViewport = scrollViewportRef.current

    if (!scrollViewport) {
      return
    }

    scrollViewport.addEventListener('wheel', handleZoomWheel, {
      passive: false,
    })

    return () => {
      scrollViewport.removeEventListener('wheel', handleZoomWheel)
    }
  }, [handleZoomWheel])

  if (safeDuration <= 0) {
    return null
  }

  return (
    <section className="video-timeline" aria-label="Видео таймлайн">
      <TimelineHeader
        duration={safeDuration}
        zoom={zoom}
        computedClips={computedClips}
        selectedTimelineItemId={selectedTimelineItemId}
        canRippleDelete={canRippleDelete}
        showAnalysisMarkers={showAnalysisMarkers}
        onZoomChange={handleZoomChange}
        onShowAnalysisMarkersChange={setShowAnalysisMarkers}
        onSplitCommit={onSplitCommit}
        onRippleDeleteCommit={onRippleDeleteCommit}
      />
      <div className="timeline-body">
        <div className="timeline-label-column" aria-hidden="true">
          <div className="timeline-ruler-spacer" />
          {tracks.map((track) => (
            <div key={track.id} className="timeline-track-label">
              {track.label}
            </div>
          ))}
        </div>
        <div
          ref={scrollViewportRef}
          className="timeline-scroll-viewport"
        >
          <div
            className="timeline-time-canvas"
            style={{
              width: `${geometry.contentWidth}px`,
              '--timeline-end-padding-viewport-count':
                geometry.endPaddingViewportCount,
            } as CSSProperties}
            aria-label="Перемотать видео по таймлайну"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopScrubbing}
            onPointerCancel={stopScrubbing}
            onKeyDown={handleKeyDown}
          >
            <TimelineRuler
              ticks={ticks}
              geometry={geometry}
            />
            <div className="timeline-track-stack">
              {tracks.map((track) => (
                <TimelineTrack
                  key={track.id}
                  track={track}
                  geometry={geometry}
                  duration={timelineContentDuration}
                  getCurrentTime={playbackEngine.getCurrentTime}
                  computedClips={computedClips}
                  clipMediaPresentations={clipMediaPresentations}
                  clipThumbnailPresentations={clipThumbnailPresentations}
                  selectedItemId={selectedTimelineItemId}
                  activeMoveDragItemId={activeMoveDragItemId}
                  snapGuide={snapGuide}
                  selectedAISuggestionIds={selectedAISuggestionIds}
                  activeAISuggestionId={activeAISuggestionId}
                  onItemSelect={handleItemSelect}
                  onClipSelect={onTimelineItemSelect}
                  onClipSeek={(timestamp) =>
                    onSeekRequest(timestamp, 'timeline-item')
                  }
                  onMoveDragStart={handleMoveDragStart}
                  onMoveDragEnd={handleMoveDragEnd}
                  onMovePreviewEndChange={setMoveDragPreviewEnd}
                  onSnapGuideChange={setSnapGuide}
                  onTrimCommit={onTrimCommit}
                  onMoveCommit={onMoveCommit}
                />
              ))}
            </div>
            <TimelineDeleteOverlays
              deletedRanges={computedClips.flatMap((clip) => clip.deletedRanges)}
              geometry={geometry}
            />
            {showAnalysisMarkers ? (
              <TimelineAnalysisOverlays
                overlays={analysisOverlays}
                geometry={geometry}
                activeSilenceId={activeAnalysisSilenceId}
              />
            ) : null}
            <TimelinePlayhead
              duration={safeDuration}
              geometry={geometry}
            />
            <TimelineSnapGuide
              snapGuide={snapGuide}
              geometry={geometry}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function TimelineSnapGuide({
  snapGuide,
  geometry,
}: {
  snapGuide: SnapGuide | null
  geometry: TimelineGeometry
}) {
  if (!snapGuide) {
    return null
  }

  return (
    <span
      className="timeline-snap-guide"
      data-snap-kind={snapGuide.kind}
      style={{ left: `${geometry.timeToTimelineX(snapGuide.timestamp)}px` }}
      aria-hidden="true"
    />
  )
}

function TimelineDeleteOverlays({
  deletedRanges,
  geometry,
}: {
  deletedRanges: DeleteRange[]
  geometry: TimelineGeometry
}) {
  return (
    <div className="timeline-delete-overlay-layer" aria-hidden="true">
      {deletedRanges.map((range) => (
        <span
          key={range.operationId}
          className="timeline-delete-overlay"
          style={{
            left: `${geometry.timeToTimelineX(range.start)}px`,
            width: `${Math.max(
              geometry.durationToPixels(range.end - range.start),
              TIMELINE_ITEM_MIN_WIDTH_PIXELS,
            )}px`,
          }}
        />
      ))}
    </div>
  )
}

function TimelineAnalysisOverlays({
  overlays,
  geometry,
  activeSilenceId,
}: {
  overlays: AnalysisTimelineOverlay[]
  geometry: TimelineGeometry
  activeSilenceId: string | null
}) {
  return (
    <div className="timeline-analysis-overlay-layer" aria-hidden="true">
      {overlays.map((overlay) => (
        <span
          key={overlay.id}
          className="timeline-analysis-overlay"
          data-analysis-marker={overlay.kind}
          data-active={
            overlay.kind === 'silence-range' &&
            overlay.sourceId === activeSilenceId
              ? true
              : undefined
          }
          style={{
            left: `${geometry.timeToTimelineX(overlay.timelineStart)}px`,
            width: overlay.kind === 'silence-range'
              ? `${Math.max(
                geometry.durationToPixels(
                  overlay.timelineEnd - overlay.timelineStart,
                ),
                2,
              )}px`
              : undefined,
          }}
        />
      ))}
    </div>
  )
}

function isTimelineItemTarget(target: EventTarget) {
  return target instanceof Element &&
    Boolean(target.closest('.timeline-item, .timeline-video-strip'))
}

function isTrimHandleTarget(target: EventTarget) {
  return target instanceof Element && Boolean(target.closest('.timeline-trim-handle'))
}

function TimelineHeader({
  duration,
  zoom,
  computedClips,
  selectedTimelineItemId,
  canRippleDelete,
  showAnalysisMarkers,
  onZoomChange,
  onShowAnalysisMarkersChange,
  onSplitCommit,
  onRippleDeleteCommit,
}: TimelineHeaderProps) {
  const { currentTime } = usePlaybackState()
  const clampedCurrentTime = clampTime(currentTime, duration)
  const selectedSplitTargetClip = selectedTimelineItemId
    ? computedClips.find(
        (clip) =>
          clip.timelineItemId === selectedTimelineItemId &&
          canSplitComputedClipAtTime(clip, clampedCurrentTime),
      ) ?? null
    : null
  const zoomLevel = zoom.level
  const isAtMinimumZoom = zoomLevel <= timelineZoomConfig.minimum
  const isAtMaximumZoom = zoomLevel >= timelineZoomConfig.maximum

  return (
    <div className="video-timeline-head">
      <div>
        <p className="section-label">Таймлайн</p>
        <span>
          {formatDuration(clampedCurrentTime)} / {formatDuration(duration)}
        </span>
      </div>
      <div className="timeline-zoom" aria-label="Масштаб таймлайна">
        <label className="timeline-analysis-toggle">
          <input
            type="checkbox"
            checked={showAnalysisMarkers}
            onChange={(event) => onShowAnalysisMarkersChange(event.currentTarget.checked)}
          />
          <span>Метки анализа</span>
        </label>
        <span className="timeline-action-tooltip" data-tooltip="Split at playhead">
          <button
            type="button"
            className="timeline-action-button"
            disabled={!selectedSplitTargetClip}
            onClick={() => {
              if (selectedSplitTargetClip) {
                onSplitCommit(
                  selectedSplitTargetClip.timelineItemId,
                  clampedCurrentTime,
                )
              }
            }}
            aria-label="Split at playhead"
          >
            Split
          </button>
        </span>
        <span
          className="timeline-action-tooltip"
          data-tooltip="Remove selected clip and close the gap"
        >
          <button
            type="button"
            className="timeline-action-button"
            disabled={!canRippleDelete || !selectedTimelineItemId}
            onClick={() => {
              if (canRippleDelete && selectedTimelineItemId) {
                onRippleDeleteCommit(
                  selectedTimelineItemId,
                  clampedCurrentTime,
                )
              }
            }}
            aria-label="Ripple Delete selected clip"
          >
            Ripple Delete
          </button>
        </span>
        <span
          className="timeline-action-tooltip"
          data-tooltip="Zoom out"
        >
          <button
            type="button"
            className="timeline-zoom-button"
            disabled={isAtMinimumZoom}
            onClick={() => onZoomChange(stepTimelineZoom(zoomLevel, -1))}
            aria-label="Zoom out"
          >
            −
          </button>
        </span>
        <input
          className="timeline-zoom-slider"
          type="range"
          min={timelineZoomConfig.minimum}
          max={timelineZoomConfig.maximum}
          step={timelineZoomConfig.sliderStep}
          value={zoomLevel}
          onChange={(event) => onZoomChange(Number(event.currentTarget.value))}
          aria-label="Timeline zoom"
          aria-valuetext={`${Math.round(zoomLevel)}%`}
        />
        <span
          className="timeline-action-tooltip"
          data-tooltip="Zoom in"
        >
          <button
            type="button"
            className="timeline-zoom-button"
            disabled={isAtMaximumZoom}
            onClick={() => onZoomChange(stepTimelineZoom(zoomLevel, 1))}
            aria-label="Zoom in"
          >
            +
          </button>
        </span>
        <output className="timeline-zoom-value">
          {Math.round(zoomLevel)}%
        </output>
      </div>
    </div>
  )
}

function TimelineRuler({ ticks, geometry }: TimelineRulerProps) {
  return (
    <div className="timeline-ruler" aria-hidden="true">
      {ticks.map((tick) => (
        <span
          key={tick.id}
          className={tick.isMajor ? 'timeline-ruler-tick-major' : 'timeline-ruler-tick-minor'}
          style={{ left: `${geometry.timeToTimelineX(tick.timestamp)}px` }}
        >
          {tick.label ? <span>{tick.label}</span> : null}
        </span>
      ))}
    </div>
  )
}

function TimelinePlayhead({ duration, geometry }: TimelinePlayheadProps) {
  const { currentTime } = usePlaybackState()
  const clampedCurrentTime = clampTime(currentTime, duration)

  return (
    <span
      className="timeline-playhead-line"
      style={{ left: `${geometry.timeToTimelineX(clampedCurrentTime)}px` }}
      role="slider"
      tabIndex={0}
      aria-label="Перемотать видео по таймлайну"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(clampedCurrentTime)}
      aria-valuetext={`${formatDuration(clampedCurrentTime)} of ${formatDuration(duration)}`}
    />
  )
}

function TimelineTrack({
  track,
  geometry,
  duration,
  getCurrentTime,
  computedClips,
  clipMediaPresentations,
  clipThumbnailPresentations,
  selectedItemId,
  activeMoveDragItemId,
  snapGuide,
  selectedAISuggestionIds,
  activeAISuggestionId,
  onItemSelect,
  onClipSelect,
  onClipSeek,
  onMoveDragStart,
  onMoveDragEnd,
  onMovePreviewEndChange,
  onSnapGuideChange,
  onTrimCommit,
  onMoveCommit,
}: TimelineTrackProps) {
  return (
    <div
      className={`timeline-track timeline-track-${track.id}`}
      data-track-id={track.id}
      aria-label={track.label}
    >
      <div className="timeline-track-lane">
        {track.id === 'video' ? (
          computedClips.length ? (
            computedClips.map((computedClip) => (
              <TimelineVideoStrip
                key={computedClip.id}
                computedClip={computedClip}
                mediaPresentation={clipMediaPresentations[computedClip.timelineItemId]}
                thumbnailPresentation={
                  clipThumbnailPresentations[computedClip.timelineItemId]
                }
                duration={duration}
                getCurrentTime={getCurrentTime}
                geometry={geometry}
                allComputedClips={computedClips}
                isSelected={selectedItemId === computedClip.timelineItemId}
                isMoveDragging={activeMoveDragItemId === computedClip.timelineItemId}
                isSnapTarget={
                  snapGuide?.kind === 'clip-boundary' &&
                  snapGuide.id.startsWith(`${computedClip.timelineItemId}-`)
                }
                onSelect={onClipSelect}
                onSeek={onClipSeek}
                onMoveDragStart={onMoveDragStart}
                onMoveDragEnd={onMoveDragEnd}
                onMovePreviewEndChange={onMovePreviewEndChange}
                onSnapGuideChange={onSnapGuideChange}
                onTrimCommit={onTrimCommit}
                onMoveCommit={onMoveCommit}
              />
            ))
          ) : null
        ) : null}
        {track.id !== 'video' && track.items.length ? (
          track.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`timeline-item timeline-item-${item.kind}`}
              data-track-id={item.trackId}
              data-item-id={item.id}
              data-ai-status={item.aiSuggestion?.status}
              data-selected={
                item.aiSuggestion
                  ? selectedAISuggestionIds.includes(item.aiSuggestion.id)
                  : selectedItemId === item.id
              }
              data-active={item.aiSuggestion?.id === activeAISuggestionId}
              style={getTimelineItemStyle(item, geometry)}
              title={getTimelineItemTitle(item)}
              onClick={(event) => {
                event.stopPropagation()
                onItemSelect(item)
              }}
            >
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt="" aria-hidden="true" />
              ) : null}
              <span>{item.label}</span>
            </button>
          ))
        ) : track.id !== 'video' ? (
          <span className="timeline-empty-item">{track.emptyLabel}</span>
        ) : null}
      </div>
    </div>
  )
}

function TimelineVideoStrip({
  computedClip,
  mediaPresentation,
  thumbnailPresentation,
  duration,
  getCurrentTime,
  geometry,
  allComputedClips,
  isSelected,
  isMoveDragging,
  isSnapTarget,
  onSelect,
  onSeek,
  onMoveDragStart,
  onMoveDragEnd,
  onMovePreviewEndChange,
  onSnapGuideChange,
  onTrimCommit,
  onMoveCommit,
}: {
  computedClip: ComputedClip
  mediaPresentation: TimelineClipMediaPresentation | undefined
  thumbnailPresentation: TimelineClipThumbnailPresentation | undefined
  duration: number
  getCurrentTime: () => number
  geometry: TimelineGeometry
  allComputedClips: ComputedClip[]
  isSelected: boolean
  isMoveDragging: boolean
  isSnapTarget: boolean
  onSelect: (timelineItemId: string) => void
  onSeek: (timestamp: number) => void
  onMoveDragStart: (
    timelineItemId: string,
    cancelMoveDrag: () => void,
  ) => void
  onMoveDragEnd: () => void
  onMovePreviewEndChange: (previewEnd: number | null) => void
  onSnapGuideChange: (snapGuide: SnapGuide | null) => void
  onTrimCommit: (
    timelineItemId: string,
    relativeStart: number,
    relativeEnd: number,
    itemDuration: number,
  ) => void
  onMoveCommit: (timelineItemId: string, timelineStart: number) => void
}) {
  const [previewTrim, setPreviewTrim] = useState<ClipTrimRange | null>(null)
  const [previewTimelineStart, setPreviewTimelineStart] = useState<number | null>(null)
  const trimRange = {
    trimStart: computedClip.visibleStart,
    trimEnd: computedClip.visibleEnd,
  }
  const activeTrim = previewTrim ?? trimRange
  const activeTimelineStart = previewTimelineStart ?? computedClip.segmentStart
  const timelineOffset = activeTimelineStart - computedClip.segmentStart
  const displayStart = activeTrim.trimStart + timelineOffset
  const displayEnd = activeTrim.trimEnd + timelineOffset
  const previewTrimRef = useRef<ClipTrimRange | null>(null)
  const previewTimelineStartRef = useRef<number | null>(null)
  const dragStateRef = useRef<{
    edge: 'start' | 'end'
    pointerId: number
  } | null>(null)
  const moveDragStateRef = useRef<{
    pointerId: number
    element: HTMLSpanElement
    startClientX: number
    initialTimelineStart: number
    lastRawTimelineStart: number
    moved: boolean
  } | null>(null)
  const activeSnapTargetRef = useRef<ActiveSnapTarget | null>(null)
  const suppressClickSeekRef = useRef(false)
  const displayWidth = Math.max(
    geometry.durationToPixels(displayEnd - displayStart),
    TIMELINE_ITEM_MIN_WIDTH_PIXELS,
  )
  const labelDensity = displayWidth < TIMELINE_CLIP_LABEL_MINIMAL_WIDTH_PIXELS
    ? 'minimal'
    : displayWidth < TIMELINE_CLIP_LABEL_COMPACT_WIDTH_PIXELS
      ? 'compact'
      : 'full'
  const clipPresentation = mediaPresentation ?? {
    assetId: computedClip.sourceClipId,
    mediaItemId: null,
    filename: computedClip.sourceClipId,
    sourceColor: '#7d8797',
    instanceIndex: 1,
    instanceCount: 1,
  }
  const clipDuration = formatDuration(computedClip.visibleDuration)
  const thumbnailCount = Math.max(
    1,
    Math.floor(displayWidth / TIMELINE_CLIP_THUMBNAIL_TARGET_WIDTH_PIXELS),
  )
  const thumbnailFrames = thumbnailPresentation
    ? sampleTimelineClipThumbnailFrames(
        thumbnailPresentation.frames,
        thumbnailCount,
      )
    : []
  const instanceLabel = clipPresentation.instanceCount > 1
    ? `Instance ${clipPresentation.instanceIndex} of ${clipPresentation.instanceCount}`
    : 'Timeline instance'

  useEffect(() => {
    setPreviewTrim(null)
    previewTrimRef.current = null
  }, [trimRange.trimStart, trimRange.trimEnd])

  useEffect(() => {
    setPreviewTimelineStart(null)
    previewTimelineStartRef.current = null
  }, [computedClip.segmentStart])

  const getPreviewTrim = (
    clientX: number,
    element: HTMLElement,
    edge: 'start' | 'end',
  ) => {
    const rect = element.getBoundingClientRect()
    const timestamp = rect.width > 0
      ? geometry.timelineXToTime(clientX - rect.left)
      : 0
    const currentTrim = previewTrimRef.current ?? trimRange

    return edge === 'start'
      ? normalizeTimelineSegmentTrimRange(
          timestamp,
          currentTrim.trimEnd,
          computedClip,
          duration,
        )
      : normalizeTimelineSegmentTrimRange(
          currentTrim.trimStart,
          timestamp,
          computedClip,
          duration,
        )
  }

  const updatePreviewTrim = (
    clientX: number,
    element: HTMLElement,
    edge: 'start' | 'end',
  ) => {
    const nextTrim = getPreviewTrim(clientX, element, edge)

    previewTrimRef.current = nextTrim
    setPreviewTrim(nextTrim)
  }

  const getTrimCoordinateElement = (target: HTMLElement) =>
    target.closest<HTMLElement>('.timeline-track-lane') ?? target

  const handleTrimPointerDown = (
    event: PointerEvent<HTMLSpanElement>,
    edge: 'start' | 'end',
  ) => {
    event.preventDefault()
    event.stopPropagation()
    dragStateRef.current = {
      edge,
      pointerId: event.pointerId,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    updatePreviewTrim(event.clientX, getTrimCoordinateElement(event.currentTarget), edge)
  }

  const handleTrimPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const dragState = dragStateRef.current

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    updatePreviewTrim(
      event.clientX,
      getTrimCoordinateElement(event.currentTarget),
      dragState.edge,
    )
  }

  const stopTrimDrag = (event: PointerEvent<HTMLSpanElement>) => {
    const dragState = dragStateRef.current

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    dragStateRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const finalTrim = previewTrimRef.current ?? previewTrim ?? trimRange

    if (
      Math.abs(finalTrim.trimStart - trimRange.trimStart) >= minimumTrimDuration / 2 ||
      Math.abs(finalTrim.trimEnd - trimRange.trimEnd) >= minimumTrimDuration / 2
    ) {
      onTrimCommit(
        computedClip.id,
        finalTrim.trimStart - computedClip.segmentStart,
        finalTrim.trimEnd - computedClip.segmentStart,
        computedClip.segmentEnd - computedClip.segmentStart || duration,
      )
    }

    setPreviewTrim(null)
    previewTrimRef.current = null
  }

  const cancelMoveDrag = () => {
    const moveDragState = moveDragStateRef.current

    if (moveDragState?.element.hasPointerCapture(moveDragState.pointerId)) {
      moveDragState.element.releasePointerCapture(moveDragState.pointerId)
    }

    moveDragStateRef.current = null
    activeSnapTargetRef.current = null
    previewTimelineStartRef.current = null
    setPreviewTimelineStart(null)
    onMovePreviewEndChange(null)
    onSnapGuideChange(null)
    onMoveDragEnd()
  }

  const finishMoveDrag = (
    event: PointerEvent<HTMLSpanElement>,
    shouldCommit: boolean,
  ) => {
    const moveDragState = moveDragStateRef.current

    if (!moveDragState || moveDragState.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const finalTimelineStart = previewTimelineStartRef.current ??
      moveDragState.initialTimelineStart

    suppressClickSeekRef.current = shouldCommit && moveDragState.moved
    moveDragStateRef.current = null
    activeSnapTargetRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const finalVisibleRange = getMovedVisibleRange(finalTimelineStart, computedClip)
    const isValidDrop = validatePlacement(
      finalVisibleRange,
      computedClip.id,
      allComputedClips,
    )

    if (
      shouldCommit &&
      isValidDrop &&
      moveDragState.moved &&
      Math.abs(finalTimelineStart - moveDragState.initialTimelineStart) >=
        minimumTrimDuration / 2
    ) {
      onMoveCommit(computedClip.timelineItemId, finalTimelineStart)
    }

    previewTimelineStartRef.current = null
    setPreviewTimelineStart(null)
    onMovePreviewEndChange(null)
    onSnapGuideChange(null)
    onMoveDragEnd()
  }

  const getNextMoveStart = (clientX: number) => {
    const moveDragState = moveDragStateRef.current

    if (!moveDragState) {
      return computedClip.segmentStart
    }

    const rawTimelineStart = moveDragState.initialTimelineStart +
      geometry.pixelsToDuration(clientX - moveDragState.startClientX)
    moveDragState.lastRawTimelineStart = rawTimelineStart
    const resolvedMove = getResolvedMoveStart(
      Math.max(rawTimelineStart, 0),
      computedClip,
      allComputedClips,
      getCurrentTime(),
      geometry,
      activeSnapTargetRef.current,
    )
    const nextTimelineStart = Math.max(resolvedMove.timelineStart, 0)

    activeSnapTargetRef.current = resolvedMove.activeSnapTarget
    onSnapGuideChange(activeSnapTargetRef.current)

    return nextTimelineStart
  }

  const handleMovePointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0 || isTrimHandleTarget(event.target)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    if (!isSelected) {
      onSelect(computedClip.timelineItemId)
      return
    }

    moveDragStateRef.current = {
      pointerId: event.pointerId,
      element: event.currentTarget,
      startClientX: event.clientX,
      initialTimelineStart: computedClip.segmentStart,
      lastRawTimelineStart: computedClip.segmentStart,
      moved: false,
    }
    previewTimelineStartRef.current = computedClip.segmentStart
    activeSnapTargetRef.current = null
    event.currentTarget.setPointerCapture(event.pointerId)
    onMoveDragStart(computedClip.timelineItemId, cancelMoveDrag)
  }

  const handleMovePointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const moveDragState = moveDragStateRef.current

    if (!moveDragState || moveDragState.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const nextTimelineStart = getNextMoveStart(event.clientX)

    moveDragState.moved = moveDragState.moved ||
      Math.abs(nextTimelineStart - moveDragState.initialTimelineStart) >=
        minimumTrimDuration / 2
    previewTimelineStartRef.current = nextTimelineStart
    onMovePreviewEndChange(getMovedVisibleRange(nextTimelineStart, computedClip).end)
    setPreviewTimelineStart(nextTimelineStart)
  }

  return (
    <span
      className="timeline-video-strip"
      data-selected={isSelected}
      data-dragging={isMoveDragging ? true : undefined}
      data-snap-target={isSnapTarget ? true : undefined}
      data-label-density={labelDensity}
      data-thumbnail-identity={thumbnailPresentation?.identity}
      data-thumbnail-state={thumbnailPresentation?.state ?? 'unavailable'}
      data-thumbnail-source-id={thumbnailPresentation?.sourceClipId}
      data-thumbnail-source-start={thumbnailPresentation?.sourceStart}
      data-thumbnail-source-end={thumbnailPresentation?.sourceEnd}
      role="button"
      tabIndex={0}
      style={{
        left: `${geometry.timeToTimelineX(displayStart)}px`,
        width: `${displayWidth}px`,
        '--timeline-source-color': clipPresentation.sourceColor,
      } as CSSProperties}
      title={`${clipPresentation.filename} - ${instanceLabel} - ${clipDuration}`}
      aria-label={`${clipPresentation.filename}, ${instanceLabel}, ${clipDuration}`}
      onPointerDown={handleMovePointerDown}
      onPointerMove={handleMovePointerMove}
      onPointerUp={(event) => finishMoveDrag(event, true)}
      onPointerCancel={(event) => finishMoveDrag(event, false)}
      onClick={(event) => {
        event.stopPropagation()
        if (isTrimHandleTarget(event.target)) {
          return
        }
        if (suppressClickSeekRef.current) {
          suppressClickSeekRef.current = false
          return
        }

        const coordinateElement = getTrimCoordinateElement(event.currentTarget)
        const rect = coordinateElement.getBoundingClientRect()
        const timestamp = geometry.timelineXToTime(event.clientX - rect.left)

        onSelect(computedClip.timelineItemId)
        onSeek(
          Math.min(
            Math.max(timestamp, computedClip.visibleStart),
            computedClip.visibleEnd,
          ),
        )
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(computedClip.timelineItemId)
        }
      }}
    >
      <TimelineClipFilmstrip
        presentation={thumbnailPresentation}
        frames={thumbnailFrames}
      />
      <span className="timeline-source-accent" aria-hidden="true" />
      <span className="timeline-video-strip-content">
        <span className="timeline-video-strip-name">
          {clipPresentation.filename}
        </span>
        <span className="timeline-video-strip-meta">
          {instanceLabel} · {clipDuration}
        </span>
      </span>
      {isSelected ? (
        <>
          <span
            className="timeline-trim-handle timeline-trim-handle-left"
            role="separator"
            aria-label="Trim clip start"
            onPointerDown={(event) => handleTrimPointerDown(event, 'start')}
            onPointerMove={handleTrimPointerMove}
            onPointerUp={stopTrimDrag}
            onPointerCancel={stopTrimDrag}
          />
          <span
            className="timeline-trim-handle timeline-trim-handle-right"
            role="separator"
            aria-label="Trim clip end"
            onPointerDown={(event) => handleTrimPointerDown(event, 'end')}
            onPointerMove={handleTrimPointerMove}
            onPointerUp={stopTrimDrag}
            onPointerCancel={stopTrimDrag}
          />
        </>
      ) : null}
    </span>
  )
}

function TimelineClipFilmstrip({
  presentation,
  frames,
}: {
  presentation: TimelineClipThumbnailPresentation | undefined
  frames: ReturnType<typeof sampleTimelineClipThumbnailFrames>
}) {
  if (!presentation || !frames.length) {
    return <span className="timeline-clip-filmstrip-fallback" aria-hidden="true" />
  }

  return (
    <span
      className="timeline-clip-filmstrip"
      data-thumbnail-identity={presentation.identity}
      style={{
        '--timeline-thumbnail-count': frames.length,
      } as CSSProperties}
      aria-hidden="true"
    >
      {frames.map((frame) => (
        <img
          key={`${presentation.identity}:${frame.sourceTimestamp}`}
          className="timeline-clip-thumbnail"
          src={frame.dataUrl}
          data-source-timestamp={frame.sourceTimestamp}
          alt=""
        />
      ))}
    </span>
  )
}

function normalizeTimelineSegmentTrimRange(
  trimStart: number,
  trimEnd: number,
  computedClip: ComputedClip,
  duration: number,
): ClipTrimRange {
  const trimRange = normalizeTrimRange(
    trimStart,
    trimEnd,
    computedClip.sourceDuration || duration,
  )
  const boundedStart = Math.min(
    Math.max(trimRange.trimStart, computedClip.segmentStart),
    computedClip.segmentEnd,
  )
  const boundedEnd = Math.min(
    Math.max(trimRange.trimEnd, boundedStart),
    computedClip.segmentEnd,
  )

  return boundedStart < boundedEnd
    ? {
        trimStart: boundedStart,
        trimEnd: boundedEnd,
      }
    : {
        trimStart: computedClip.visibleStart,
        trimEnd: computedClip.visibleEnd,
      }
}

function getMovedVisibleRange(
  timelineStart: number,
  draggedClip: ComputedClip,
): VisibleRange {
  const visibleOffset = draggedClip.visibleStart - draggedClip.segmentStart
  const visibleDuration = Math.max(draggedClip.visibleEnd - draggedClip.visibleStart, 0)
  const start = timelineStart + visibleOffset

  return {
    start,
    end: start + visibleDuration,
  }
}

function validatePlacement(
  candidateVisibleRange: VisibleRange,
  draggedComputedClipId: string,
  computedClips: ComputedClip[],
) {
  if (
    !Number.isFinite(candidateVisibleRange.start) ||
    !Number.isFinite(candidateVisibleRange.end) ||
    candidateVisibleRange.start < -TIME_EPSILON ||
    candidateVisibleRange.end < candidateVisibleRange.start - TIME_EPSILON
  ) {
    return false
  }

  return computedClips
    .filter((clip) => clip.id !== draggedComputedClipId)
    .every((clip) => !rangesOverlap(candidateVisibleRange, {
      start: clip.visibleStart,
      end: clip.visibleEnd,
    }))
}

function rangesOverlap(leftRange: VisibleRange, rightRange: VisibleRange) {
  return leftRange.start < rightRange.end - TIME_EPSILON &&
    leftRange.end > rightRange.start + TIME_EPSILON
}

function getResolvedMoveStart(
  rawCandidateTimelineStart: number,
  draggedClip: ComputedClip,
  computedClips: ComputedClip[],
  playheadTime: number,
  geometry: TimelineGeometry,
  activeSnapTarget: ActiveSnapTarget | null,
) {
  const rawCandidates = getSnapCandidates(
    rawCandidateTimelineStart,
    draggedClip,
    computedClips,
    playheadTime,
    geometry,
    SNAP_RELEASE_THRESHOLD_PIXELS,
  )
  const activeCandidate = activeSnapTarget
    ? rawCandidates.find(
        (candidate) =>
          candidate.id === activeSnapTarget.id &&
          candidate.draggedEdge === activeSnapTarget.draggedEdge &&
          candidate.distancePixels <= SNAP_RELEASE_THRESHOLD_PIXELS,
      ) ?? null
    : null
  const enterCandidates = rawCandidates.filter(
    (candidate) => candidate.distancePixels <= SNAP_ENTER_THRESHOLD_PIXELS,
  )
  const nearestEnterCandidate = sortSnapCandidates(enterCandidates)[0] ?? null

  if (
    activeCandidate &&
    nearestEnterCandidate &&
    nearestEnterCandidate.id !== activeCandidate.id &&
    nearestEnterCandidate.distancePixels + SNAP_SWITCH_MARGIN_PIXELS <
      activeCandidate.distancePixels
  ) {
    return {
      timelineStart: nearestEnterCandidate.timelineStart,
      activeSnapTarget: toActiveSnapTarget(nearestEnterCandidate),
    }
  }

  if (activeCandidate) {
    return {
      timelineStart: activeCandidate.timelineStart,
      activeSnapTarget: toActiveSnapTarget(activeCandidate),
    }
  }

  if (nearestEnterCandidate) {
    return {
      timelineStart: nearestEnterCandidate.timelineStart,
      activeSnapTarget: toActiveSnapTarget(nearestEnterCandidate),
    }
  }

  return {
    timelineStart: rawCandidateTimelineStart,
    activeSnapTarget: null,
  }
}

function getSnapCandidates(
  rawCandidateTimelineStart: number,
  draggedClip: ComputedClip,
  computedClips: ComputedClip[],
  playheadTime: number,
  geometry: TimelineGeometry,
  maxDistancePixels: number,
) {
  const visibleOffset = draggedClip.visibleStart - draggedClip.segmentStart
  const visibleDuration = Math.max(
    draggedClip.visibleEnd - draggedClip.visibleStart,
    0,
  )
  const requestedVisibleStart = rawCandidateTimelineStart + visibleOffset
  const requestedVisibleEnd = requestedVisibleStart + visibleDuration
  const siblingTargets = computedClips
    .filter((clip) => clip.id !== draggedClip.id)
    .flatMap((clip) => [
      {
        id: `${clip.timelineItemId}-start`,
        timestamp: clip.visibleStart,
        kind: 'clip-boundary' as const,
        targetItemId: clip.timelineItemId,
        priority: 0,
      },
      {
        id: `${clip.timelineItemId}-end`,
        timestamp: clip.visibleEnd,
        kind: 'clip-boundary' as const,
        targetItemId: clip.timelineItemId,
        priority: 0,
      },
    ])
  const snapTargets = [
    ...siblingTargets,
    {
      id: 'playhead',
      timestamp: playheadTime,
      kind: 'playhead' as const,
      targetItemId: null,
      priority: 1,
    },
  ]
  return sortSnapCandidates(snapTargets.flatMap((target) => [
    {
      ...target,
      draggedEdge: 'start' as const,
      timelineStart: target.timestamp - visibleOffset,
      distancePixels: Math.abs(
        geometry.durationToPixels(requestedVisibleStart - target.timestamp),
      ),
    },
    {
      ...target,
      draggedEdge: 'end' as const,
      timelineStart: target.timestamp - visibleOffset - visibleDuration,
      distancePixels: Math.abs(
        geometry.durationToPixels(requestedVisibleEnd - target.timestamp),
      ),
    },
  ]).filter(
    (candidate) => candidate.distancePixels <= maxDistancePixels,
  ))
}

function sortSnapCandidates<TCandidate extends {
  distancePixels: number
  priority: number
}>(snapCandidates: TCandidate[]) {
  return [...snapCandidates].sort((left, right) => {
    const distanceDelta = left.distancePixels - right.distancePixels

    return Math.abs(distanceDelta) > 0.0001
      ? distanceDelta
      : left.priority - right.priority
  })
}

function toActiveSnapTarget(candidate: ReturnType<typeof getSnapCandidates>[number]) {
  return {
    id: candidate.id,
    timestamp: candidate.timestamp,
    kind: candidate.kind,
    timelineStart: candidate.timelineStart,
    draggedEdge: candidate.draggedEdge,
    priority: candidate.priority,
  }
}

function buildTimelineTracks(
  item: MediaItem,
  duration: number,
  aiSuggestions: AISuggestion[],
): TimelineTrackModel[] {
  return [
    {
      id: 'video',
      label: 'Video',
      items: [],
      emptyLabel: 'Video track',
    },
    {
      id: 'scenes',
      label: 'Scenes',
      items: getSceneItems(item.scenes?.scenes ?? [], duration),
      emptyLabel: getSceneAnalysisMessage(item),
    },
    {
      id: 'transcript',
      label: 'Transcript',
      items: getTranscriptItems(item.transcription?.segments ?? [], duration),
      emptyLabel: getTranscriptMessage(item),
    },
    {
      id: 'ai-suggestions',
      label: 'AI Suggestions',
      items: getAISuggestionItems(aiSuggestions, duration),
      emptyLabel: 'No AI suggestions',
    },
  ]
}

function getSceneItems(scenes: VideoScene[], duration: number): TimelineItemModel[] {
  return scenes.map((scene, index) => {
    const start = clampTime(scene.start, duration)
    const end = clampTime(scene.end, duration)

    return {
      id: scene.id,
      trackId: 'scenes',
      kind: 'scene',
      start,
      end: Math.max(end, start + 0.1),
      label: `Scene ${index + 1}`,
      title: `Scene ${index + 1}: ${formatDuration(start)} - ${formatDuration(end)}`,
    }
  })
}

function getTranscriptItems(
  segments: VideoTranscriptSegment[],
  duration: number,
): TimelineItemModel[] {
  return segments.map((segment, index) => {
    const start = clampTime(segment.start, duration)
    const end = clampTime(segment.end, duration)
    const label = segment.text.trim() || `Segment ${index + 1}`

    return {
      id: `transcript-${segment.id}`,
      trackId: 'transcript',
      kind: 'transcript',
      start,
      end: Math.max(end, start + 0.1),
      label,
      title: `${formatDuration(start)} - ${formatDuration(end)}: ${label}`,
    }
  })
}

function getAISuggestionItems(
  suggestions: AISuggestion[],
  duration: number,
): TimelineItemModel[] {
  return suggestions.map((suggestion) => {
    const start = clampTime(suggestion.start, duration)
    const end = clampTime(suggestion.end, duration)

    return {
      id: `ai-suggestion-${suggestion.id}`,
      trackId: 'ai-suggestions',
      kind: 'ai-suggestion',
      start,
      end: Math.max(end, start + 0.1),
      label: getAISuggestionTitle(suggestion),
      aiSuggestion: suggestion,
    }
  })
}

function getSceneAnalysisMessage(item: MediaItem) {
  if (item.scenes?.outcome === 'no_scene_changes') {
    return 'No scene changes detected'
  }

  if (item.sceneState === 'processing') {
    return 'Scene analysis in progress'
  }

  if (item.sceneState === 'timeout') {
    return 'Scene detection timed out'
  }

  if (item.sceneState === 'error') {
    return 'Scene detection failed'
  }

  return 'Scene analysis pending'
}

function getTranscriptMessage(item: MediaItem) {
  if (item.transcriptionState === 'processing') {
    return 'Transcription in progress'
  }

  if (item.transcriptionState === 'error') {
    return 'Transcription failed'
  }

  return 'Transcript pending'
}

function getTimelineItemStyle(
  item: TimelineItemModel,
  geometry: TimelineGeometry,
) {
  const left = geometry.timeToTimelineX(item.start)

  if (item.kind === 'video-preview') {
    return {
      left: `${left}px`,
    }
  }

  return {
    left: `${left}px`,
    width: `${Math.max(
      geometry.durationToPixels(item.end - item.start),
      TIMELINE_ITEM_MIN_WIDTH_PIXELS,
    )}px`,
  }
}

function getTimelineItemTitle(item: TimelineItemModel) {
  if (!item.aiSuggestion) {
    return item.title
  }

  const suggestion = item.aiSuggestion

  return [
    getAISuggestionTitle(suggestion),
    `${formatDuration(suggestion.start)}-${formatDuration(suggestion.end)}`,
    suggestion.reason,
    `Confidence ${Math.round(suggestion.confidence * 100)}%`,
  ].join('\n')
}

function getTimelineTicks(
  duration: number,
  geometry: TimelineGeometry,
): TimelineTick[] {
  const majorInterval = getMajorTickInterval(duration, geometry)
  const minorInterval = majorInterval / 5
  const ticks: TimelineTick[] = []

  for (let timestamp = 0; timestamp <= duration + 0.001; timestamp += minorInterval) {
    const roundedTimestamp = Math.min(Number(timestamp.toFixed(3)), duration)
    const majorIndex = Math.round(roundedTimestamp / majorInterval)
    const isMajor = Math.abs(roundedTimestamp - majorIndex * majorInterval) < 0.001

    ticks.push({
      id: `${isMajor ? 'major' : 'minor'}-${roundedTimestamp}`,
      timestamp: roundedTimestamp,
      label: isMajor ? formatDuration(roundedTimestamp) : undefined,
      isMajor,
    })
  }

  if (ticks.at(-1)?.timestamp !== duration) {
    ticks.push({
      id: `major-${duration}`,
      timestamp: duration,
      label: formatDuration(duration),
      isMajor: true,
    })
  }

  return ticks
}

function getMajorTickInterval(
  duration: number,
  geometry: TimelineGeometry,
) {
  const targetSeconds = geometry.pixelsToDuration(
    TIMELINE_RULER_TARGET_TICK_SPACING_PIXELS,
  )
  const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  const durationCap = getDurationTickCap(duration, geometry)
  const interval = intervals.find((candidate) => candidate >= targetSeconds)
    ?? intervals.at(-1)
    ?? 60

  return Math.min(interval, durationCap)
}

function getDurationTickCap(
  duration: number,
  geometry: TimelineGeometry,
) {
  const pixelsPerSecond = geometry.durationToPixels(1)

  if (duration <= 30) {
    return pixelsPerSecond >= 4 ? 5 : 10
  }

  if (duration <= 90) {
    return pixelsPerSecond >= 6 ? 10 : 15
  }

  if (duration <= 240) {
    return pixelsPerSecond >= 8 ? 15 : 30
  }

  if (duration <= 900) {
    return pixelsPerSecond >= 12 ? 30 : 60
  }

  return pixelsPerSecond >= 12 ? 60 : 120
}

function clampTime(value: number, duration: number) {
  return Math.min(Math.max(value, 0), Math.max(duration, 0))
}
