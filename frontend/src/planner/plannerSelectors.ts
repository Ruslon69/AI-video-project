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
  pause_after_completed_thought: 'Пауза после завершённой мысли',
  long_silence_after_sentence: 'Длинная пауза после законченной фразы',
  silence_between_scene_blocks: 'Пауза между сценами',
  silence_after_sentence_between_scenes:
    'Длинная пауза после фразы между сценами',
  extended_silence_without_speech: 'Продолжительная тишина без речи',
  extended_silence_after_unfinished_phrase:
    'Длинная пауза после незавершённой фразы',
  pause_after_unfinished_phrase: 'Пауза после незавершённой фразы',
  speech_break_for_review: 'Пауза в речи для проверки',
}

const explanationLabels: Record<RoughCutPlanReason, string> = {
  medium_pause: 'Можно убрать, если хочется сделать речь плотнее.',
  long_pause: 'Заметная пауза, которая может замедлять темп.',
  extended_silence: 'Длинный участок без речи, подходящий для проверки.',
  pause_after_completed_thought:
    'Речь закончена перед паузой, поэтому склейка должна звучать естественно.',
  long_silence_after_sentence:
    'После законченного предложения обнаружен длинный участок тишины.',
  silence_between_scene_blocks:
    'Пауза находится рядом с границей сцен и отделяет два смысловых блока.',
  silence_after_sentence_between_scenes:
    'Законченная фраза и смена сцены дают надёжную точку для сокращения.',
  extended_silence_without_speech:
    'Длинный участок тишины найден без достаточного речевого контекста.',
  extended_silence_after_unfinished_phrase:
    'Пауза длинная, но фраза выглядит незавершённой — склейку нужно проверить.',
  pause_after_unfinished_phrase:
    'Речь продолжается после паузы, поэтому предложение имеет низкий приоритет.',
  speech_break_for_review:
    'Пауза заметна, но фраза выглядит незавершённой — решение лучше проверить.',
}

const priorityLabels: Record<RoughCutPlanItemPriority, string> = {
  ignore: 'Игнорировать',
  low: 'Низкий приоритет',
  medium: 'Средний приоритет',
  high: 'Высокий приоритет',
  highest: 'Высокий приоритет',
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
  relatedSceneId: string | null
  precedingSpeechContext: string | null
  followingSpeechContext: string | null
}>

export type RoughCutPlanSummary = Readonly<{
  estimatedTimeSaved: number
  suggestionCount: number
  averageConfidence: number
  warningCount: number
  ignoredPauseCount: number
  highestConfidenceSuggestion: Readonly<{
    itemId: string
    reasonLabel: string
    confidence: number
  }> | null
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
      relatedSceneId: item.speechContext?.relatedSceneId ??
        getRelatedSceneId(analysis, item),
      precedingSpeechContext:
        item.speechContext?.precedingText ?? null,
      followingSpeechContext:
        item.speechContext?.followingText ?? null,
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
  const highestConfidenceItem = [...plan.items].sort(
    (left, right) =>
      right.confidence - left.confidence ||
      right.duration - left.duration ||
      left.id.localeCompare(right.id),
  )[0]

  return {
    estimatedTimeSaved: plan.estimatedTimeSaved,
    suggestionCount: plan.totalCandidateCount,
    averageConfidence: plan.confidenceSummary.average,
    warningCount: plan.confidenceSummary.warningCount,
    ignoredPauseCount: plan.ignoredPauseCount ?? 0,
    highestConfidenceSuggestion: highestConfidenceItem
      ? {
          itemId: highestConfidenceItem.id,
          reasonLabel: reasonLabels[highestConfidenceItem.reason],
          confidence: highestConfidenceItem.confidence,
        }
      : null,
    byPriority: {
      ignore: plan.items.filter((item) => item.priority === 'ignore').length,
      low: plan.items.filter((item) => item.priority === 'low').length,
      medium: plan.items.filter((item) => item.priority === 'medium').length,
      high: plan.items.filter((item) => item.priority === 'high').length,
      highest: plan.items.filter((item) => item.priority === 'highest').length,
    },
  }
}

function getRelatedSceneId(
  analysis: ProjectAnalysis,
  item: RoughCutPlanItem,
) {
  const midpoint = item.sourceStart + item.duration / 2
  const nearestScene = analysis.scenes
    .map((scene) => ({
      scene,
      distance: getPointRangeDistance(
        midpoint,
        scene.start,
        scene.end,
      ),
    }))
    .sort((left, right) => (
      left.distance - right.distance ||
      left.scene.start - right.scene.start ||
      left.scene.id.localeCompare(right.scene.id)
    ))[0]

  return nearestScene?.scene.id ?? null
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

function getPointRangeDistance(
  timestamp: number,
  start: number,
  end: number,
) {
  if (timestamp < start) {
    return start - timestamp
  }

  if (timestamp > end) {
    return timestamp - end
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
