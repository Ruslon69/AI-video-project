import type { ProjectAnalysis } from '../analysis/models'
import type {
  RoughCutPlan,
  RoughCutPlanConfidenceSummary,
  RoughCutPlanItem,
  RoughCutPlanItemPriority,
  RoughCutPlanItemReviewStatus,
  RoughCutPlanReason,
} from './models'
import {
  evaluatePauseForRoughCut,
  roughCutPlannerRules,
} from './SpeechPauseEvaluator'

export { roughCutPlannerRules } from './SpeechPauseEvaluator'

export function createRoughCutPlan(
  analysis: ProjectAnalysis,
  createdAt: string,
): RoughCutPlan {
  const evaluations = analysis.silences.map((silence) =>
    evaluatePauseForRoughCut(analysis, silence),
  )
  const items = evaluations
    .filter((evaluation) => evaluation.priority !== 'ignore')
    .map(createPausePlanItem)
    .sort((left, right) => (
      left.sourceStart - right.sourceStart ||
      left.sourceCandidateId.localeCompare(right.sourceCandidateId)
    ))

  return summarizePlan({
    schemaVersion: '2.0',
    plannerVersion: 'rough-cut-planner-v2',
    id: createPlanId(analysis),
    createdAt,
    primaryAssetId: analysis.sourceAssetId,
    analysisSchemaVersion: analysis.schemaVersion,
    analysisPipelineVersion: analysis.pipelineVersion,
    analysisGeneratedAt: analysis.generatedAt,
    status: items.length ? 'reviewing' : 'empty',
    estimatedTimeSaved: 0,
    totalCandidateCount: items.length,
    approvedCount: 0,
    rejectedCount: 0,
    pendingCount: items.length,
    confidenceSummary: getConfidenceSummary(items),
    items,
    execution: null,
    evaluatedPauseCount: evaluations.length,
    ignoredPauseCount: evaluations.length - items.length,
  })
}

export function setRoughCutPlanItemReviewStatus(
  plan: RoughCutPlan,
  itemId: string,
  reviewStatus: RoughCutPlanItemReviewStatus,
): RoughCutPlan {
  if (
    plan.execution ||
    !plan.items.some(
      (item) =>
        item.id === itemId &&
        item.executionStatus === 'not-applied',
    )
  ) {
    return plan
  }

  return summarizePlan({
    ...plan,
    items: plan.items.map((item) =>
      item.id === itemId ? { ...item, reviewStatus } : item,
    ),
  })
}

export function setAllRoughCutPlanItemsReviewStatus(
  plan: RoughCutPlan,
  reviewStatus: RoughCutPlanItemReviewStatus,
): RoughCutPlan {
  if (plan.execution) {
    return plan
  }

  return summarizePlan({
    ...plan,
    items: plan.items.map((item) =>
      item.executionStatus === 'not-applied'
        ? { ...item, reviewStatus }
        : item,
    ),
  })
}

export function restoreRoughCutPlanDefaults(plan: RoughCutPlan): RoughCutPlan {
  if (plan.execution) {
    return plan
  }

  return summarizePlan({
    ...plan,
    items: plan.items.map((item) => ({
      ...item,
      reviewStatus: item.executionStatus === 'not-applied'
        ? item.defaultReviewStatus
        : item.reviewStatus,
    })),
  })
}

export function isRoughCutPlanForAnalysis(
  plan: RoughCutPlan | null | undefined,
  analysis: ProjectAnalysis,
) {
  const isCurrentPlanner = plan?.schemaVersion === '2.0' &&
    plan.plannerVersion === 'rough-cut-planner-v2'
  const isPreviouslyAppliedLegacyPlan =
    plan?.schemaVersion === '1.0' &&
    plan.plannerVersion === 'rough-cut-planner-v1' &&
    plan.execution?.status === 'applied'

  return (isCurrentPlanner || isPreviouslyAppliedLegacyPlan) &&
    plan.primaryAssetId === analysis.sourceAssetId &&
    plan.analysisSchemaVersion === analysis.schemaVersion &&
    plan.analysisPipelineVersion === analysis.pipelineVersion &&
    plan.analysisGeneratedAt === analysis.generatedAt
}

export function isRoughCutPlan(value: unknown): value is RoughCutPlan {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const plan = value as Partial<RoughCutPlan>

  const isKnownVersion = (
    plan.schemaVersion === '1.0' &&
    plan.plannerVersion === 'rough-cut-planner-v1'
  ) || (
    plan.schemaVersion === '2.0' &&
    plan.plannerVersion === 'rough-cut-planner-v2'
  )

  return isKnownVersion &&
    typeof plan.id === 'string' &&
    typeof plan.createdAt === 'string' &&
    typeof plan.primaryAssetId === 'string' &&
    typeof plan.analysisSchemaVersion === 'string' &&
    typeof plan.analysisPipelineVersion === 'string' &&
    typeof plan.analysisGeneratedAt === 'string' &&
    isPlanExecution(plan.execution) &&
    (
      plan.plannerVersion === 'rough-cut-planner-v1' ||
      (
        typeof plan.evaluatedPauseCount === 'number' &&
        typeof plan.ignoredPauseCount === 'number' &&
        plan.evaluatedPauseCount >= plan.ignoredPauseCount
      )
    ) &&
    Array.isArray(plan.items) &&
    plan.items.every((item) => (
      typeof item.id === 'string' &&
      typeof item.sourceCandidateId === 'string' &&
      typeof item.analysisSourceId === 'string' &&
      item.analysisSource === 'silence' &&
      isPlanReason(item.reason) &&
      typeof item.sourceStart === 'number' &&
      typeof item.sourceEnd === 'number' &&
      typeof item.duration === 'number' &&
      typeof item.confidence === 'number' &&
      isPlanPriority(item.priority) &&
      isReviewStatus(item.reviewStatus) &&
      isReviewStatus(item.defaultReviewStatus) &&
      (
        item.executionStatus === 'not-applied' ||
        item.executionStatus === 'applied' ||
        item.executionStatus === 'skipped'
      ) &&
      typeof item.estimatedImpactSeconds === 'number' &&
      (
        plan.plannerVersion === 'rough-cut-planner-v1' ||
        (
          isSignalScores(item.signalScores) &&
          isSpeechContext(item.speechContext)
        )
      )
    ))
}

function isPlanReason(value: unknown): value is RoughCutPlanReason {
  return value === 'medium_pause' ||
    value === 'long_pause' ||
    value === 'extended_silence' ||
    value === 'pause_after_completed_thought' ||
    value === 'long_silence_after_sentence' ||
    value === 'silence_between_scene_blocks' ||
    value === 'silence_after_sentence_between_scenes' ||
    value === 'extended_silence_without_speech' ||
    value === 'extended_silence_after_unfinished_phrase' ||
    value === 'pause_after_unfinished_phrase' ||
    value === 'speech_break_for_review'
}

function isPlanPriority(value: unknown): value is RoughCutPlanItemPriority {
  return value === 'ignore' ||
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'highest'
}

function isSignalScores(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const scores = value as Record<string, unknown>

  return ['pause', 'speechConfidence', 'sentenceCompletion', 'scene'].every(
    (key) => typeof scores[key] === 'number',
  )
}

function isSpeechContext(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const context = value as Record<string, unknown>

  return (
    context.precedingText === null ||
    typeof context.precedingText === 'string'
  ) && (
    context.followingText === null ||
    typeof context.followingText === 'string'
  ) && (
    context.precedingTranscriptSegmentId === null ||
    typeof context.precedingTranscriptSegmentId === 'number'
  ) && (
    context.followingTranscriptSegmentId === null ||
    typeof context.followingTranscriptSegmentId === 'number'
  ) && (
    context.relatedSceneId === null ||
    typeof context.relatedSceneId === 'string'
  ) && (
    context.sentenceCompletion === 'completed' ||
    context.sentenceCompletion === 'continuation' ||
    context.sentenceCompletion === 'unknown'
  )
}

function isPlanExecution(value: RoughCutPlan['execution'] | unknown) {
  if (value === null || value === undefined) {
    return true
  }

  if (typeof value !== 'object') {
    return false
  }

  const execution = value as Partial<NonNullable<RoughCutPlan['execution']>>

  return execution.status === 'applied' &&
    execution.executionVersion === 'rough-cut-executor-v1' &&
    typeof execution.appliedAt === 'string' &&
    typeof execution.historyActionId === 'string' &&
    Array.isArray(execution.appliedItemIds) &&
    execution.appliedItemIds.every((itemId) => typeof itemId === 'string') &&
    Array.isArray(execution.skippedItemIds) &&
    execution.skippedItemIds.every((itemId) => typeof itemId === 'string') &&
    typeof execution.actualRemovedDuration === 'number' &&
    Number.isFinite(execution.actualRemovedDuration) &&
    execution.actualRemovedDuration >= 0
}

function isReviewStatus(value: unknown) {
  return value === 'pending' ||
    value === 'approved' ||
    value === 'rejected'
}

function createPausePlanItem(
  evaluation: ReturnType<typeof evaluatePauseForRoughCut>,
): RoughCutPlanItem {
  const { silence } = evaluation

  return {
    id: `rough-cut-item:${silence.id}`,
    sourceCandidateId: `analysis-silence-${silence.id}`,
    analysisSourceId: silence.id,
    analysisSource: 'silence',
    reason: evaluation.reason ?? 'speech_break_for_review',
    sourceStart: silence.start,
    sourceEnd: silence.end,
    duration: silence.duration,
    confidence: evaluation.confidence,
    priority: evaluation.priority,
    reviewStatus: 'pending',
    defaultReviewStatus: 'pending',
    executionStatus: 'not-applied',
    estimatedImpactSeconds: silence.duration,
    signalScores: evaluation.signalScores,
    speechContext: evaluation.speechContext,
  }
}

function summarizePlan(plan: RoughCutPlan): RoughCutPlan {
  const approvedCount = plan.items.filter(
    (item) => item.reviewStatus === 'approved',
  ).length
  const rejectedCount = plan.items.filter(
    (item) => item.reviewStatus === 'rejected',
  ).length
  const pendingCount = plan.items.length - approvedCount - rejectedCount

  return {
    ...plan,
    status: !plan.items.length
      ? 'empty'
      : pendingCount
        ? 'reviewing'
        : 'reviewed',
    estimatedTimeSaved: roundSeconds(
      plan.items
        .filter(
          (item) =>
            item.reviewStatus !== 'rejected' &&
            item.executionStatus !== 'skipped',
        )
        .reduce((total, item) => total + item.estimatedImpactSeconds, 0),
    ),
    totalCandidateCount: plan.items.length,
    approvedCount,
    rejectedCount,
    pendingCount,
    confidenceSummary: getConfidenceSummary(plan.items),
  }
}

function getConfidenceSummary(
  items: RoughCutPlanItem[],
): RoughCutPlanConfidenceSummary {
  if (!items.length) {
    return {
      average: 0,
      minimum: 0,
      maximum: 0,
      warningCount: 0,
    }
  }

  const confidences = items.map((item) => item.confidence)

  return {
    average: roundConfidence(
      confidences.reduce((total, confidence) => total + confidence, 0) /
        confidences.length,
    ),
    minimum: Math.min(...confidences),
    maximum: Math.max(...confidences),
    warningCount: confidences.filter(
      (confidence) =>
        confidence < roughCutPlannerRules.confidenceWarningThreshold,
    ).length,
  }
}

function createPlanId(analysis: ProjectAnalysis) {
  return [
    'rough-cut-plan',
    analysis.sourceAssetId,
    analysis.pipelineVersion,
    analysis.generatedAt,
  ].join(':')
}

function roundConfidence(value: number) {
  return Math.round(value * 1000) / 1000
}

function roundSeconds(value: number) {
  return Math.round(value * 1000) / 1000
}
