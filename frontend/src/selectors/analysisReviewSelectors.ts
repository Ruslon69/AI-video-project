import type {
  AnalysisScene,
  AnalysisSilence,
  AnalysisTranscriptSegment,
  ProjectAnalysis,
  ProjectAnalysisState,
} from '../analysis/models'
import type { VideoPreviewFrame } from '../types'
import type { ComputedClip, EditProjection } from './editProjection'
import { sourceToTimeline, timelineToSource } from './timeMapping'
import { sourceTime, timelineTime } from '../models/Time'

const TIME_TOLERANCE_SECONDS = 0.0001

export const pauseClassificationConfig = {
  noticeablePauseSeconds: 1.25,
  longPauseSeconds: 2.5,
} as const

export const analysisConfidenceConfig = {
  lowTranscriptConfidence: 0.6,
  visibleConfidence: 0.8,
} as const

export type AnalysisSeekTarget = Readonly<{
  sourceTime: number
  timelineTime: number | null
  availability: 'timeline' | 'removed'
}>

export type PauseClassification = 'short' | 'noticeable' | 'long'

export type AnalysisReviewTranscriptSegment = Readonly<{
  id: number
  start: number
  end: number
  text: string
  confidence: number | null
  isLowConfidence: boolean
  seekTarget: AnalysisSeekTarget
}>

export type AnalysisReviewPause = Readonly<{
  id: string
  start: number
  end: number
  duration: number
  classification: PauseClassification
  isRoughCutCandidate: boolean
  seekTarget: AnalysisSeekTarget
}>

export type AnalysisReviewScene = Readonly<{
  id: string
  number: number
  start: number
  end: number
  duration: number
  confidence: number
  thumbnailUrl: string | null
  seekTarget: AnalysisSeekTarget
}>

export type AnalysisReviewSummary = Readonly<{
  duration: number
  transcriptSegmentCount: number
  sceneCount: number
  pauseCount: number
  totalSilenceDuration: number
  longPauseCount: number
}>

export type AnalysisReviewPresentation = Readonly<{
  status: ProjectAnalysisState['status']
  sourceAssetId: string | null
  summary: AnalysisReviewSummary | null
  transcript: AnalysisReviewTranscriptSegment[]
  pauses: AnalysisReviewPause[]
  scenes: AnalysisReviewScene[]
}>

export type AnalysisTimelineOverlay = Readonly<{
  id: string
  kind: 'scene-boundary' | 'silence-range'
  timelineStart: number
  timelineEnd: number
  sourceId: string
}>

export type RoughCutCandidate = Readonly<{
  id: string
  source: 'analysis-silence'
  sourceStart: number
  sourceEnd: number
  duration: number
  reason: string
  priority: 'review' | 'high'
  reviewStatus: 'unreviewed'
  seekTarget: AnalysisSeekTarget
}>

export function getAnalysisReviewPresentation(
  analysisState: ProjectAnalysisState,
  projection: EditProjection,
  previewFrames: VideoPreviewFrame[] = [],
): AnalysisReviewPresentation {
  const analysis = getCurrentAnalysis(analysisState)

  if (!analysis) {
    return {
      status: analysisState.status,
      sourceAssetId: analysisState.sourceAssetId,
      summary: null,
      transcript: [],
      pauses: [],
      scenes: [],
    }
  }

  return {
    status: analysisState.status,
    sourceAssetId: analysis.sourceAssetId,
    summary: getAnalysisSummary(analysis),
    transcript: analysis.transcript.segments.map((segment) => ({
      ...segment,
      isLowConfidence: isLowTranscriptConfidence(segment.confidence),
      seekTarget: resolveAnalysisSourceTime(projection, segment.start),
    })),
    pauses: analysis.silences.map((silence) => ({
      ...silence,
      classification: getPauseClassification(silence.duration),
      isRoughCutCandidate: getPauseClassification(silence.duration) === 'long',
      seekTarget: resolveAnalysisSourceTime(projection, silence.start),
    })),
    scenes: analysis.scenes.map((scene, index) => ({
      ...scene,
      number: index + 1,
      duration: Math.max(scene.end - scene.start, 0),
      thumbnailUrl: getRepresentativeThumbnail(scene, previewFrames),
      seekTarget: resolveAnalysisSourceTime(projection, scene.start),
    })),
  }
}

export function getAnalysisSummary(analysis: ProjectAnalysis): AnalysisReviewSummary {
  const pauses = analysis.silences
  const longPauseCount = pauses.filter(
    (pause) => getPauseClassification(pause.duration) === 'long',
  ).length

  return {
    duration: analysis.metadata.duration,
    transcriptSegmentCount: analysis.transcript.segments.length,
    sceneCount: analysis.scenes.length,
    pauseCount: pauses.length,
    totalSilenceDuration: pauses.reduce((total, pause) => total + pause.duration, 0),
    longPauseCount,
  }
}

export function getPauseClassification(duration: number): PauseClassification {
  if (duration >= pauseClassificationConfig.longPauseSeconds) {
    return 'long'
  }

  if (duration >= pauseClassificationConfig.noticeablePauseSeconds) {
    return 'noticeable'
  }

  return 'short'
}

export function isLowTranscriptConfidence(confidence: number | null) {
  return confidence !== null && confidence < analysisConfidenceConfig.lowTranscriptConfidence
}

export function shouldShowConfidence(confidence: number | null) {
  return confidence !== null && confidence < analysisConfidenceConfig.visibleConfidence
}

export function resolveAnalysisSourceTime(
  projection: EditProjection,
  sourceTime: number,
): AnalysisSeekTarget {
  const occurrence = getSourceTimelineOccurrences(projection, sourceTime)[0]

  return {
    sourceTime,
    timelineTime: occurrence?.timelineTime ?? null,
    availability: occurrence ? 'timeline' : 'removed',
  }
}

export function getActiveAnalysisIds(
  analysis: ProjectAnalysis | null,
  projection: EditProjection,
  timelineTime: number,
) {
  if (!analysis) {
    return {
      transcriptSegmentId: null,
      sceneId: null,
      pauseId: null,
    }
  }

  const sourceTime = resolveTimelineSourceTime(projection, timelineTime)

  return {
    transcriptSegmentId: sourceTime === null
      ? null
      : findActiveRange(analysis.transcript.segments, sourceTime)?.id ?? null,
    sceneId: sourceTime === null
      ? null
      : findActiveRange(analysis.scenes, sourceTime)?.id ?? null,
    pauseId: sourceTime === null
      ? null
      : findActiveRange(analysis.silences, sourceTime)?.id ?? null,
  }
}

export function getAnalysisTimelineOverlays(
  analysisState: ProjectAnalysisState,
  projection: EditProjection,
): AnalysisTimelineOverlay[] {
  const analysis = getCurrentAnalysis(analysisState)

  if (!analysis) {
    return []
  }

  const sceneMarkers = analysis.scenes.flatMap((scene) =>
    getSourceTimelineOccurrences(projection, scene.start).map((occurrence) => ({
      id: `scene-${scene.id}-${occurrence.timelineItemId}`,
      kind: 'scene-boundary' as const,
      timelineStart: occurrence.timelineTime,
      timelineEnd: occurrence.timelineTime,
      sourceId: scene.id,
    })),
  )
  const silenceRanges = analysis.silences.flatMap((silence) =>
    projectSourceRange(projection, silence).map((range, index) => ({
      id: `silence-${silence.id}-${index}`,
      kind: 'silence-range' as const,
      timelineStart: range.start,
      timelineEnd: range.end,
      sourceId: silence.id,
    })),
  )

  return [...sceneMarkers, ...silenceRanges]
}

export function getRoughCutCandidates(
  analysisState: ProjectAnalysisState,
  projection: EditProjection,
): RoughCutCandidate[] {
  const analysis = getCurrentAnalysis(analysisState)

  if (!analysis) {
    return []
  }

  return analysis.silences.map((silence) => {
    const classification = getPauseClassification(silence.duration)

    return {
      id: `analysis-silence-${silence.id}`,
      source: 'analysis-silence',
      sourceStart: silence.start,
      sourceEnd: silence.end,
      duration: silence.duration,
      reason: classification === 'long' ? 'Длинная пауза' : 'Пауза для проверки',
      priority: classification === 'long' ? 'high' : 'review',
      reviewStatus: 'unreviewed',
      seekTarget: resolveAnalysisSourceTime(projection, silence.start),
    }
  })
}

function getCurrentAnalysis(analysisState: ProjectAnalysisState) {
  const analysis = analysisState.result

  return analysisState.status === 'completed' &&
    analysis !== null &&
    analysis.sourceAssetId === analysisState.sourceAssetId
    ? analysis
    : null
}

function getSourceTimelineOccurrences(
  projection: EditProjection,
  sourceTimestamp: number,
) {
  return projection.clips
    .flatMap((clip) => {
      if (!isSourceTimeVisibleInClip(clip, sourceTimestamp)) {
        return []
      }

      const projectedTimelineTime = sourceToTimeline(
        sourceTime(sourceTimestamp),
        clip.timeMapping,
      )

      return isPlayableTimelineTime(clip, projectedTimelineTime)
        ? [{ timelineItemId: clip.timelineItemId, timelineTime: projectedTimelineTime }]
        : []
    })
    .sort((left, right) => (
      left.timelineTime - right.timelineTime ||
      left.timelineItemId.localeCompare(right.timelineItemId)
    ))
}

function projectSourceRange(
  projection: EditProjection,
  range: Pick<AnalysisSilence, 'start' | 'end'>,
) {
  return projection.clips.flatMap((clip) => {
    const sourceStart = Math.max(range.start, clip.sourceRange.start)
    const sourceEnd = Math.min(range.end, clip.sourceRange.end)

    if (sourceEnd <= sourceStart + TIME_TOLERANCE_SECONDS) {
      return []
    }

    const timelineStart = sourceToTimeline(sourceTime(sourceStart), clip.timeMapping)
    const timelineEnd = sourceToTimeline(sourceTime(sourceEnd), clip.timeMapping)

    return clip.playbackRanges.flatMap((playbackRange) => {
      const start = Math.max(timelineStart, playbackRange.start)
      const end = Math.min(timelineEnd, playbackRange.end)

      return end > start + TIME_TOLERANCE_SECONDS ? [{ start, end }] : []
    })
  })
}

function resolveTimelineSourceTime(
  projection: EditProjection,
  timelineTimestamp: number,
) {
  const clip = projection.clips.find((candidate) =>
    isPlayableTimelineTime(candidate, timelineTimestamp),
  )

  return clip
    ? timelineToSource(timelineTime(timelineTimestamp), clip.timeMapping)
    : null
}

function isSourceTimeVisibleInClip(clip: ComputedClip, sourceTime: number) {
  return sourceTime >= clip.sourceRange.start - TIME_TOLERANCE_SECONDS &&
    sourceTime < clip.sourceRange.end - TIME_TOLERANCE_SECONDS
}

function isPlayableTimelineTime(clip: ComputedClip, timelineTime: number) {
  return clip.playbackRanges.some((range) =>
    timelineTime >= range.start - TIME_TOLERANCE_SECONDS &&
    timelineTime < range.end - TIME_TOLERANCE_SECONDS,
  )
}

function findActiveRange<T extends Pick<AnalysisTranscriptSegment | AnalysisScene, 'start' | 'end'>>(
  ranges: T[],
  sourceTime: number,
) {
  return ranges.find((range) =>
    sourceTime >= range.start - TIME_TOLERANCE_SECONDS &&
    sourceTime < range.end - TIME_TOLERANCE_SECONDS,
  ) ?? null
}

function getRepresentativeThumbnail(
  scene: AnalysisScene,
  previewFrames: VideoPreviewFrame[],
) {
  if (!previewFrames.length) {
    return null
  }

  return previewFrames.reduce((nearest, frame) => (
    Math.abs(frame.timestamp - scene.start) < Math.abs(nearest.timestamp - scene.start)
      ? frame
      : nearest
  )).data_url
}
