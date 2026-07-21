import type { Clip } from '../models/Clip'
import type { Project } from '../models/Project'
import {
  getDeleteOperations,
  getTrimOperations,
  normalizeTrimRange,
} from './editSelectors'

export type DeleteRange = {
  operationId: string
  start: number
  end: number
}

export type PlaybackRange = {
  start: number
  end: number
}

export interface ComputedClip {
  clipId: string
  trackId: string
  sourceDuration: number
  visibleStart: number
  visibleEnd: number
  visibleDuration: number
  deletedRanges: DeleteRange[]
  playbackRanges: PlaybackRange[]
}

export interface EditProjection {
  clips: ComputedClip[]
  clipsById: Record<string, ComputedClip>
}

export type NormalizedPlaybackTime = {
  time: number
  isPlayable: boolean
}

type EditProjectionOptions = {
  clipDurations?: Record<string, number>
}

export function buildEditProjection(
  project: Project,
  options: EditProjectionOptions = {},
): EditProjection {
  const operationIndex = createOperationIndex(project)
  const clips = project.timeline.tracks.flatMap((track) =>
    track.clips.map((clip) =>
      computeClipProjection(
        operationIndex,
        clip,
        getClipSourceDuration(clip, options.clipDurations?.[clip.id]),
      ),
    ),
  )

  return {
    clips,
    clipsById: Object.fromEntries(
      clips.map((clip) => [clip.clipId, clip]),
    ),
  }
}

export function getFirstComputedClip(
  projection: EditProjection,
): ComputedClip | null {
  return projection.clips[0] ?? null
}

export function normalizePlaybackTime(
  computedClip: ComputedClip | null,
  requestedTime: number,
): NormalizedPlaybackTime {
  const safeRequestedTime = Number.isFinite(requestedTime)
    ? Math.max(requestedTime, 0)
    : 0

  if (!computedClip) {
    return {
      time: safeRequestedTime,
      isPlayable: true,
    }
  }

  if (!computedClip.playbackRanges.length) {
    return {
      time: computedClip.visibleStart,
      isPlayable: false,
    }
  }

  const clippedTime = Math.min(
    Math.max(safeRequestedTime, computedClip.visibleStart),
    computedClip.visibleEnd,
  )
  const activePlaybackRange = computedClip.playbackRanges.find(
    (range) => clippedTime >= range.start && clippedTime < range.end,
  )

  if (activePlaybackRange) {
    return {
      time: clippedTime,
      isPlayable: true,
    }
  }

  const nextPlaybackRange = computedClip.playbackRanges.find(
    (range) => range.start > clippedTime,
  )

  return nextPlaybackRange
    ? {
        time: nextPlaybackRange.start,
        isPlayable: true,
      }
    : {
        time: computedClip.visibleEnd,
        isPlayable: false,
      }
}

function createOperationIndex(project: Project) {
  const deleteOperationsByClipId = new Map<
    string,
    ReturnType<typeof getDeleteOperations>
  >()
  const latestTrimOperationByClipId = new Map<
    string,
    ReturnType<typeof getTrimOperations>[number]
  >()

  for (const operation of getDeleteOperations(project)) {
    const operations = deleteOperationsByClipId.get(operation.clipId) ?? []

    operations.push(operation)
    deleteOperationsByClipId.set(operation.clipId, operations)
  }

  for (const operation of getTrimOperations(project)) {
    latestTrimOperationByClipId.set(operation.clipId, operation)
  }

  return {
    deleteOperationsByClipId,
    latestTrimOperationByClipId,
  }
}

function computeClipProjection(
  operationIndex: ReturnType<typeof createOperationIndex>,
  clip: Clip,
  sourceDuration: number,
): ComputedClip {
  const trimOperation = operationIndex.latestTrimOperationByClipId.get(clip.id)
  const trimRange = trimOperation
    ? normalizeTrimRange(
        trimOperation.trimStart,
        trimOperation.trimEnd,
        sourceDuration,
      )
    : normalizeTrimRange(clip.source.start, clip.source.end, sourceDuration)
  const deletedRanges = (operationIndex.deleteOperationsByClipId.get(clip.id) ?? [])
    .map((operation) => ({
      operationId: operation.id,
      start: Math.max(operation.startTime, trimRange.trimStart),
      end: Math.min(operation.endTime, trimRange.trimEnd),
    }))
    .filter((range) => range.start < range.end)
    .sort((left, right) => left.start - right.start)
  const playbackRanges = subtractDeletedRanges(
    {
      start: trimRange.trimStart,
      end: trimRange.trimEnd,
    },
    deletedRanges,
  )

  return {
    clipId: clip.id,
    trackId: clip.trackId,
    sourceDuration,
    visibleStart: trimRange.trimStart,
    visibleEnd: trimRange.trimEnd,
    visibleDuration: trimRange.trimEnd - trimRange.trimStart,
    deletedRanges,
    playbackRanges,
  }
}

function getClipSourceDuration(clip: Clip, durationOverride?: number) {
  if (Number.isFinite(durationOverride)) {
    return Math.max(durationOverride ?? 0, 0)
  }

  return Math.max(clip.source.end - clip.source.start, 0)
}

function subtractDeletedRanges(
  visibleRange: PlaybackRange,
  deletedRanges: DeleteRange[],
): PlaybackRange[] {
  const mergedDeletedRanges = mergeRanges(deletedRanges)
  const playbackRanges: PlaybackRange[] = []
  let cursor = visibleRange.start

  for (const range of mergedDeletedRanges) {
    if (range.start > cursor) {
      playbackRanges.push({
        start: cursor,
        end: range.start,
      })
    }
    cursor = Math.max(cursor, range.end)
  }

  if (cursor < visibleRange.end) {
    playbackRanges.push({
      start: cursor,
      end: visibleRange.end,
    })
  }

  return playbackRanges
}

function mergeRanges(ranges: DeleteRange[]): DeleteRange[] {
  const mergedRanges: DeleteRange[] = []

  for (const range of ranges) {
    const previousRange = mergedRanges.at(-1)

    if (!previousRange || range.start > previousRange.end) {
      mergedRanges.push({ ...range })
      continue
    }

    previousRange.end = Math.max(previousRange.end, range.end)
  }

  return mergedRanges
}
