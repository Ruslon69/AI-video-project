import type { Project } from '../models/Project'
import type { EditProjection } from './editProjection'
import type { MediaItem, VideoPreviewFrame } from '../types'
import {
  getMediaAssetId,
  getProjectMediaBindingForSourceClip,
} from '../state/ProjectMedia'
import { getMediaSourceColor } from '../utils/mediaSourceColor'

export type TimelineClipMediaPresentation = Readonly<{
  assetId: string
  mediaItemId: string | null
  filename: string
  sourceColor: string
  instanceIndex: number
  instanceCount: number
}>

export type MediaLibraryAssetPresentation = Readonly<{
  sourceColor: string
  timelineInstanceCount: number
}>

export type TimelineClipThumbnailFrame = Readonly<{
  sourceTimestamp: number
  dataUrl: string
}>

export type TimelineClipThumbnailPresentation = Readonly<{
  identity: string
  assetId: string
  sourceClipId: string
  sourceStart: number
  sourceEnd: number
  state: 'loading' | 'ready' | 'unavailable' | 'error'
  frames: TimelineClipThumbnailFrame[]
}>

type ResolvedTimelineClipMedia = Readonly<{
  assetId: string
  mediaItemId: string | null
  filename: string
}>

export function getMediaItemIdForProjectedTimelineItem(
  project: Project,
  projection: EditProjection,
  timelineItemId: string | null,
) {
  if (!timelineItemId) {
    return null
  }

  const computedClip = projection.clipsById[timelineItemId]
  const binding = computedClip
    ? getProjectMediaBindingForSourceClip(project, computedClip.sourceClipId)
    : null

  return binding?.asset.mediaItemId ?? null
}

export function getTimelineClipMediaPresentations(
  project: Project,
  projection: EditProjection,
): Record<string, TimelineClipMediaPresentation> {
  const resolvedClips = projection.clips
    .map((computedClip) => ({
      computedClip,
      media: resolveTimelineClipMedia(project, computedClip.sourceClipId),
    }))
    .sort((left, right) => (
      left.computedClip.timelineRange.start - right.computedClip.timelineRange.start ||
      left.computedClip.id.localeCompare(right.computedClip.id)
    ))
  const instanceCounts = new Map<string, number>()

  for (const { media } of resolvedClips) {
    instanceCounts.set(media.assetId, (instanceCounts.get(media.assetId) ?? 0) + 1)
  }

  const nextInstanceIndex = new Map<string, number>()

  return Object.fromEntries(resolvedClips.map(({ computedClip, media }) => {
    const instanceIndex = (nextInstanceIndex.get(media.assetId) ?? 0) + 1

    nextInstanceIndex.set(media.assetId, instanceIndex)

    return [
      computedClip.timelineItemId,
      {
        ...media,
        sourceColor: getMediaSourceColor(media.assetId),
        instanceIndex,
        instanceCount: instanceCounts.get(media.assetId) ?? 1,
      },
    ]
  }))
}

export function getMediaLibraryAssetPresentations(
  project: Project,
  projection: EditProjection,
  mediaItemIds: string[] = [],
): Record<string, MediaLibraryAssetPresentation> {
  const timelineClipPresentations = getTimelineClipMediaPresentations(
    project,
    projection,
  )
  const countsByMediaItemId = new Map<string, number>()

  for (const presentation of Object.values(timelineClipPresentations)) {
    if (presentation.mediaItemId) {
      countsByMediaItemId.set(
        presentation.mediaItemId,
        (countsByMediaItemId.get(presentation.mediaItemId) ?? 0) + 1,
      )
    }
  }

  const assetsByMediaItemId = new Map(project.assets
    .filter((asset) => Boolean(asset.mediaItemId))
    .map((asset) => [asset.mediaItemId as string, asset]))

  return Object.fromEntries(mediaItemIds.map((mediaItemId) => {
    const asset = assetsByMediaItemId.get(mediaItemId)

    return [
      mediaItemId,
      {
        sourceColor: getMediaSourceColor(asset?.id ?? getMediaAssetId(mediaItemId)),
        timelineInstanceCount: countsByMediaItemId.get(mediaItemId) ?? 0,
      },
    ]
  }))
}

export function getTimelineClipThumbnailPresentations(
  project: Project,
  projection: EditProjection,
  mediaItems: MediaItem[],
): Record<string, TimelineClipThumbnailPresentation> {
  const mediaItemsById = new Map(mediaItems.map((mediaItem) => [
    mediaItem.id,
    mediaItem,
  ]))

  return Object.fromEntries(projection.clips.map((computedClip) => {
    const media = resolveTimelineClipMedia(project, computedClip.sourceClipId)
    const mediaItem = media.mediaItemId
      ? mediaItemsById.get(media.mediaItemId) ?? null
      : null
    const sourceStart = Number(computedClip.sourceRange.start)
    const sourceEnd = Number(computedClip.sourceRange.end)
    const identity = createTimelineClipThumbnailIdentity(
      media.assetId,
      computedClip.sourceClipId,
      sourceStart,
      sourceEnd,
      mediaItem?.id ?? null,
      mediaItem?.objectUrl ?? null,
    )

    return [
      computedClip.timelineItemId,
      {
        identity,
        assetId: media.assetId,
        sourceClipId: computedClip.sourceClipId,
        sourceStart,
        sourceEnd,
        state: getThumbnailState(mediaItem),
        frames: getSourceRangePreviewFrames(
          mediaItem?.previews?.previews ?? [],
          sourceStart,
          sourceEnd,
        ),
      },
    ]
  }))
}

export function sampleTimelineClipThumbnailFrames(
  frames: TimelineClipThumbnailFrame[],
  requestedCount: number,
) {
  if (requestedCount <= 0 || frames.length <= requestedCount) {
    return frames
  }

  if (requestedCount === 1) {
    return [frames[Math.floor(frames.length / 2)]]
  }

  return Array.from({ length: requestedCount }, (_, index) => {
    const frameIndex = Math.round(
      index * (frames.length - 1) / (requestedCount - 1),
    )

    return frames[frameIndex]
  })
}

function resolveTimelineClipMedia(
  project: Project,
  sourceClipId: string,
): ResolvedTimelineClipMedia {
  const binding = getProjectMediaBindingForSourceClip(project, sourceClipId)

  if (binding) {
    return {
      assetId: binding.asset.id,
      mediaItemId: binding.asset.mediaItemId ?? null,
      filename: binding.asset.filename,
    }
  }

  const sourceClip = project.timeline.tracks
    .flatMap((track) => track.clips)
    .find((clip) => clip.id === sourceClipId)

  return {
    assetId: sourceClip?.assetId ?? sourceClipId,
    mediaItemId: null,
    filename: sourceClip?.name ?? 'Unknown source',
  }
}

function getThumbnailState(mediaItem: MediaItem | null) {
  if (!mediaItem || mediaItem.type !== 'video') {
    return 'unavailable' as const
  }

  if (mediaItem.previewState === 'processing' || mediaItem.previewState === 'idle') {
    return 'loading' as const
  }

  if (mediaItem.previewState === 'error') {
    return 'error' as const
  }

  return mediaItem.previews?.previews.length
    ? 'ready' as const
    : 'unavailable' as const
}

function getSourceRangePreviewFrames(
  frames: VideoPreviewFrame[],
  sourceStart: number,
  sourceEnd: number,
): TimelineClipThumbnailFrame[] {
  if (!(sourceEnd > sourceStart)) {
    return []
  }

  return frames
    .filter((frame) => (
      Number.isFinite(frame.timestamp) &&
      frame.timestamp >= sourceStart - 0.0001 &&
      frame.timestamp <= sourceEnd + 0.0001
    ))
    .map((frame) => ({
      sourceTimestamp: frame.timestamp,
      dataUrl: frame.data_url,
    }))
}

function createTimelineClipThumbnailIdentity(
  assetId: string,
  sourceClipId: string,
  sourceStart: number,
  sourceEnd: number,
  mediaItemId: string | null,
  mediaUrl: string | null,
) {
  return [
    assetId,
    sourceClipId,
    mediaItemId ?? 'unavailable-media',
    mediaUrl ?? 'unavailable-url',
    sourceStart.toFixed(6),
    sourceEnd.toFixed(6),
  ].join(':')
}
