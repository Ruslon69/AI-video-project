import type { KeyboardEvent } from 'react'
import type { MediaItem, VideoScene } from '../../types'
import { formatDuration } from '../../utils/mediaFormat'

type VideoTimelineProps = {
  item: MediaItem
  currentTime: number
  duration: number
  onSeek: (timestamp: number) => void
}

type SceneTrackSegment = {
  id: string
  label: string
  start: number
  end: number
  duration: number
}

const KEYBOARD_SEEK_SECONDS = 5

export function VideoTimeline({
  item,
  currentTime,
  duration,
  onSeek,
}: VideoTimelineProps) {
  const safeDuration = Math.max(duration || item.metadata?.duration || 0, 0)
  const clampedCurrentTime = clampTime(currentTime, safeDuration)
  const playheadPercent = getPercent(clampedCurrentTime, safeDuration)
  const sceneSegments = getSceneSegments(item.scenes?.scenes ?? [], safeDuration)

  const handleSeekFromClientX = (clientX: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
    onSeek(clampTime(ratio * safeDuration, safeDuration))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }

    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    onSeek(clampTime(clampedCurrentTime + direction * KEYBOARD_SEEK_SECONDS, safeDuration))
  }

  if (safeDuration <= 0) {
    return null
  }

  return (
    <section className="video-timeline" aria-label="Видео таймлайн">
      <div className="video-timeline-head">
        <p className="section-label">Таймлайн</p>
        <span>
          {formatDuration(clampedCurrentTime)} / {formatDuration(safeDuration)}
        </span>
      </div>
      <div
        className="timeline-seek-area"
        role="slider"
        tabIndex={0}
        aria-label="Перемотать видео по таймлайну"
        aria-valuemin={0}
        aria-valuemax={Math.round(safeDuration)}
        aria-valuenow={Math.round(clampedCurrentTime)}
        aria-valuetext={`${formatDuration(clampedCurrentTime)} of ${formatDuration(safeDuration)}`}
        onClick={(event) => handleSeekFromClientX(event.clientX, event.currentTarget)}
        onKeyDown={handleKeyDown}
      >
        <div className="timeline-ruler" aria-hidden="true">
          <span>0:00</span>
          <span>{formatDuration(safeDuration / 2)}</span>
          <span>{formatDuration(safeDuration)}</span>
        </div>
        <div className="timeline-track" aria-hidden="true">
          {item.scenes?.outcome === 'scenes_detected'
            ? sceneSegments.map((scene) => (
                <span
                  key={scene.id}
                  className="timeline-scene-segment"
                  style={{
                    left: `${getPercent(scene.start, safeDuration)}%`,
                    width: `${getPercent(scene.duration, safeDuration)}%`,
                  }}
                  title={`Scene ${scene.label}: ${formatDuration(scene.start)} - ${formatDuration(scene.end)}`}
                >
                  <span>{scene.label}</span>
                </span>
              ))
            : (
                <span className="timeline-base-segment">
                  {item.scenes?.outcome === 'no_scene_changes'
                    ? 'No scene changes detected'
                    : getSceneAnalysisMessage(item)}
                </span>
              )}
          <span
            className="timeline-playhead"
            style={{ left: `${playheadPercent}%` }}
          />
        </div>
        {item.previews?.previews.length ? (
          <div className="timeline-preview-markers" aria-hidden="true">
            {item.previews.previews.map((frame) => (
              <button
                key={frame.timestamp}
                type="button"
                className="timeline-preview-marker"
                style={{ left: `${getPercent(frame.timestamp, safeDuration)}%` }}
                onClick={(event) => {
                  event.stopPropagation()
                  onSeek(frame.timestamp)
                }}
                tabIndex={-1}
              >
                <img src={frame.data_url} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function getSceneSegments(scenes: VideoScene[], duration: number): SceneTrackSegment[] {
  return scenes.map((scene, index) => {
    const start = clampTime(scene.start, duration)
    const end = clampTime(scene.end, duration)

    return {
      id: scene.id,
      label: `${index + 1}`,
      start,
      end,
      duration: Math.max(end - start, 0),
    }
  })
}

function getSceneAnalysisMessage(item: MediaItem) {
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

function clampTime(value: number, duration: number) {
  return Math.min(Math.max(value, 0), Math.max(duration, 0))
}

function getPercent(value: number, duration: number) {
  if (duration <= 0) {
    return 0
  }

  return clampTime((value / duration) * 100, 100)
}
