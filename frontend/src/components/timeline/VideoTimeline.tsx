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
import type { SeekRequestReason } from '../../state/ProjectState'
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
  computedClips: ComputedClip[]
  selectedAISuggestionIds: string[]
  activeAISuggestionId: string | null
  selectedTimelineItemId: string | null
  zoom: TimelineZoom
  onSeekRequest: (
    timestamp: number,
    reason: SeekRequestReason,
  ) => void
  onAISuggestionActivate: (suggestionId: string) => void
  onTimelineItemSelect: (timelineItemId: string | null) => void
  onZoomChange: (zoom: TimelineZoom) => void
  onTrimCommit: (
    timelineItemId: string,
    trimStart: number,
    trimEnd: number,
    sourceDuration: number,
  ) => void
  onSplitCommit: (timelineItemId: string, splitTime: number) => void
}

type TimelineHeaderProps = {
  currentTime: number
  duration: number
  zoom: TimelineZoom
  canSplit: boolean
  onZoomChange: (zoom: TimelineZoom) => void
  onSplit: () => void
}

type TimelineRulerProps = {
  ticks: TimelineTick[]
  geometry: TimelineGeometry
}

type TimelinePlayheadProps = {
  currentTime: number
  geometry: TimelineGeometry
}

type TimelineTrackProps = {
  track: TimelineTrackModel
  geometry: TimelineGeometry
  duration: number
  computedClips: ComputedClip[]
  selectedItemId: string | null
  selectedAISuggestionIds: string[]
  activeAISuggestionId: string | null
  onItemSelect: (item: TimelineItemModel) => void
  onClipSelect: (timelineItemId: string) => void
  onTrimCommit: (
    timelineItemId: string,
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

type TimelineGeometry = {
  contentWidth: number
  pixelsPerSecond: number
  timeToTimelineX: (timestamp: number) => number
  timelineXToTime: (coordinate: number) => number
}

// Renders timeline tracks, playhead/ruler controls, and maps media analysis into timeline blocks.
export function VideoTimeline({
  item,
  currentTime,
  duration,
  aiSuggestions,
  computedClips,
  selectedAISuggestionIds,
  activeAISuggestionId,
  selectedTimelineItemId,
  zoom,
  onSeekRequest,
  onAISuggestionActivate,
  onTimelineItemSelect,
  onZoomChange,
  onTrimCommit,
  onSplitCommit,
}: VideoTimelineProps) {
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const pendingPlayheadOffsetRef = useRef<number | null>(null)
  const isScrubbingRef = useRef(false)
  const safeDuration = Math.max(duration || item.metadata?.duration || 0, 0)
  const clampedCurrentTime = clampTime(currentTime, safeDuration)
  const pixelsPerSecond = getPixelsPerSecond(zoom)
  const geometry = useMemo(
    () => createTimelineGeometry(safeDuration, pixelsPerSecond),
    [safeDuration, pixelsPerSecond],
  )
  const ticks = useMemo(
    () => getTimelineTicks(safeDuration, pixelsPerSecond),
    [safeDuration, pixelsPerSecond],
  )
  const tracks = useMemo(
    () => buildTimelineTracks(item, safeDuration, aiSuggestions),
    [item, safeDuration, aiSuggestions],
  )
  const selectedSplitTargetClip = selectedTimelineItemId
    ? computedClips.find(
        (clip) =>
          clip.timelineItemId === selectedTimelineItemId &&
          isValidSplitTime(clip, clampedCurrentTime),
      ) ?? null
    : null
  const splitTargetClip = selectedSplitTargetClip ??
    computedClips.find((clip) => isValidSplitTime(clip, clampedCurrentTime)) ??
    null

  useLayoutEffect(() => {
    const scrollViewport = scrollViewportRef.current
    const playheadOffset = pendingPlayheadOffsetRef.current

    if (!scrollViewport || playheadOffset === null) {
      return
    }

    const nextScrollLeft = geometry.timeToTimelineX(clampedCurrentTime) -
      playheadOffset
    scrollViewport.scrollLeft = Math.max(nextScrollLeft, 0)
    pendingPlayheadOffsetRef.current = null
  }, [clampedCurrentTime, geometry, zoom])

  const handleSeekFromClientX = (
    clientX: number,
    element: HTMLElement,
    reason: SeekRequestReason,
  ) => {
    const rect = element.getBoundingClientRect()
    const timestamp = rect.width > 0
      ? geometry.timelineXToTime(clientX - rect.left)
      : 0
    onSeekRequest(normalizePlaybackTime(computedClips, timestamp).time, reason)
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
      normalizePlaybackTime(
        computedClips,
        clampedCurrentTime + direction * KEYBOARD_SEEK_SECONDS,
      ).time,
      'timeline-keyboard',
    )
  }

  const handleItemSelect = (timelineItem: TimelineItemModel) => {
    onTimelineItemSelect(timelineItem.id)
    if (timelineItem.aiSuggestion) {
      onAISuggestionActivate(timelineItem.aiSuggestion.id)
      return
    }
    onSeekRequest(
      normalizePlaybackTime(computedClips, timelineItem.start).time,
      'timeline-item',
    )
  }

  const handleZoomChange = (nextZoom: TimelineZoom) => {
    const scrollViewport = scrollViewportRef.current

    if (scrollViewport) {
      pendingPlayheadOffsetRef.current =
        geometry.timeToTimelineX(clampedCurrentTime) - scrollViewport.scrollLeft
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
        canSplit={Boolean(splitTargetClip)}
        onZoomChange={handleZoomChange}
        onSplit={() => {
          if (splitTargetClip) {
            onSplitCommit(splitTargetClip.timelineItemId, clampedCurrentTime)
          }
        }}
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
            style={{ width: `${geometry.contentWidth}px` }}
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
                  duration={safeDuration}
                  computedClips={computedClips}
                  selectedItemId={selectedTimelineItemId}
                  selectedAISuggestionIds={selectedAISuggestionIds}
                  activeAISuggestionId={activeAISuggestionId}
                  onItemSelect={handleItemSelect}
                  onClipSelect={onTimelineItemSelect}
                  onTrimCommit={onTrimCommit}
                />
              ))}
            </div>
            <TimelineDeleteOverlays
              deletedRanges={computedClips.flatMap((clip) => clip.deletedRanges)}
              geometry={geometry}
            />
            <TimelinePlayhead
              currentTime={clampedCurrentTime}
              geometry={geometry}
            />
          </div>
        </div>
      </div>
    </section>
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
              geometry.timeToTimelineX(range.end) -
                geometry.timeToTimelineX(range.start),
              4,
            )}px`,
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
  currentTime,
  duration,
  zoom,
  canSplit,
  onZoomChange,
  onSplit,
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
        <span className="timeline-action-tooltip" data-tooltip="Split at playhead">
          <button
            type="button"
            className="timeline-action-button"
            disabled={!canSplit}
            onClick={onSplit}
            aria-label="Split at playhead"
          >
            Split
          </button>
        </span>
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

function TimelinePlayhead({ currentTime, geometry }: TimelinePlayheadProps) {
  return (
    <span
      className="timeline-playhead-line"
      style={{ left: `${geometry.timeToTimelineX(currentTime)}px` }}
      aria-hidden="true"
    />
  )
}

function TimelineTrack({
  track,
  geometry,
  duration,
  computedClips,
  selectedItemId,
  selectedAISuggestionIds,
  activeAISuggestionId,
  onItemSelect,
  onClipSelect,
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
          computedClips.length ? (
            computedClips.map((computedClip) => (
              <TimelineVideoStrip
                key={computedClip.id}
                computedClip={computedClip}
                duration={duration}
                geometry={geometry}
                isSelected={selectedItemId === computedClip.timelineItemId}
                onSelect={onClipSelect}
                onTrimCommit={onTrimCommit}
              />
            ))
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
  geometry,
  isSelected,
  onSelect,
  onTrimCommit,
}: {
  computedClip: ComputedClip
  duration: number
  geometry: TimelineGeometry
  isSelected: boolean
  onSelect: (timelineItemId: string) => void
  onTrimCommit: (
    timelineItemId: string,
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
      data-selected={isSelected}
      role="button"
      tabIndex={0}
      style={{
        left: `${geometry.timeToTimelineX(activeTrim.trimStart)}px`,
        width: `${Math.max(
          geometry.timeToTimelineX(activeTrim.trimEnd) -
            geometry.timeToTimelineX(activeTrim.trimStart),
          4,
        )}px`,
      }}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(computedClip.timelineItemId)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(computedClip.timelineItemId)
        }
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
      geometry.timeToTimelineX(item.end) - geometry.timeToTimelineX(item.start),
      4,
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

function getPixelsPerSecond(zoom: TimelineZoom) {
  return BASE_PIXELS_PER_SECOND * (zoom / 100)
}

function createTimelineGeometry(
  duration: number,
  pixelsPerSecond: number,
): TimelineGeometry {
  const contentWidth = Math.max(duration * pixelsPerSecond, 1)

  return {
    contentWidth,
    pixelsPerSecond,
    timeToTimelineX: (timestamp) =>
      Math.min(Math.max(timestamp * pixelsPerSecond, 0), contentWidth),
    timelineXToTime: (coordinate) =>
      Math.min(Math.max(coordinate, 0), contentWidth) / pixelsPerSecond,
  }
}

function isValidSplitTime(clip: ComputedClip, timestamp: number) {
  return timestamp > clip.segmentStart && timestamp < clip.segmentEnd
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
