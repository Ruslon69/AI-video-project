import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type {
  AISuggestion,
  MediaItem,
  VideoPreviewFrame,
  VideoScene,
  VideoTranscriptSegment,
} from '../../types'
import {
  normalizePlaybackTime,
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
import {
  BASE_PIXELS_PER_SECOND,
  KEYBOARD_SEEK_SECONDS,
  TIMELINE_ZOOM_OPTIONS,
} from './timelineConstants'
import type { TimelineZoom } from './timelineConstants'

type VideoTimelineProps = {
  item: MediaItem
  currentTime: number
  duration: number
  aiSuggestions: AISuggestion[]
  computedClip: ComputedClip | null
  selectedAISuggestionIds: string[]
  activeAISuggestionId: string | null
  selectedTimelineItemId: string | null
  zoom: TimelineZoom
  onSeek: (timestamp: number) => void
  onAISuggestionActivate: (suggestionId: string) => void
  onTimelineItemSelect: (timelineItemId: string | null) => void
  onZoomChange: (zoom: TimelineZoom) => void
  onTrimCommit: (
    clipId: string,
    trimStart: number,
    trimEnd: number,
    sourceDuration: number,
  ) => void
}

type TimelineHeaderProps = {
  currentTime: number
  duration: number
  zoom: TimelineZoom
  onZoomChange: (zoom: TimelineZoom) => void
}

type TimelineRulerProps = {
  ticks: TimelineTick[]
  pixelsPerSecond: number
}

type TimelinePlayheadProps = {
  currentTime: number
  pixelsPerSecond: number
}

type TimelineTrackProps = {
  track: TimelineTrackModel
  pixelsPerSecond: number
  duration: number
  computedClip: ComputedClip | null
  selectedItemId: string | null
  selectedAISuggestionIds: string[]
  activeAISuggestionId: string | null
  onItemSelect: (item: TimelineItemModel) => void
  onTrimCommit: (
    clipId: string,
    trimStart: number,
    trimEnd: number,
    sourceDuration: number,
  ) => void
}

type TimelineTick = {
  id: string
  timestamp: number
  label?: string
  isMajor: boolean
}

// Renders timeline tracks, playhead/ruler controls, and maps media analysis into timeline blocks.
export function VideoTimeline({
  item,
  currentTime,
  duration,
  aiSuggestions,
  computedClip,
  selectedAISuggestionIds,
  activeAISuggestionId,
  selectedTimelineItemId,
  zoom,
  onSeek,
  onAISuggestionActivate,
  onTimelineItemSelect,
  onZoomChange,
  onTrimCommit,
}: VideoTimelineProps) {
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const pendingPlayheadOffsetRef = useRef<number | null>(null)
  const aiSuggestionsRef = useRef(aiSuggestions)
  const onSeekRef = useRef(onSeek)
  const isScrubbingRef = useRef(false)
  const safeDuration = Math.max(duration || item.metadata?.duration || 0, 0)
  const clampedCurrentTime = clampTime(currentTime, safeDuration)
  const pixelsPerSecond = getPixelsPerSecond(zoom)
  const canvasWidth = Math.max(safeDuration * pixelsPerSecond, 1)
  const ticks = useMemo(
    () => getTimelineTicks(safeDuration, pixelsPerSecond),
    [safeDuration, pixelsPerSecond],
  )
  const tracks = useMemo(
    () => buildTimelineTracks(item, safeDuration, aiSuggestions),
    [item, safeDuration, aiSuggestions],
  )

  useEffect(() => {
    aiSuggestionsRef.current = aiSuggestions
    onSeekRef.current = onSeek
  })

  useLayoutEffect(() => {
    const scrollViewport = scrollViewportRef.current
    const playheadOffset = pendingPlayheadOffsetRef.current

    if (!scrollViewport || playheadOffset === null) {
      return
    }

    const nextScrollLeft = clampedCurrentTime * pixelsPerSecond - playheadOffset
    scrollViewport.scrollLeft = Math.max(nextScrollLeft, 0)
    pendingPlayheadOffsetRef.current = null
  }, [clampedCurrentTime, pixelsPerSecond, zoom])

  useEffect(() => {
    if (!activeAISuggestionId) {
      return
    }

    const activeSuggestion = aiSuggestionsRef.current.find(
      (suggestion) => suggestion.id === activeAISuggestionId,
    )

    if (activeSuggestion) {
      onSeekRef.current(
        normalizePlaybackTime(computedClip, activeSuggestion.start).time,
      )
    }
  }, [activeAISuggestionId, computedClip])

  const handleSeekFromClientX = (clientX: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const timestamp = rect.width > 0
      ? (clientX - rect.left) / pixelsPerSecond
      : 0
    onSeek(normalizePlaybackTime(computedClip, timestamp).time)
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
    isScrubbingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    handleSeekFromClientX(event.clientX, event.currentTarget)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) {
      return
    }

    event.preventDefault()
    handleSeekFromClientX(event.clientX, event.currentTarget)
  }

  const stopScrubbing = (event: PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) {
      return
    }

    isScrubbingRef.current = false

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
    onSeek(
      normalizePlaybackTime(
        computedClip,
        clampedCurrentTime + direction * KEYBOARD_SEEK_SECONDS,
      ).time,
    )
  }

  const handleItemSelect = (timelineItem: TimelineItemModel) => {
    onTimelineItemSelect(timelineItem.id)
    if (timelineItem.aiSuggestion) {
      onAISuggestionActivate(timelineItem.aiSuggestion.id)
    }
    onSeek(normalizePlaybackTime(computedClip, timelineItem.start).time)
  }

  const handleZoomChange = (nextZoom: TimelineZoom) => {
    const scrollViewport = scrollViewportRef.current

    if (scrollViewport) {
      pendingPlayheadOffsetRef.current =
        clampedCurrentTime * pixelsPerSecond - scrollViewport.scrollLeft
    }

    onZoomChange(nextZoom)
  }

  if (safeDuration <= 0) {
    return null
  }

  return (
    <section className="video-timeline" aria-label="Видео таймлайн">
      <TimelineHeader
        currentTime={clampedCurrentTime}
        duration={safeDuration}
        zoom={zoom}
        onZoomChange={handleZoomChange}
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
            style={{ width: `${canvasWidth}px` }}
            role="slider"
            tabIndex={0}
            aria-label="Перемотать видео по таймлайну"
            aria-valuemin={0}
            aria-valuemax={Math.round(safeDuration)}
            aria-valuenow={Math.round(clampedCurrentTime)}
            aria-valuetext={`${formatDuration(clampedCurrentTime)} of ${formatDuration(safeDuration)}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopScrubbing}
            onPointerCancel={stopScrubbing}
            onKeyDown={handleKeyDown}
          >
            <TimelineRuler ticks={ticks} pixelsPerSecond={pixelsPerSecond} />
            <div className="timeline-track-stack">
              {tracks.map((track) => (
                <TimelineTrack
                  key={track.id}
                  track={track}
                  pixelsPerSecond={pixelsPerSecond}
                  duration={safeDuration}
                  computedClip={computedClip}
                  selectedItemId={selectedTimelineItemId}
                  selectedAISuggestionIds={selectedAISuggestionIds}
                  activeAISuggestionId={activeAISuggestionId}
                  onItemSelect={handleItemSelect}
                  onTrimCommit={onTrimCommit}
                />
              ))}
            </div>
            <TimelineDeleteOverlays
              deletedRanges={computedClip?.deletedRanges ?? []}
              pixelsPerSecond={pixelsPerSecond}
            />
            <TimelinePlayhead
              currentTime={clampedCurrentTime}
              pixelsPerSecond={pixelsPerSecond}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function TimelineDeleteOverlays({
  deletedRanges,
  pixelsPerSecond,
}: {
  deletedRanges: DeleteRange[]
  pixelsPerSecond: number
}) {
  return (
    <div className="timeline-delete-overlay-layer" aria-hidden="true">
      {deletedRanges.map((range) => (
        <span
          key={range.operationId}
          className="timeline-delete-overlay"
          style={{
            left: `${range.start * pixelsPerSecond}px`,
            width: `${Math.max(
              (range.end - range.start) * pixelsPerSecond,
              4,
            )}px`,
          }}
        />
      ))}
    </div>
  )
}

function isTimelineItemTarget(target: EventTarget) {
  return target instanceof Element && Boolean(target.closest('.timeline-item'))
}

function isTrimHandleTarget(target: EventTarget) {
  return target instanceof Element && Boolean(target.closest('.timeline-trim-handle'))
}

function TimelineHeader({
  currentTime,
  duration,
  zoom,
  onZoomChange,
}: TimelineHeaderProps) {
  return (
    <div className="video-timeline-head">
      <div>
        <p className="section-label">Таймлайн</p>
        <span>
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
      </div>
      <div className="timeline-zoom" aria-label="Масштаб таймлайна">
        {TIMELINE_ZOOM_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className="timeline-zoom-button"
            data-active={option === zoom}
            onClick={() => onZoomChange(option)}
            aria-pressed={option === zoom}
          >
            {option}%
          </button>
        ))}
      </div>
    </div>
  )
}

function TimelineRuler({ ticks, pixelsPerSecond }: TimelineRulerProps) {
  return (
    <div className="timeline-ruler" aria-hidden="true">
      {ticks.map((tick) => (
        <span
          key={tick.id}
          className={tick.isMajor ? 'timeline-ruler-tick-major' : 'timeline-ruler-tick-minor'}
          style={{ left: `${tick.timestamp * pixelsPerSecond}px` }}
        >
          {tick.label ? <span>{tick.label}</span> : null}
        </span>
      ))}
    </div>
  )
}

function TimelinePlayhead({ currentTime, pixelsPerSecond }: TimelinePlayheadProps) {
  return (
    <span
      className="timeline-playhead"
      style={{ left: `${currentTime * pixelsPerSecond}px` }}
      aria-hidden="true"
    />
  )
}

function TimelineTrack({
  track,
  pixelsPerSecond,
  duration,
  computedClip,
  selectedItemId,
  selectedAISuggestionIds,
  activeAISuggestionId,
  onItemSelect,
  onTrimCommit,
}: TimelineTrackProps) {
  return (
    <div
      className={`timeline-track timeline-track-${track.id}`}
      data-track-id={track.id}
      aria-label={track.label}
    >
      <div className="timeline-track-lane">
        {track.id === 'video' ? (
          computedClip ? (
            <TimelineVideoStrip
              computedClip={computedClip}
              duration={duration}
              pixelsPerSecond={pixelsPerSecond}
              onTrimCommit={onTrimCommit}
            />
          ) : null
        ) : null}
        {track.items.length ? (
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
              style={getTimelineItemStyle(item, pixelsPerSecond)}
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
        ) : (
          <span className="timeline-empty-item">{track.emptyLabel}</span>
        )}
      </div>
    </div>
  )
}

function TimelineVideoStrip({
  computedClip,
  duration,
  pixelsPerSecond,
  onTrimCommit,
}: {
  computedClip: ComputedClip
  duration: number
  pixelsPerSecond: number
  onTrimCommit: (
    clipId: string,
    trimStart: number,
    trimEnd: number,
    sourceDuration: number,
  ) => void
}) {
  const [previewTrim, setPreviewTrim] = useState<ClipTrimRange | null>(null)
  const trimRange = {
    trimStart: computedClip.visibleStart,
    trimEnd: computedClip.visibleEnd,
  }
  const activeTrim = previewTrim ?? trimRange
  const previewTrimRef = useRef<ClipTrimRange | null>(null)
  const dragStateRef = useRef<{
    edge: 'start' | 'end'
    pointerId: number
  } | null>(null)

  useEffect(() => {
    setPreviewTrim(null)
    previewTrimRef.current = null
  }, [trimRange.trimStart, trimRange.trimEnd])

  const getPreviewTrim = (
    clientX: number,
    element: HTMLElement,
    edge: 'start' | 'end',
  ) => {
    const rect = element.getBoundingClientRect()
    const timestamp = rect.width > 0
      ? (clientX - rect.left) / pixelsPerSecond
      : 0
    const currentTrim = previewTrimRef.current ?? trimRange

    return edge === 'start'
      ? normalizeTrimRange(timestamp, currentTrim.trimEnd, computedClip.sourceDuration || duration)
      : normalizeTrimRange(currentTrim.trimStart, timestamp, computedClip.sourceDuration || duration)
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
        computedClip.clipId,
        finalTrim.trimStart,
        finalTrim.trimEnd,
        computedClip.sourceDuration || duration,
      )
    }

    setPreviewTrim(null)
    previewTrimRef.current = null
  }

  return (
    <span
      className="timeline-video-strip"
      style={{
        left: `${activeTrim.trimStart * pixelsPerSecond}px`,
        width: `${Math.max(
          (activeTrim.trimEnd - activeTrim.trimStart) * pixelsPerSecond,
          4,
        )}px`,
      }}
    >
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
    </span>
  )
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
      items: getVideoItems(item.previews?.previews ?? [], duration),
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

function getVideoItems(
  previews: VideoPreviewFrame[],
  duration: number,
): TimelineItemModel[] {
  if (!previews.length) {
    return []
  }

  return previews.map((frame, index) => {
    const start = clampTime(frame.timestamp, duration)

    return {
      id: `preview-${index}-${Math.round(frame.timestamp * 1000)}`,
      trackId: 'video',
      kind: 'video-preview',
      start,
      end: start,
      label: formatDuration(frame.timestamp),
      title: `Preview frame: ${formatDuration(frame.timestamp)}`,
      thumbnailUrl: frame.data_url,
    }
  })
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
  pixelsPerSecond: number,
) {
  const left = item.start * pixelsPerSecond

  if (item.kind === 'video-preview') {
    return {
      left: `${left}px`,
    }
  }

  return {
    left: `${left}px`,
    width: `${Math.max((item.end - item.start) * pixelsPerSecond, 4)}px`,
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

function getPixelsPerSecond(zoom: TimelineZoom) {
  return BASE_PIXELS_PER_SECOND * (zoom / 100)
}

function getTimelineTicks(duration: number, pixelsPerSecond: number): TimelineTick[] {
  const majorInterval = getMajorTickInterval(duration, pixelsPerSecond)
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

function getMajorTickInterval(duration: number, pixelsPerSecond: number) {
  const targetSeconds = 92 / pixelsPerSecond
  const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  const durationCap = getDurationTickCap(duration, pixelsPerSecond)
  const interval = intervals.find((candidate) => candidate >= targetSeconds)
    ?? intervals.at(-1)
    ?? 60

  return Math.min(interval, durationCap)
}

function getDurationTickCap(duration: number, pixelsPerSecond: number) {
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
