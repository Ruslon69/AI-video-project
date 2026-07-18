import type { EditingStage, EditingSubstage, VersionRecord } from '../../types'
import { getPreviousVersion, statusLabels } from '../../utils/projectState'

type ReviewPanelProps = {
  stage: EditingStage
  substage: EditingSubstage
  onAccept: () => void
  onCommentChange: (comment: string) => void
  onCreateReview: () => void
  onRequestChanges: () => void
  onRestoreVersion: (versionId: string) => void
  onViewVersion: (versionId: string) => void
}

export function ReviewPanel({
  stage,
  substage,
  onAccept,
  onCommentChange,
  onCreateReview,
  onRequestChanges,
  onRestoreVersion,
  onViewVersion,
}: ReviewPanelProps) {
  const isBlocked = substage.status === 'blocked'
  const previousVersion = getPreviousVersion(substage)

  return (
    <aside className="panel review-panel" aria-label="Проверка подэтапа">
      <div className="review-head">
        <p className="section-label">Выбранный подэтап</p>
        <h2>{substage.title}</h2>
        <p className="review-description">{stage.title} · {stage.description}</p>
        <div className={`current-status current-status-${substage.status}`}>
          <span aria-hidden="true" />
          {statusLabels[substage.status]}
        </div>
      </div>

      <div className="comment-field">
        <label htmlFor="revision-comment">Комментарий проверки</label>
        <textarea
          id="revision-comment"
          value={substage.comment}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="Например: усилить начало, убрать паузу на 12 секунде"
          rows={7}
        />
      </div>

      <div className="review-actions">
        <button
          className="primary-button"
          type="button"
          disabled={isBlocked}
          onClick={onAccept}
        >
          Принять подэтап
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={isBlocked}
          onClick={onRequestChanges}
        >
          Отправить на доработку
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={isBlocked}
          onClick={onCreateReview}
        >
          Создать новую проверку
        </button>
      </div>

      <section className="version-history" aria-label="История версий">
        <div className="history-head">
          <div>
            <p className="section-label">История версий</p>
            <h3>{substage.versions.length} записей</h3>
          </div>
          <button
            className="secondary-button compact-button"
            type="button"
            disabled={!previousVersion}
            onClick={() => previousVersion && onRestoreVersion(previousVersion.id)}
          >
            Вернуться к предыдущей версии
          </button>
        </div>
        <ol className="version-list">
          {substage.versions
            .slice()
            .reverse()
            .map((version) => (
              <VersionItem
                key={version.id}
                version={version}
                isSelected={version.id === substage.selectedVersionId}
                onRestoreVersion={onRestoreVersion}
                onViewVersion={onViewVersion}
              />
            ))}
        </ol>
      </section>
    </aside>
  )
}

function VersionItem({
  version,
  isSelected,
  onRestoreVersion,
  onViewVersion,
}: {
  version: VersionRecord
  isSelected: boolean
  onRestoreVersion: (versionId: string) => void
  onViewVersion: (versionId: string) => void
}) {
  const createdAt = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(version.createdAt))

  return (
    <li className="version-item" data-selected={isSelected}>
      <div>
        <strong>Версия {version.version}</strong>
        <span>{createdAt}</span>
        <p>{version.description}</p>
        <span className={`stage-status stage-status-${version.status}`}>
          {statusLabels[version.status]}
        </span>
      </div>
      <div className="version-actions">
        <button
          type="button"
          className="ghost-button"
          onClick={() => onViewVersion(version.id)}
        >
          Просмотреть
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => onRestoreVersion(version.id)}
        >
          Восстановить
        </button>
      </div>
    </li>
  )
}
