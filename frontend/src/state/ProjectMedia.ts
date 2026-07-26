import type { Clip } from '../models/Clip'
import type {
  Project,
  ProjectAsset,
  ProjectMediaRoles,
} from '../models/Project'

const DURATION_TOLERANCE = 0.000001

export type ProjectMediaDescriptor = Readonly<{
  id: string
  filename: string
  duration?: number
  fileSize?: number
  mimeType?: string
  lastModified?: number
}>

export type ProjectMediaBinding = Readonly<{
  asset: ProjectAsset
  sourceClip: Clip
}>

export function registerProjectMediaAssets(
  project: Project,
  mediaItems: ProjectMediaDescriptor[],
): Project {
  if (!mediaItems.length || areProjectMediaAssetsRegistered(project, mediaItems)) {
    return project
  }

  const videoTrackIndex = project.timeline.tracks.findIndex(
    (track) => track.type === 'video',
  )

  if (videoTrackIndex < 0) {
    return project
  }

  const assets = project.assets.map((asset) => ({ ...asset }))
  const tracks = project.timeline.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => ({ ...clip })),
  }))
  const videoTrack = tracks[videoTrackIndex]
  let didChange = false

  for (const mediaItem of mediaItems) {
    const existingAsset = assets.find(
      (asset) => asset.mediaItemId === mediaItem.id,
    )

    if (existingAsset) {
      const sourceClip = videoTrack.clips.find(
        (clip) => clip.assetId === existingAsset.id,
      )
      const duration = getMediaDuration(
        mediaItem.duration,
        existingAsset.duration ?? sourceClip?.source.end ?? 0,
      )

      if (
        existingAsset.filename !== mediaItem.filename ||
        existingAsset.duration !== duration ||
        existingAsset.fileSize !== mediaItem.fileSize ||
        existingAsset.mimeType !== mediaItem.mimeType ||
        existingAsset.lastModified !== mediaItem.lastModified
      ) {
        existingAsset.filename = mediaItem.filename
        existingAsset.duration = duration
        existingAsset.fileSize = mediaItem.fileSize
        existingAsset.mimeType = mediaItem.mimeType
        existingAsset.lastModified = mediaItem.lastModified
        didChange = true
      }

      if (sourceClip && (
        sourceClip.name !== mediaItem.filename ||
        sourceClip.source.end !== duration
      )) {
        Object.assign(
          sourceClip,
          updateSourceClip(
            sourceClip,
            mediaItem.filename,
            duration,
          ),
        )
        didChange = true
      }
      continue
    }

    const createdAt = new Date().toISOString()
    const duration = getMediaDuration(mediaItem.duration, 0)
    const assetId = getMediaAssetId(mediaItem.id)

    assets.push({
      id: assetId,
      mediaItemId: mediaItem.id,
      type: 'video',
      filename: mediaItem.filename,
      duration,
      fileSize: mediaItem.fileSize,
      mimeType: mediaItem.mimeType,
      lastModified: mediaItem.lastModified,
      createdAt,
    })
    videoTrack.clips.push({
      id: `clip-media-${mediaItem.id}`,
      assetId,
      trackId: videoTrack.id,
      name: mediaItem.filename,
      source: {
        start: 0,
        end: duration,
      },
      timeline: {
        start: 0,
        end: duration,
      },
      playbackRate: 1,
      enabled: true,
      createdAt,
      updatedAt: createdAt,
    })
    didChange = true
  }

  if (!didChange) {
    return project
  }

  const originalSourceClipsById = new Map(
    project.timeline.tracks
      .flatMap((track) => track.clips)
      .map((clip) => [clip.id, clip]),
  )
  const sourceClipsById = new Map(
    tracks
      .flatMap((track) => track.clips)
      .map((clip) => [clip.id, clip]),
  )
  const timelineItems = project.timeline.items.map((timelineItem) => {
    const previousSourceClip = originalSourceClipsById.get(timelineItem.sourceId)
    const nextSourceClip = sourceClipsById.get(timelineItem.sourceId)
    const previousSourceDuration = previousSourceClip
      ? previousSourceClip.source.end - previousSourceClip.source.start
      : 0
    const nextSourceDuration = nextSourceClip
      ? nextSourceClip.source.end - nextSourceClip.source.start
      : previousSourceDuration
    const playbackRate = previousSourceClip &&
      Number.isFinite(previousSourceClip.playbackRate) &&
      previousSourceClip.playbackRate > 0
        ? previousSourceClip.playbackRate
        : 1

    return previousSourceClip &&
      nextSourceDuration !== previousSourceDuration &&
      isInitialFullSourceTimelineItem(
        timelineItem,
        previousSourceClip,
        previousSourceDuration,
        playbackRate,
      )
        ? {
            ...timelineItem,
            sourceEnd: nextSourceClip?.source.end ?? timelineItem.sourceEnd,
            timelineDuration: nextSourceDuration / playbackRate,
          }
        : timelineItem
  })
  const updatedAt = new Date().toISOString()

  return {
    ...project,
    assets,
    timeline: {
      ...project.timeline,
      items: timelineItems,
      tracks,
      updatedAt,
    },
    updatedAt,
  }
}

export function updateProjectMediaDuration(
  project: Project,
  mediaItemId: string,
  requestedDuration: number,
): Project {
  const duration = getMediaDuration(requestedDuration, 0)
  const binding = getProjectMediaBinding(project, mediaItemId)

  if (
    !binding ||
    duration <= 0 ||
    (
      binding.asset.duration === duration &&
      binding.sourceClip.source.end === duration
    )
  ) {
    return project
  }

  const updatedAt = new Date().toISOString()
  const previousSourceDuration =
    binding.sourceClip.source.end - binding.sourceClip.source.start
  const playbackRate = Number.isFinite(binding.sourceClip.playbackRate) &&
    binding.sourceClip.playbackRate > 0
      ? binding.sourceClip.playbackRate
      : 1

  return {
    ...project,
    assets: project.assets.map((asset) =>
      asset.id === binding.asset.id
        ? {
            ...asset,
            duration,
          }
        : asset,
    ),
    timeline: {
      ...project.timeline,
      items: project.timeline.items.map((timelineItem) =>
        isInitialFullSourceTimelineItem(
          timelineItem,
          binding.sourceClip,
          previousSourceDuration,
          playbackRate,
        )
          ? {
              ...timelineItem,
              sourceEnd: duration,
              timelineDuration: duration / playbackRate,
            }
          : timelineItem,
      ),
      tracks: project.timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) =>
          clip.id === binding.sourceClip.id
            ? updateSourceClip(clip, clip.name, duration)
            : clip,
        ),
      })),
      updatedAt,
    },
    updatedAt,
  }
}

export function getProjectMediaBinding(
  project: Project,
  mediaItemId: string | null,
): ProjectMediaBinding | null {
  if (!mediaItemId) {
    return null
  }

  const asset = project.assets.find(
    (candidate) => candidate.mediaItemId === mediaItemId,
  )
  const sourceClip = asset
    ? project.timeline.tracks
        .flatMap((track) => track.clips)
        .find((clip) => clip.assetId === asset.id)
    : null

  return asset && sourceClip
    ? {
        asset,
        sourceClip,
      }
    : null
}

export function getMediaItemIdForSourceClip(
  project: Project,
  sourceClipId: string,
) {
  return getProjectMediaBindingForSourceClip(project, sourceClipId)
    ?.asset.mediaItemId ?? null
}

export function getProjectMediaBindingForSourceClip(
  project: Project,
  sourceClipId: string,
): ProjectMediaBinding | null {
  const sourceClip = project.timeline.tracks
    .flatMap((track) => track.clips)
    .find((clip) => clip.id === sourceClipId)
  const asset = sourceClip
    ? project.assets.find((candidate) => candidate.id === sourceClip.assetId)
    : null

  return asset && sourceClip
    ? {
        asset,
        sourceClip,
      }
    : null
}

export function getMediaAssetId(mediaItemId: string) {
  return `asset-media-${mediaItemId}`
}

export function getProjectMediaRoles(project: Project): ProjectMediaRoles {
  const primaryAsset = getValidRoleAsset(
    project,
    project.mediaRoles?.primaryAssetId,
  ) ?? inferPrimaryAsset(project)
  const referenceAsset = getValidRoleAsset(
    project,
    project.mediaRoles?.referenceAssetId,
  )

  return {
    primaryAssetId: primaryAsset?.id ?? null,
    referenceAssetId:
      referenceAsset && referenceAsset.id !== primaryAsset?.id
        ? referenceAsset.id
        : null,
  }
}

export function normalizeProjectMediaRoles(project: Project): Project {
  const mediaRoles = getProjectMediaRoles(project)

  if (
    project.mediaRoles?.primaryAssetId === mediaRoles.primaryAssetId &&
    project.mediaRoles?.referenceAssetId === mediaRoles.referenceAssetId
  ) {
    return project
  }

  return {
    ...project,
    mediaRoles,
  }
}

export function getPrimaryProjectMediaBinding(
  project: Project,
): ProjectMediaBinding | null {
  return getProjectMediaBindingForAssetId(
    project,
    getProjectMediaRoles(project).primaryAssetId,
  )
}

export function getReferenceProjectMediaBinding(
  project: Project,
): ProjectMediaBinding | null {
  return getProjectMediaBindingForAssetId(
    project,
    getProjectMediaRoles(project).referenceAssetId,
  )
}

export function canChoosePrimaryMedia(
  project: Project,
  mediaItemId: string,
) {
  const candidate = getProjectMediaBinding(project, mediaItemId)
  const currentPrimary = getPrimaryProjectMediaBinding(project)

  return Boolean(
    candidate &&
    candidate.asset.type === 'video' &&
    (
      !currentPrimary ||
      currentPrimary.asset.id === candidate.asset.id ||
      !currentPrimary.asset.mediaItemId
    ),
  )
}

export function choosePrimaryProjectMedia(
  project: Project,
  mediaItemId: string,
): Project {
  const binding = getProjectMediaBinding(project, mediaItemId)

  if (!binding || !canChoosePrimaryMedia(project, mediaItemId)) {
    return project
  }

  const currentRoles = getProjectMediaRoles(project)
  const mediaRoles: ProjectMediaRoles = {
    primaryAssetId: binding.asset.id,
    referenceAssetId:
      currentRoles.referenceAssetId === binding.asset.id
        ? null
        : currentRoles.referenceAssetId,
  }

  if (
    project.mediaRoles?.primaryAssetId === mediaRoles.primaryAssetId &&
    project.mediaRoles?.referenceAssetId === mediaRoles.referenceAssetId
  ) {
    return project
  }

  return {
    ...project,
    mediaRoles,
    updatedAt: new Date().toISOString(),
  }
}

export function getPrimaryMediaReconnectError(
  project: Project,
  mediaItem: Omit<ProjectMediaDescriptor, 'id'>,
) {
  const primaryBinding = getPrimaryProjectMediaBinding(project)

  if (!primaryBinding || isInitialPrimaryPlaceholder(primaryBinding)) {
    return null
  }

  const asset = primaryBinding.asset

  if (asset.filename && asset.filename !== mediaItem.filename) {
    return `Selected file does not match the main video (${asset.filename}).`
  }

  if (
    asset.fileSize !== undefined &&
    mediaItem.fileSize !== undefined &&
    asset.fileSize !== mediaItem.fileSize
  ) {
    return 'Selected file size does not match the main video.'
  }

  if (
    asset.mimeType &&
    mediaItem.mimeType &&
    asset.mimeType !== mediaItem.mimeType
  ) {
    return 'Selected file type does not match the main video.'
  }

  if (
    asset.duration !== undefined &&
    mediaItem.duration !== undefined &&
    Math.abs(asset.duration - mediaItem.duration) > 0.001
  ) {
    return 'Selected file duration does not match the main video.'
  }

  return null
}

export function reconnectPrimaryProjectMedia(
  project: Project,
  mediaItem: ProjectMediaDescriptor,
): Project {
  const primaryBinding = getPrimaryProjectMediaBinding(project)

  if (
    !primaryBinding ||
    getPrimaryMediaReconnectError(project, mediaItem)
  ) {
    return project
  }

  const updatedAt = new Date().toISOString()

  return {
    ...project,
    assets: project.assets.map((asset) =>
      asset.id === primaryBinding.asset.id
        ? {
            ...asset,
            mediaItemId: mediaItem.id,
            filename: mediaItem.filename,
            fileSize: mediaItem.fileSize,
            mimeType: mediaItem.mimeType,
            lastModified: mediaItem.lastModified,
          }
        : asset,
    ),
    timeline: {
      ...project.timeline,
      tracks: project.timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) =>
          clip.id === primaryBinding.sourceClip.id
            ? {
                ...clip,
                name: mediaItem.filename,
                updatedAt,
              }
            : clip,
        ),
      })),
      updatedAt,
    },
    updatedAt,
  }
}

export function canChooseReferenceMedia(
  project: Project,
  mediaItemId: string,
) {
  const binding = getProjectMediaBinding(project, mediaItemId)
  const primaryAssetId = getProjectMediaRoles(project).primaryAssetId

  return Boolean(
    binding &&
    binding.asset.type === 'video' &&
    binding.asset.id !== primaryAssetId,
  )
}

export function chooseReferenceProjectMedia(
  project: Project,
  mediaItemId: string,
): Project {
  const binding = getProjectMediaBinding(project, mediaItemId)

  if (!binding || !canChooseReferenceMedia(project, mediaItemId)) {
    return project
  }

  const currentRoles = getProjectMediaRoles(project)

  if (currentRoles.referenceAssetId === binding.asset.id) {
    return project
  }

  return {
    ...project,
    mediaRoles: {
      primaryAssetId: currentRoles.primaryAssetId,
      referenceAssetId: binding.asset.id,
    },
    updatedAt: new Date().toISOString(),
  }
}

export function canCreateTimelineItemFromMedia(
  project: Project,
  mediaItemId: string,
) {
  const binding = getProjectMediaBinding(project, mediaItemId)
  const primaryBinding = getPrimaryProjectMediaBinding(project)
  const videoTrack = binding
    ? project.timeline.tracks.find(
        (track) =>
          track.id === binding.sourceClip.trackId &&
          track.type === 'video',
      )
    : null
  const sourceDuration = binding
    ? binding.sourceClip.source.end - binding.sourceClip.source.start
    : 0

  return Boolean(
    binding &&
    primaryBinding?.asset.id === binding.asset.id &&
    primaryBinding.sourceClip.id === binding.sourceClip.id &&
    binding.sourceClip.enabled &&
    videoTrack &&
    !videoTrack.locked &&
    videoTrack.visible &&
    Number.isFinite(sourceDuration) &&
    sourceDuration > 0,
  )
}

function getProjectMediaBindingForAssetId(
  project: Project,
  assetId: string | null,
): ProjectMediaBinding | null {
  if (!assetId) {
    return null
  }

  const asset = project.assets.find((candidate) => candidate.id === assetId)
  const sourceClip = asset
    ? project.timeline.tracks
        .flatMap((track) => track.clips)
        .find((clip) => clip.assetId === asset.id)
    : null

  return asset && sourceClip
    ? {
        asset,
        sourceClip,
      }
    : null
}

function isInitialPrimaryPlaceholder(binding: ProjectMediaBinding) {
  return !binding.asset.mediaItemId &&
    binding.asset.filename === 'Primary video' &&
    binding.sourceClip.name === 'Primary video'
}

function getValidRoleAsset(
  project: Project,
  assetId: string | null | undefined,
) {
  const asset = assetId
    ? project.assets.find((candidate) => candidate.id === assetId)
    : null

  return asset?.type === 'video' &&
    getProjectMediaBindingForAssetId(project, asset.id)
      ? asset
      : null
}

function inferPrimaryAsset(project: Project) {
  const sourceIds = [
    ...[...project.timeline.items]
      .sort((left, right) => left.timelineStart - right.timelineStart)
      .map((timelineItem) => timelineItem.sourceId),
    ...project.operations.flatMap((operation) =>
      operation.type === 'add-timeline-item'
        ? [operation.timelineItem.sourceId]
        : [],
    ),
  ]

  for (const sourceId of sourceIds) {
    const binding = getProjectMediaBindingForSourceClip(project, sourceId)

    if (binding?.asset.type === 'video') {
      return binding.asset
    }
  }

  return null
}

function areProjectMediaAssetsRegistered(
  project: Project,
  mediaItems: ProjectMediaDescriptor[],
) {
  return mediaItems.every((mediaItem) => {
    const binding = getProjectMediaBinding(project, mediaItem.id)
    const requestedDuration = getMediaDuration(mediaItem.duration, 0)

    return Boolean(
      binding &&
      binding.asset.filename === mediaItem.filename &&
      binding.sourceClip.name === mediaItem.filename &&
      (
        requestedDuration <= 0 ||
        (
          binding.asset.duration === requestedDuration &&
          binding.sourceClip.source.end === requestedDuration
        )
      ),
    )
  })
}

function updateSourceClip(
  clip: Clip,
  name: string,
  duration: number,
): Clip {
  return {
    ...clip,
    name,
    source: {
      start: 0,
      end: duration,
    },
    timeline: {
      start: 0,
      end: duration,
    },
    updatedAt: new Date().toISOString(),
  }
}

function isInitialFullSourceTimelineItem(
  timelineItem: Project['timeline']['items'][number],
  sourceClip: Clip,
  sourceDuration: number,
  playbackRate: number,
) {
  return timelineItem.sourceId === sourceClip.id &&
    Math.abs(timelineItem.timelineStart) <= DURATION_TOLERANCE &&
    Math.abs(timelineItem.sourceStart - sourceClip.source.start) <= DURATION_TOLERANCE &&
    Math.abs(timelineItem.sourceEnd - sourceClip.source.end) <= DURATION_TOLERANCE &&
    Math.abs(timelineItem.timelineDuration - sourceDuration / playbackRate) <=
      DURATION_TOLERANCE
}

function getMediaDuration(duration: number | undefined, fallback: number) {
  return Number.isFinite(duration) && (duration ?? 0) > 0
    ? duration ?? fallback
    : Math.max(fallback, 0)
}
