import type { ProjectAnalysis } from '../analysis/models'
import type {
  AnalysisSeekTarget,
} from '../selectors/analysisReviewSelectors'
import { resolveAnalysisSourceTime } from '../selectors/analysisReviewSelectors'
import type { EditProjection } from '../selectors/editProjection'
import type {
  RoughCutPlan,
  RoughCutPlanItem,
  RoughCutPlanItemPriority,
  RoughCutPlanItemReviewStatus,
  RoughCutPlanReason,
} from './models'
import type {
  RoughCutExecutionPreview,
  RoughCutExecutionRejectionReason,
} from '../execution/RoughCutExecutor'

const reasonLabels: Record<RoughCutPlanReason, string> = {
  medium_pause: 'Пауза средней длины',
  long_pause: 'Длинная пауза',
  extended_silence: 'Продолжительная тишина',
}

const explanationLabels: Record<RoughCutPlanReason, string> = {
  medium_pause: 'Можно убрать, если хочется сделать речь плотнее.',
  long_pause: 'Заметная пауза, которая может замедлять темп.',
  extended_silence: 'Длинный участок без речи, подходящий для проверки.',
}

const priorityLabels: Record<RoughCutPlanItemPriority, string> = {
  low: 'Низкий приоритет',
  high: 'Высокий приоритет',
  highest: 'Наивысший приоритет',
}

const reviewStatusLabels: Record<RoughCutPlanItemReviewStatus, string> = {
  pending: 'На проверке',
  approved: 'Одобрено',
  rejected: 'Отклонено',
}

export type RoughCutPlanItemPresentation = Readonly<{
  item: RoughCutPlanItem
  reasonLabel: string
  explanation: string
  priorityLabel: string
  reviewStatusLabel: string
  confidencePercent: number
  seekTarget: AnalysisSeekTarget
  relatedTranscriptSegmentId: number | null
}>

export type RoughCutPlanSummary = Readonly<{
  estimatedTimeSaved: number
  suggestionCount: number
  averageConfidence: number
  warningCount: number
  longestPause: number
  averagePauseDuration: number
  byPriority: Record<RoughCutPlanItemPriority, number>
}>

export type RoughCutPlanPresentation = Readonly<{
  plan: RoughCutPlan | null
  summary: RoughCutPlanSummary | null
  items: RoughCutPlanItemPresentation[]
}>

export type RoughCutExecutionPresentation = Readonly<{
  canApply: boolean
  approvedCount: number
  availableCount: number
  unavailableCount: number
  estimatedRemovedDuration: number
  warningCount: number
  disabledReason: string | null
  appliedCount: number
  skippedCount: number
  actualRemovedDuration: number
  appliedAt: string | null
}>

export function getRoughCutPlanPresentation(
  plan: RoughCutPlan | null | undefined,
  analysis: ProjectAnalysis | null,
  projection: EditProjection,
): RoughCutPlanPresentation {
  if (!plan || !analysis || plan.primaryAssetId !== analysis.sourceAssetId) {
    return {
      plan: null,
      summary: null,
      items: [],
    }
  }

  return {
    plan,
    summary: getRoughCutPlanSummary(plan),
    items: plan.items.map((item) => ({
      item,
      reasonLabel: reasonLabels[item.reason],
      explanation: explanationLabels[item.reason],
      priorityLabel: priorityLabels[item.priority],
      reviewStatusLabel: reviewStatusLabels[item.reviewStatus],
      confidencePercent: Math.round(item.confidence * 100),
      seekTarget: resolveAnalysisSourceTime(projection, item.sourceStart),
      relatedTranscriptSegmentId: getRelatedTranscriptSegmentId(
        analysis,
        item,
      ),
    })),
  }
}

export function getRoughCutExecutionPresentation(
  preview: RoughCutExecutionPreview,
  plan: RoughCutPlan | null | undefined,
): RoughCutExecutionPresentation {
  const execution = plan?.execution

  return {
    canApply: preview.valid && !execution,
    approvedCount: preview.approvedCount,
    availableCount: preview.availableCount,
    unavailableCount: preview.unavailableCount,
    estimatedRemovedDuration: preview.estimatedRemovedDuration,
    warningCount: preview.warningCount,
    disabledReason: execution
      ? 'Этот план уже применён. Чтобы создать новый вариант, пересоберите план.'
      : preview.reason
        ? executionRejectionLabels[preview.reason]
        : null,
    appliedCount: execution?.appliedItemIds.length ?? 0,
    skippedCount: execution?.skippedItemIds.length ?? 0,
    actualRemovedDuration: execution?.actualRemovedDuration ?? 0,
    appliedAt: execution?.appliedAt ?? null,
  }
}

export function getRoughCutPlanSummary(plan: RoughCutPlan): RoughCutPlanSummary {
  const durations = plan.items.map((item) => item.duration)

  return {
    estimatedTimeSaved: plan.estimatedTimeSaved,
    suggestionCount: plan.totalCandidateCount,
    averageConfidence: plan.confidenceSummary.average,
    warningCount: plan.confidenceSummary.warningCount,
    longestPause: durations.length ? Math.max(...durations) : 0,
    averagePauseDuration: durations.length
      ? durations.reduce((total, duration) => total + duration, 0) /
        durations.length
      : 0,
    byPriority: {
      low: plan.items.filter((item) => item.priority === 'low').length,
      high: plan.items.filter((item) => item.priority === 'high').length,
      highest: plan.items.filter((item) => item.priority === 'highest').length,
    },
  }
}

function getRelatedTranscriptSegmentId(
  analysis: ProjectAnalysis,
  item: RoughCutPlanItem,
) {
  const nearestSegment = analysis.transcript.segments
    .map((segment) => ({
      segment,
      distance: getRangeDistance(
        item.sourceStart,
        item.sourceEnd,
        segment.start,
        segment.end,
      ),
    }))
    .sort((left, right) => (
      left.distance - right.distance ||
      left.segment.start - right.segment.start ||
      left.segment.id - right.segment.id
    ))[0]

  return nearestSegment?.segment.id ?? null
}

function getRangeDistance(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
) {
  if (leftEnd < rightStart) {
    return rightStart - leftEnd
  }

  if (rightEnd < leftStart) {
    return leftStart - rightEnd
  }

  return 0
}

const executionRejectionLabels: Record<
  RoughCutExecutionRejectionReason,
  string
> = {
  'missing-plan': 'Сначала подготовьте план чернового монтажа.',
  'missing-analysis': 'Дождитесь завершения анализа видео.',
  'stale-analysis': 'Анализ изменился. Пересоберите план.',
  'primary-asset-mismatch': 'План относится к другому основному видео.',
  'source-unavailable': 'Сначала подключите исходный видеофайл.',
  'already-applied': 'Этот план уже применён.',
  'no-approved-items': 'Одобрите хотя бы одно предложение.',
  'invalid-approved-item': 'Одно из предложений больше не соответствует анализу.',
  'locked-or-hidden-track': 'Дорожка или клип недоступны для изменения.',
  'ambiguous-mapping': 'Не удалось однозначно найти фрагмент на таймлайне.',
  'no-available-items': 'Одобренные фрагменты уже отсутствуют в монтаже.',
  'operation-build-failed': 'Не удалось безопасно подготовить изменения.',
}
