import { useState } from 'react'
import type {
  RoughCutExecutionPresentation,
  RoughCutPlanItemPresentation,
  RoughCutPlanPresentation,
} from '../../planner/plannerSelectors'
import type {
  RoughCutPlanItemReviewStatus,
} from '../../planner/models'
import { formatDuration } from '../../utils/mediaFormat'

const reviewActions: ReadonlyArray<{
  status: RoughCutPlanItemReviewStatus
  label: string
  symbol: string
}> = [
  { status: 'pending', label: 'Вернуть на проверку', symbol: '•' },
  { status: 'approved', label: 'Одобрить', symbol: '✓' },
  { status: 'rejected', label: 'Отклонить', symbol: '×' },
]

export function RoughCutPlanPanel({
  presentation,
  activeItemId,
  canRebuild,
  onActivate,
  onItemStatusChange,
  onAllStatusChange,
  onRestoreDefaults,
  onRebuild,
  execution,
  onApply,
}: {
  presentation: RoughCutPlanPresentation
  activeItemId: string | null
  canRebuild: boolean
  onActivate: (item: RoughCutPlanItemPresentation) => void
  onItemStatusChange: (
    itemId: string,
    status: RoughCutPlanItemReviewStatus,
  ) => void
  onAllStatusChange: (status: RoughCutPlanItemReviewStatus) => void
  onRestoreDefaults: () => void
  onRebuild: () => void
  execution: RoughCutExecutionPresentation
  onApply: () => string | null
}) {
  const plan = presentation.plan
  const summary = presentation.summary
  const [isConfirming, setIsConfirming] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const handleApply = () => {
    if (isApplying || !execution.canApply) {
      return
    }

    setIsApplying(true)
    setApplyError(null)
    window.setTimeout(() => {
      const error = onApply()

      if (error) {
        setApplyError('Не удалось применить план. Проверьте его актуальность и попробуйте снова.')
      } else {
        setIsConfirming(false)
      }

      setIsApplying(false)
    }, 0)
  }

  return (
    <section
      className="rough-cut-plan-panel"
      aria-label="План чернового монтажа"
    >
      <div className="rough-cut-plan-head">
        <div>
          <p className="section-label">Черновой монтаж</p>
          <h3>Предложения перед применением</h3>
        </div>
        <button
          type="button"
          className="ghost-button compact-button"
          disabled={!canRebuild}
          onClick={onRebuild}
        >
          Пересобрать
        </button>
      </div>
      <p className="rough-cut-plan-note">
        Проверьте предложения. Таймлайн изменится только после отдельного подтверждения.
      </p>
      {!plan || !summary ? (
        <p className="rough-cut-plan-empty">
          Завершите анализ видео, чтобы подготовить план чернового монтажа.
        </p>
      ) : (
        <>
          <RoughCutPlanSummary
            presentation={presentation}
          />
          {presentation.items.length ? (
            <>
              <div
                className="rough-cut-plan-actions"
                aria-label="Групповые действия с планом"
              >
                <button
                  type="button"
                  className="ghost-button compact-button"
                  disabled={Boolean(plan.execution)}
                  onClick={() => onAllStatusChange('approved')}
                >
                  Одобрить всё
                </button>
                <button
                  type="button"
                  className="ghost-button compact-button"
                  disabled={Boolean(plan.execution)}
                  onClick={() => onAllStatusChange('rejected')}
                >
                  Отклонить всё
                </button>
                <button
                  type="button"
                  className="ghost-button compact-button"
                  disabled={Boolean(plan.execution)}
                  onClick={onRestoreDefaults}
                >
                  Вернуть исходный выбор
                </button>
              </div>
              <RoughCutApplyControl
                execution={execution}
                isConfirming={isConfirming}
                isApplying={isApplying}
                error={applyError}
                onConfirmRequest={() => {
                  setApplyError(null)
                  setIsConfirming(true)
                }}
                onCancel={() => setIsConfirming(false)}
                onApply={handleApply}
              />
              <div className="rough-cut-plan-list">
                {presentation.items.map((item) => (
                  <RoughCutPlanItemRow
                    key={item.item.id}
                    presentation={item}
                    isActive={activeItemId === item.item.id}
                    onActivate={onActivate}
                    onStatusChange={onItemStatusChange}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="rough-cut-plan-empty">
              Подходящих пауз для чернового монтажа не найдено.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function RoughCutPlanSummary({
  presentation,
}: {
  presentation: RoughCutPlanPresentation
}) {
  const plan = presentation.plan
  const summary = presentation.summary

  if (!plan || !summary) {
    return null
  }

  return (
    <>
      <div className="rough-cut-plan-summary">
        <span>
          <strong>{formatDuration(summary.estimatedTimeSaved)}</strong>
          возможная экономия
        </span>
        <span>
          <strong>{summary.suggestionCount}</strong>
          предложений
        </span>
        <span>
          <strong>{Math.round(summary.averageConfidence * 100)}%</strong>
          средняя уверенность
        </span>
        <span data-warning={summary.warningCount > 0 || undefined}>
          <strong>{summary.warningCount}</strong>
          требуют внимания
        </span>
      </div>
      <p className="rough-cut-plan-progress">
        Одобрено: {plan.approvedCount}. Отклонено: {plan.rejectedCount}. На проверке: {plan.pendingCount}.
        {' '}Самая длинная пауза: {formatDuration(summary.longestPause)}.
        {' '}Средняя пауза: {formatDuration(summary.averagePauseDuration)}.
        {' '}Приоритет: наивысший — {summary.byPriority.highest}, высокий — {summary.byPriority.high}, низкий — {summary.byPriority.low}.
      </p>
    </>
  )
}

function RoughCutPlanItemRow({
  presentation,
  isActive,
  onActivate,
  onStatusChange,
}: {
  presentation: RoughCutPlanItemPresentation
  isActive: boolean
  onActivate: (item: RoughCutPlanItemPresentation) => void
  onStatusChange: (
    itemId: string,
    status: RoughCutPlanItemReviewStatus,
  ) => void
}) {
  const item = presentation.item
  const isAvailable = presentation.seekTarget.availability === 'timeline'
  const isExecuted = item.executionStatus !== 'not-applied'

  return (
    <article
      className="rough-cut-plan-item"
      data-plan-item-id={item.id}
      data-review-status={item.reviewStatus}
      data-priority={item.priority}
      data-active={isActive || undefined}
      data-execution-status={item.executionStatus}
    >
      <button
        type="button"
        className="rough-cut-plan-seek"
        disabled={!isAvailable}
        onClick={() => onActivate(presentation)}
        aria-label={`${presentation.reasonLabel}, ${formatDuration(item.sourceStart)} - ${formatDuration(item.sourceEnd)}`}
      >
        <span className="rough-cut-plan-item-title">
          <strong>{presentation.reasonLabel}</strong>
          <small>
            {formatDuration(item.sourceStart)} - {formatDuration(item.sourceEnd)}
            {' · '}{formatDuration(item.duration)}
          </small>
        </span>
        <span className="rough-cut-plan-item-meta">
          {presentation.priorityLabel} · {presentation.confidencePercent}%
        </span>
        <span className="rough-cut-plan-item-explanation">
          {presentation.explanation}
        </span>
        {!isAvailable ? (
          <span className="rough-cut-plan-item-unavailable">
            Этот фрагмент отсутствует в текущем монтаже
          </span>
        ) : null}
      </button>
      <div
        className="rough-cut-plan-review-control"
        role="group"
        aria-label={`Решение: ${presentation.reasonLabel}`}
      >
        {reviewActions.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={isExecuted}
            data-status={action.status}
            data-selected={item.reviewStatus === action.status}
            onClick={() => onStatusChange(item.id, action.status)}
            aria-label={action.label}
            title={action.label}
          >
            <span aria-hidden="true">{action.symbol}</span>
          </button>
        ))}
      </div>
      <span className="rough-cut-plan-review-label">
        {item.executionStatus === 'applied'
          ? 'Применено'
          : item.executionStatus === 'skipped'
            ? 'Пропущено: фрагмент недоступен'
            : presentation.reviewStatusLabel}
      </span>
    </article>
  )
}

function RoughCutApplyControl({
  execution,
  isConfirming,
  isApplying,
  error,
  onConfirmRequest,
  onCancel,
  onApply,
}: {
  execution: RoughCutExecutionPresentation
  isConfirming: boolean
  isApplying: boolean
  error: string | null
  onConfirmRequest: () => void
  onCancel: () => void
  onApply: () => void
}) {
  if (execution.appliedAt) {
    return (
      <div className="rough-cut-apply-result" role="status">
        <strong>Черновой монтаж применён</strong>
        <span>
          Удалено: {formatDuration(execution.actualRemovedDuration)}.
          {' '}Применено: {execution.appliedCount}.
          {' '}Пропущено: {execution.skippedCount}.
        </span>
        <small>Одно действие «Отменить» вернёт таймлайн и решения плана.</small>
      </div>
    )
  }

  return (
    <div className="rough-cut-apply">
      {isConfirming ? (
        <div
          className="rough-cut-apply-confirmation"
          role="group"
          aria-label="Подтверждение чернового монтажа"
        >
          <strong>Подтвердите изменения</strong>
          <span>
            К удалению: {execution.availableCount} из {execution.approvedCount}.
            {' '}Примерно {formatDuration(execution.estimatedRemovedDuration)}.
          </span>
          <span>
            Недоступно: {execution.unavailableCount}.
            {' '}Предупреждений: {execution.warningCount}.
          </span>
          <div>
            <button
              type="button"
              className="primary-button compact-button"
              disabled={isApplying}
              onClick={onApply}
            >
              {isApplying ? 'Применение…' : 'Подтвердить'}
            </button>
            <button
              type="button"
              className="ghost-button compact-button"
              disabled={isApplying}
              onClick={onCancel}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="primary-button rough-cut-apply-button"
          disabled={!execution.canApply || isApplying}
          onClick={onConfirmRequest}
        >
          Применить черновой монтаж
        </button>
      )}
      {!execution.canApply && execution.disabledReason ? (
        <p className="rough-cut-apply-message">
          {execution.disabledReason}
        </p>
      ) : null}
      {error ? (
        <p className="rough-cut-apply-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
