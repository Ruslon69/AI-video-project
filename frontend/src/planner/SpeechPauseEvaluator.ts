import type {
  AnalysisScene,
  AnalysisSilence,
  AnalysisTranscriptSegment,
  ProjectAnalysis,
} from '../analysis/models'
import type {
  RoughCutPlanItemPriority,
  RoughCutPlanReason,
  RoughCutPlanSignalScores,
  RoughCutPlanSpeechContext,
  RoughCutSentenceCompletion,
} from './models'

const TIME_TOLERANCE_SECONDS = 0.0001

export const roughCutPlannerRules = {
  minimumPauseSeconds: 0.75,
  naturalContinuationSeconds: 1.1,
  longPauseSeconds: 2.5,
  veryLongPauseSeconds: 5,
  edgeGuardSeconds: 3,
  transcriptContextWindowSeconds: 3,
  sceneTransitionInteriorMarginSeconds: 0.1,
  sceneBoundaryProximitySeconds: 0.75,
  minimumSpeechConfidence: 0.55,
  confidenceWarningThreshold: 0.65,
  highPriorityConfidence: 0.84,
  mediumPriorityConfidence: 0.7,
  unknownSpeechConfidenceScore: 0.65,
  confidenceWeights: {
    pause: 0.45,
    speechConfidence: 0.25,
    sentenceCompletion: 0.2,
    scene: 0.1,
  },
} as const

export type PausePlanningEvaluation = Readonly<{
  silence: AnalysisSilence
  priority: Exclude<RoughCutPlanItemPriority, 'highest'>
  reason: RoughCutPlanReason | null
  confidence: number
  signalScores: RoughCutPlanSignalScores
  speechContext: RoughCutPlanSpeechContext
  ignoredBecause:
    | 'too-short'
    | 'intro'
    | 'outro'
    | 'scene-transition'
    | 'low-speech-confidence'
    | 'natural-continuation'
    | null
}>

export function evaluatePauseForRoughCut(
  analysis: ProjectAnalysis,
  silence: AnalysisSilence,
): PausePlanningEvaluation {
  const precedingSegment = findPrecedingTranscriptSegment(
    analysis.transcript.segments,
    silence,
  )
  const followingSegment = findFollowingTranscriptSegment(
    analysis.transcript.segments,
    silence,
  )
  const sentenceCompletion = getSentenceCompletion(precedingSegment?.text)
  const sceneSignal = getSceneSignal(analysis.scenes, silence)
  const speechConfidence = getSpeechConfidence(
    precedingSegment,
    followingSegment,
  )
  const signalScores = {
    pause: getPauseScore(silence.duration),
    speechConfidence: speechConfidence ??
      roughCutPlannerRules.unknownSpeechConfidenceScore,
    sentenceCompletion: getSentenceCompletionScore(sentenceCompletion),
    scene: sceneSignal.score,
  }
  const confidence = getCombinedConfidence(signalScores)
  const speechContext: RoughCutPlanSpeechContext = {
    precedingText: precedingSegment?.text.trim() || null,
    followingText: followingSegment?.text.trim() || null,
    precedingTranscriptSegmentId: precedingSegment?.id ?? null,
    followingTranscriptSegmentId: followingSegment?.id ?? null,
    relatedSceneId: sceneSignal.relatedSceneId,
    sentenceCompletion,
  }
  const ignoredBecause = getIgnoreReason({
    analysis,
    silence,
    followingSegment,
    sentenceCompletion,
    sceneTransition: sceneSignal.isTransition,
    speechConfidence,
  })

  if (ignoredBecause) {
    return {
      silence,
      priority: 'ignore',
      reason: null,
      confidence,
      signalScores,
      speechContext,
      ignoredBecause,
    }
  }

  const priority = getPriority(
    confidence,
    silence.duration,
    sentenceCompletion,
    sceneSignal.isNearBoundary,
  )

  return {
    silence,
    priority,
    reason: getReason(
      silence.duration,
      sentenceCompletion,
      sceneSignal.isNearBoundary,
      Boolean(precedingSegment || followingSegment),
    ),
    confidence,
    signalScores,
    speechContext,
    ignoredBecause: null,
  }
}

function getIgnoreReason({
  analysis,
  silence,
  followingSegment,
  sentenceCompletion,
  sceneTransition,
  speechConfidence,
}: {
  analysis: ProjectAnalysis
  silence: AnalysisSilence
  followingSegment: AnalysisTranscriptSegment | null
  sentenceCompletion: RoughCutSentenceCompletion
  sceneTransition: boolean
  speechConfidence: number | null
}): PausePlanningEvaluation['ignoredBecause'] {
  if (silence.duration < roughCutPlannerRules.minimumPauseSeconds) {
    return 'too-short'
  }

  if (silence.start < roughCutPlannerRules.edgeGuardSeconds) {
    return 'intro'
  }

  if (
    silence.end >
    analysis.metadata.duration - roughCutPlannerRules.edgeGuardSeconds
  ) {
    return 'outro'
  }

  if (sceneTransition) {
    return 'scene-transition'
  }

  if (
    speechConfidence !== null &&
    speechConfidence < roughCutPlannerRules.minimumSpeechConfidence
  ) {
    return 'low-speech-confidence'
  }

  if (
    silence.duration < roughCutPlannerRules.naturalContinuationSeconds &&
    sentenceCompletion !== 'completed' &&
    followingSegment
  ) {
    return 'natural-continuation'
  }

  return null
}

function findPrecedingTranscriptSegment(
  segments: AnalysisTranscriptSegment[],
  silence: AnalysisSilence,
) {
  return [...segments]
    .filter((segment) =>
      segment.end <= silence.start + TIME_TOLERANCE_SECONDS &&
      silence.start - segment.end <=
        roughCutPlannerRules.transcriptContextWindowSeconds,
    )
    .sort((left, right) => right.end - left.end || right.id - left.id)[0] ?? null
}

function findFollowingTranscriptSegment(
  segments: AnalysisTranscriptSegment[],
  silence: AnalysisSilence,
) {
  return [...segments]
    .filter((segment) =>
      segment.start >= silence.end - TIME_TOLERANCE_SECONDS &&
      segment.start - silence.end <=
        roughCutPlannerRules.transcriptContextWindowSeconds,
    )
    .sort((left, right) => left.start - right.start || left.id - right.id)[0] ??
      null
}

function getSentenceCompletion(
  text: string | undefined,
): RoughCutSentenceCompletion {
  const normalized = text?.trim()

  if (!normalized) {
    return 'unknown'
  }

  if (/(?:\.{3}|[.!?…])(?:["'»”)\]])?\s*$/u.test(normalized)) {
    return 'completed'
  }

  return /[-,;:—]\s*$/u.test(normalized) || normalized.length > 0
    ? 'continuation'
    : 'unknown'
}

function getSentenceCompletionScore(
  completion: RoughCutSentenceCompletion,
) {
  if (completion === 'completed') {
    return 1
  }

  return completion === 'continuation' ? 0.25 : 0.55
}

function getSpeechConfidence(
  preceding: AnalysisTranscriptSegment | null,
  following: AnalysisTranscriptSegment | null,
) {
  const confidences = [preceding?.confidence, following?.confidence].filter(
    (confidence): confidence is number =>
      confidence !== null &&
      confidence !== undefined &&
      Number.isFinite(confidence),
  )

  // A weak adjacent segment makes the cut boundary uncertain, so use the
  // weakest known confidence instead of allowing a strong neighbor to mask it.
  return confidences.length ? Math.min(...confidences) : null
}

function getSceneSignal(
  scenes: AnalysisScene[],
  silence: AnalysisSilence,
) {
  const boundaries = scenes
    .map((scene) => scene.start)
    .filter((boundary) => boundary > TIME_TOLERANCE_SECONDS)
  const isTransition = boundaries.some((boundary) =>
    boundary >
      silence.start +
        roughCutPlannerRules.sceneTransitionInteriorMarginSeconds &&
    boundary <
      silence.end -
        roughCutPlannerRules.sceneTransitionInteriorMarginSeconds,
  )
  const nearestBoundaryDistance = boundaries.length
    ? Math.min(
        ...boundaries.flatMap((boundary) => [
          Math.abs(boundary - silence.start),
          Math.abs(boundary - silence.end),
        ]),
      )
    : Number.POSITIVE_INFINITY
  const isNearBoundary =
    nearestBoundaryDistance <=
    roughCutPlannerRules.sceneBoundaryProximitySeconds
  const midpoint = silence.start + silence.duration / 2
  const relatedScene = [...scenes].sort((left, right) => {
    const leftDistance = getRangeDistance(
      midpoint,
      left.start,
      left.end,
    )
    const rightDistance = getRangeDistance(
      midpoint,
      right.start,
      right.end,
    )

    return leftDistance - rightDistance ||
      left.start - right.start ||
      left.id.localeCompare(right.id)
  })[0]

  return {
    isTransition,
    isNearBoundary,
    relatedSceneId: relatedScene?.id ?? null,
    score: isNearBoundary ? 0.85 : scenes.length ? 0.5 : 0.55,
  }
}

function getRangeDistance(timestamp: number, start: number, end: number) {
  if (timestamp < start) {
    return start - timestamp
  }

  if (timestamp > end) {
    return timestamp - end
  }

  return 0
}

function getPauseScore(duration: number) {
  return roundConfidence(
    clamp(
      (duration - roughCutPlannerRules.minimumPauseSeconds) /
        (
          roughCutPlannerRules.veryLongPauseSeconds -
          roughCutPlannerRules.minimumPauseSeconds
        ),
      0,
      1,
    ),
  )
}

// Deterministic v2 confidence:
// 45% pause duration + 25% adjacent speech confidence +
// 20% sentence completion + 10% scene-boundary context.
function getCombinedConfidence(scores: RoughCutPlanSignalScores) {
  const weights = roughCutPlannerRules.confidenceWeights

  return roundConfidence(
    scores.pause * weights.pause +
      scores.speechConfidence * weights.speechConfidence +
      scores.sentenceCompletion * weights.sentenceCompletion +
      scores.scene * weights.scene,
  )
}

function getPriority(
  confidence: number,
  duration: number,
  sentenceCompletion: RoughCutSentenceCompletion,
  isNearSceneBoundary: boolean,
): Exclude<RoughCutPlanItemPriority, 'ignore' | 'highest'> {
  if (
    confidence >= roughCutPlannerRules.highPriorityConfidence &&
    duration >= roughCutPlannerRules.longPauseSeconds &&
    (sentenceCompletion === 'completed' || isNearSceneBoundary)
  ) {
    return 'high'
  }

  return confidence >= roughCutPlannerRules.mediumPriorityConfidence
    ? 'medium'
    : 'low'
}

function getReason(
  duration: number,
  sentenceCompletion: RoughCutSentenceCompletion,
  isNearSceneBoundary: boolean,
  hasSpeechContext: boolean,
): RoughCutPlanReason {
  if (isNearSceneBoundary && sentenceCompletion === 'completed') {
    return 'silence_after_sentence_between_scenes'
  }

  if (isNearSceneBoundary) {
    return 'silence_between_scene_blocks'
  }

  if (sentenceCompletion === 'completed') {
    return duration >= roughCutPlannerRules.longPauseSeconds
      ? 'long_silence_after_sentence'
      : 'pause_after_completed_thought'
  }

  if (
    !hasSpeechContext &&
    duration >= roughCutPlannerRules.veryLongPauseSeconds
  ) {
    return 'extended_silence_without_speech'
  }

  return duration >= roughCutPlannerRules.longPauseSeconds
    ? 'extended_silence_after_unfinished_phrase'
    : 'pause_after_unfinished_phrase'
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function roundConfidence(value: number) {
  return Math.round(value * 1000) / 1000
}
