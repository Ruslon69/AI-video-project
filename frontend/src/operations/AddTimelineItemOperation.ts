import type { AddTimelineItemOperation } from '../models/EditOperation'
import type { Project } from '../models/Project'
import type { TimelineItem } from '../models/Track'
import type { EditProjection } from '../selectors/editProjection'
import {
  canCreateTimelineItemFromMedia,
  getProjectMediaBinding,
} from '../state/ProjectMedia'

export type AddTimelineItemOperationIds = Readonly<{
  operationId: string
  timelineItemId: string
}>

export function createInitialPrimaryTimelineItemOperation(
  project: Project,
  projection: EditProjection,
  mediaItemId: string,
  ids: AddTimelineItemOperationIds,
  selectionBeforeTimelineItemId: string | null,
  createdAt: string,
): AddTimelineItemOperation | null {
  const binding = getProjectMediaBinding(project, mediaItemId)

  if (
    !binding ||
    !canCreateTimelineItemFromMedia(project, mediaItemId) ||
    !ids.operationId ||
    !ids.timelineItemId ||
    projection.clipsById[ids.timelineItemId] ||
    projection.clips.length > 0
  ) {
    return null
  }

  const videoTrack = project.timeline.tracks.find(
    (track) =>
      track.id === binding.sourceClip.trackId &&
      track.type === 'video',
  )

  if (!videoTrack) {
    return null
  }

  const sourceDuration =
    binding.sourceClip.source.end - binding.sourceClip.source.start
  const playbackRate = Number.isFinite(binding.sourceClip.playbackRate) &&
    binding.sourceClip.playbackRate > 0
      ? binding.sourceClip.playbackRate
      : 1
  const timelineDuration = sourceDuration / playbackRate

  return {
    id: ids.operationId,
    type: 'add-timeline-item',
    timelineItem: {
      id: ids.timelineItemId,
      trackId: videoTrack.id,
      sourceId: binding.sourceClip.id,
      sourceStart: binding.sourceClip.source.start,
      sourceEnd: binding.sourceClip.source.end,
      timelineStart: 0,
      timelineDuration,
      locked: false,
      muted: false,
      visible: true,
    },
    selectionBeforeTimelineItemId,
    createdAt,
  }
}

export function createTimelineItemFromAddOperation(
  timelineItems: TimelineItem[],
  operation: AddTimelineItemOperation,
): TimelineItem | null {
  const timelineItem = operation.timelineItem
  const hasValidTimelineItem =
    Boolean(timelineItem.id) &&
    Boolean(timelineItem.sourceId) &&
    Number.isFinite(timelineItem.sourceStart) &&
    Number.isFinite(timelineItem.sourceEnd) &&
    Number.isFinite(timelineItem.timelineStart) &&
    Number.isFinite(timelineItem.timelineDuration) &&
    timelineItem.sourceEnd > timelineItem.sourceStart &&
    timelineItem.timelineStart >= 0 &&
    timelineItem.timelineDuration > 0 &&
    !timelineItems.some((item) => item.id === timelineItem.id)

  return hasValidTimelineItem
    ? {
        ...timelineItem,
      }
    : null
}
