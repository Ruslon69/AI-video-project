import type { Project } from '../models/Project'
import type { TrackType } from '../models/Track'
import type { ComputedClip, EditProjection } from './editProjection'
import { formatDuration } from '../utils/mediaFormat'

export type InspectorProperty = Readonly<{
  id: string
  label: string
  value: string
}>

export type InspectorPropertySection = Readonly<{
  id: string
  title: string
  properties: InspectorProperty[]
  emptyState?: string
}>

export type InspectorClipSelection = Readonly<{
  kind: 'clip'
  title: string
  computedClip: ComputedClip
  sections: InspectorPropertySection[]
}>

export function getInspectorSelection(
  project: Project,
  projection: EditProjection,
  selectedTimelineItemId: string | null,
): InspectorClipSelection | null {
  if (!selectedTimelineItemId) {
    return null
  }

  const computedClip = projection.clipsById[selectedTimelineItemId]

  if (!computedClip) {
    return null
  }

  const track = project.timeline.tracks.find(
    (candidate) => candidate.id === computedClip.trackId,
  )
  const sourceClip = track?.clips.find(
    (candidate) => candidate.id === computedClip.sourceClipId,
  )

  if (!track || !sourceClip) {
    return null
  }

  return {
    kind: 'clip',
    title: sourceClip.name,
    computedClip,
    sections: [
      {
        id: 'general',
        title: 'General',
        properties: [
          { id: 'name', label: 'Name', value: sourceClip.name },
          { id: 'track', label: 'Track', value: track.name },
          {
            id: 'clip-type',
            label: 'Clip type',
            value: getTrackTypeLabel(track.type),
          },
          {
            id: 'status',
            label: 'Status',
            value: sourceClip.enabled ? 'Enabled' : 'Disabled',
          },
        ],
      },
      {
        id: 'timing',
        title: 'Timing',
        properties: [
          {
            id: 'start-time',
            label: 'Start time',
            value: formatDuration(computedClip.visibleStart),
          },
          {
            id: 'end-time',
            label: 'End time',
            value: formatDuration(computedClip.visibleEnd),
          },
          {
            id: 'duration',
            label: 'Duration',
            value: formatDuration(computedClip.visibleDuration),
          },
        ],
      },
      {
        id: 'transform',
        title: 'Transform',
        properties: [],
        emptyState: 'No transform properties are available for this clip yet.',
      },
      {
        id: 'appearance',
        title: 'Appearance',
        properties: [],
        emptyState: 'No appearance properties are available for this clip yet.',
      },
      {
        id: 'audio',
        title: 'Audio',
        properties: [
          {
            id: 'playback-rate',
            label: 'Playback rate',
            value: `${formatPlaybackRate(sourceClip.playbackRate)}x`,
          },
        ],
      },
      {
        id: 'metadata',
        title: 'Metadata',
        properties: [
          {
            id: 'source-start',
            label: 'Source start',
            value: formatDuration(computedClip.sourceRange.start),
          },
          {
            id: 'source-end',
            label: 'Source end',
            value: formatDuration(computedClip.sourceRange.end),
          },
          {
            id: 'source-duration',
            label: 'Source duration',
            value: formatDuration(computedClip.sourceDuration),
          },
          { id: 'source-clip-id', label: 'Source clip ID', value: sourceClip.id },
        ],
      },
    ],
  }
}

function getTrackTypeLabel(trackType: TrackType) {
  const labels: Record<TrackType, string> = {
    video: 'Video',
    audio: 'Audio',
    text: 'Text',
    effect: 'Effect',
  }

  return labels[trackType]
}

function formatPlaybackRate(playbackRate: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(playbackRate)
}
