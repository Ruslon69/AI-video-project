import type { Project } from '../models/Project'
import {
  validateRippleDelete,
  type RippleDeleteValidation,
} from '../operations/RippleDeleteOperation'
import type { EditProjection } from './editProjection'

export function getRippleDeleteValidation(
  project: Project,
  projection: EditProjection,
  timelineItemId: string | null,
): RippleDeleteValidation {
  const targetClip = timelineItemId
    ? projection.clipsById[timelineItemId]
    : null
  const track = targetClip
    ? project.timeline.tracks.find(
        (timelineTrack) => timelineTrack.id === targetClip.trackId,
      ) ?? null
    : null

  return validateRippleDelete(
    timelineItemId,
    track
      ? {
          id: track.id,
          type: track.type,
          locked: track.locked,
          visible: track.visible,
        }
      : null,
    projection.clips.map((clip) => ({
      timelineItemId: clip.timelineItemId,
      trackId: clip.trackId,
      timelineRange: clip.timelineRange,
      locked: clip.locked,
      visible: clip.visible,
    })),
  )
}

export function canRippleDeleteTimelineItem(
  project: Project,
  projection: EditProjection,
  timelineItemId: string | null,
) {
  return getRippleDeleteValidation(
    project,
    projection,
    timelineItemId,
  ).valid
}
