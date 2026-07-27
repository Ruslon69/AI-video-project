import type { ProjectAnalysis } from '../analysis/models'
import type {
  RoughCutPlan,
  RoughCutPlanConfidenceSummary,
  RoughCutPlanItem,
  RoughCutPlanItemPriority,
  RoughCutPlanItemReviewStatus,
  RoughCutPlanReason,
} from './models'

export const roughCutPlannerRules = {
  minimumPauseSeconds: 0.75,
  longPauseSeconds: 2.5,
  veryLongPauseSeconds: 5,
  confidenceFloor: 0.55,
  confidenceCeiling: 0.95,
  confidenceWarningThreshold: 0.65,
} as const

export function createRoughCutPlan(
  analysis: ProjectAnalysis,
  createdAt: string,
): RoughCutPlan {
  const items = analysis.silences
    .filter((silence) =>
      silence.duration >= roughCutPlannerRules.minimumPauseSeconds,
    )
    .map(createPausePlanItem)
    .sort((left, right) => (
      left.sourceStart - right.sourceStart ||
      left.sourceCandidateId.localeCompare(right.sourceCandidateId)
    ))

  return summarizePlan({
    schemaVersion: '1.0',
    plannerVersion: 'rough-cut-planner-v1',
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
  return plan?.schemaVersion === '1.0' &&
    plan.plannerVersion === 'rough-cut-planner-v1' &&
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

  return plan.schemaVersion === '1.0' &&
    plan.plannerVersion === 'rough-cut-planner-v1' &&
    typeof plan.id === 'string' &&
    typeof plan.createdAt === 'string' &&
    typeof plan.primaryAssetId === 'string' &&
    typeof plan.analysisSchemaVersion === 'string' &&
    typeof plan.analysisPipelineVersion === 'string' &&
    typeof plan.analysisGeneratedAt === 'string' &&
    isPlanExecution(plan.execution) &&
    Array.isArray(plan.items) &&
    plan.items.every((item) => (
      typeof item.id === 'string' &&
      typeof item.sourceCandidateId === 'string' &&
      typeof item.analysisSourceId === 'string' &&
      item.analysisSource === 'silence' &&
      (
        item.reason === 'medium_pause' ||
        item.reason === 'long_pause' ||
        item.reason === 'extended_silence'
      ) &&
      typeof item.sourceStart === 'number' &&
      typeof item.sourceEnd === 'number' &&
      typeof item.duration === 'number' &&
      typeof item.confidence === 'number' &&
      (
        item.priority === 'low' ||
        item.priority === 'high' ||
        item.priority === 'highest'
      ) &&
      isReviewStatus(item.reviewStatus) &&
      isReviewStatus(item.defaultReviewStatus) &&
      (
        item.executionStatus === 'not-applied' ||
        item.executionStatus === 'applied' ||
        item.executionStatus === 'skipped'
      ) &&
      typeof item.estimatedImpactSeconds === 'number'
    ))
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
  silence: ProjectAnalysis['silences'][number],
): RoughCutPlanItem {
  const priority = getPausePriority(silence.duration)

  return {
    id: `rough-cut-item:${silence.id}`,
    sourceCandidateId: `analysis-silence-${silence.id}`,
    analysisSourceId: silence.id,
    analysisSource: 'silence',
    reason: getPauseReason(priority),
    sourceStart: silence.start,
    sourceEnd: silence.end,
    duration: silence.duration,
    confidence: getPauseConfidence(silence.duration),
    priority,
    reviewStatus: 'pending',
    defaultReviewStatus: 'pending',
    executionStatus: 'not-applied',
    estimatedImpactSeconds: silence.duration,
  }
}

function getPausePriority(duration: number): RoughCutPlanItemPriority {
  if (duration >= roughCutPlannerRules.veryLongPauseSeconds) {
    return 'highest'
  }

  return duration >= roughCutPlannerRules.longPauseSeconds ? 'high' : 'low'
}

function getPauseReason(priority: RoughCutPlanItemPriority): RoughCutPlanReason {
  if (priority === 'highest') {
    return 'extended_silence'
  }

  return priority === 'high' ? 'long_pause' : 'medium_pause'
}

// V1 confidence uses pause duration only: 0.55 + 0.40 times normalized
// duration between the minimum and very-long thresholds, capped at 0.95.
function getPauseConfidence(duration: number) {
  const normalizedDuration = clamp(
    (duration - roughCutPlannerRules.minimumPauseSeconds) /
      (
        roughCutPlannerRules.veryLongPauseSeconds -
        roughCutPlannerRules.minimumPauseSeconds
      ),
    0,
    1,
  )

  return roundConfidence(
    roughCutPlannerRules.confidenceFloor +
      normalizedDuration *
        (
          roughCutPlannerRules.confidenceCeiling -
          roughCutPlannerRules.confidenceFloor
        ),
  )
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function roundConfidence(value: number) {
  return Math.round(value * 1000) / 1000
}

function roundSeconds(value: number) {
  return Math.round(value * 1000) / 1000
}
