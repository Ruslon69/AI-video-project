import { useEffect, useRef, useState } from 'react'
import type {
  AISuggestion,
  EditingStage,
  EditingSubstage,
  VersionRecord,
} from '../../types'
import { formatDuration } from '../../utils/mediaFormat'
import { getPreviousVersion, statusLabels } from '../../utils/projectState'

type ReviewPanelProps = {
  stage: EditingStage
  substage: EditingSubstage
  aiSuggestions: AISuggestion[]
  selectedAISuggestionId: string | null
  onAccept: () => void
  onCommentChange: (comment: string) => void
  onCreateReview: () => void
  onRequestChanges: () => void
  onRestoreVersion: (versionId: string) => void
  onViewVersion: (versionId: string) => void
  onRenameVersion: (versionId: string, description: string) => void
  onDuplicateVersion: (versionId: string) => void
  onDeleteVersion: (versionId: string) => void
  onKeepOnlyVersion: (versionId: string) => void
  onAISuggestionSelect: (suggestionId: string) => void
  onAISuggestionAccept: (suggestionId: string) => void
  onAISuggestionReject: (suggestionId: string) => void
}

export function ReviewPanel({
  stage,
  substage,
  aiSuggestions,
  selectedAISuggestionId,
  onAccept,
  onCommentChange,
  onCreateReview,
  onRequestChanges,
  onRestoreVersion,
  onViewVersion,
  onRenameVersion,
  onDuplicateVersion,
  onDeleteVersion,
  onKeepOnlyVersion,
  onAISuggestionSelect,
  onAISuggestionAccept,
  onAISuggestionReject,
}: ReviewPanelProps) {
  const isBlocked = substage.status === 'blocked'
  const previousVersion = getPreviousVersion(substage)
  const currentVersionId =
    substage.selectedVersionId ??
    substage.versions[substage.versions.length - 1]?.id

  return (
    <aside className="panel review-panel" aria-label="Проверка подэтапа">
      <div className="review-panel-fixed-content">
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
            rows={5}
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

        <AISuggestionsPanel
          suggestions={aiSuggestions}
          selectedSuggestionId={selectedAISuggestionId}
          onSelect={onAISuggestionSelect}
          onAccept={onAISuggestionAccept}
          onReject={onAISuggestionReject}
        />

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
      </div>

      <section className="version-history-region" aria-label="История версий">
        <ol className="version-list">
          {substage.versions
            .slice()
            .reverse()
            .map((version) => (
              <VersionItem
                key={version.id}
                version={version}
                isSelected={version.id === currentVersionId}
                versionCount={substage.versions.length}
                onRestoreVersion={onRestoreVersion}
                onViewVersion={onViewVersion}
                onRenameVersion={onRenameVersion}
                onDuplicateVersion={onDuplicateVersion}
                onDeleteVersion={onDeleteVersion}
                onKeepOnlyVersion={onKeepOnlyVersion}
              />
            ))}
        </ol>
      </section>
    </aside>
  )
}

function AISuggestionsPanel({
  suggestions,
  selectedSuggestionId,
  onSelect,
  onAccept,
  onReject,
}: {
  suggestions: AISuggestion[]
  selectedSuggestionId: string | null
  onSelect: (suggestionId: string) => void
  onAccept: (suggestionId: string) => void
  onReject: (suggestionId: string) => void
}) {
  return (
    <section className="ai-suggestions-panel" aria-label="AI Suggestions">
      <div className="scene-summary-head">
        <p className="section-label">AI Suggestions</p>
        <strong>{suggestions.length}</strong>
      </div>
      <div className="ai-suggestion-list">
        {suggestions.map((suggestion) => (
          <article
            key={suggestion.id}
            className="ai-suggestion-card"
            data-selected={suggestion.id === selectedSuggestionId}
            data-status={suggestion.status}
          >
            <button
              type="button"
              className="ai-suggestion-main"
              onClick={() => onSelect(suggestion.id)}
            >
              <span>
                <strong>{getAISuggestionTitle(suggestion)}</strong>
                <span>{suggestion.reason}</span>
              </span>
              <span className={`ai-suggestion-status ai-suggestion-status-${suggestion.status}`}>
                {suggestion.status}
              </span>
            </button>
            <dl className="ai-suggestion-meta">
              <div>
                <dt>Time</dt>
                <dd>{formatDuration(suggestion.start)} - {formatDuration(suggestion.end)}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{Math.round(suggestion.confidence * 100)}%</dd>
              </div>
            </dl>
            <div className="ai-suggestion-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={suggestion.status !== 'pending'}
                onClick={() => onAccept(suggestion.id)}
              >
                Accept
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={suggestion.status !== 'pending'}
                onClick={() => onReject(suggestion.id)}
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function getAISuggestionTitle(suggestion: AISuggestion) {
  const labels: Record<AISuggestion['type'], string> = {
    cut: 'Cut',
    trim: 'Trim',
    silence: 'Silence',
  }

  return labels[suggestion.type]
}

function VersionItem({
  version,
  isSelected,
  versionCount,
  onRestoreVersion,
  onViewVersion,
  onRenameVersion,
  onDuplicateVersion,
  onDeleteVersion,
  onKeepOnlyVersion,
}: {
  version: VersionRecord
  isSelected: boolean
  versionCount: number
  onRestoreVersion: (versionId: string) => void
  onViewVersion: (versionId: string) => void
  onRenameVersion: (versionId: string, description: string) => void
  onDuplicateVersion: (versionId: string) => void
  onDeleteVersion: (versionId: string) => void
  onKeepOnlyVersion: (versionId: string) => void
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const createdAt = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(version.createdAt))
  const canDelete = versionCount > 1 && !isSelected
  const canKeepOnly = versionCount > 1

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  const closeMenu = () => setIsMenuOpen(false)

  const handleRename = () => {
    const description = window.prompt('Rename version', version.description)

    if (description !== null) {
      onRenameVersion(version.id, description)
    }

    closeMenu()
  }

  const handleDuplicate = () => {
    onDuplicateVersion(version.id)
    closeMenu()
  }

  const handleDelete = () => {
    if (!canDelete) {
      return
    }

    if (window.confirm('Delete this version?')) {
      onDeleteVersion(version.id)
    }

    closeMenu()
  }

  const handleKeepOnly = () => {
    if (!canKeepOnly) {
      return
    }

    if (window.confirm('Delete all other versions of this sub-stage?')) {
      onKeepOnlyVersion(version.id)
    }

    closeMenu()
  }

  return (
    <li className="version-item" data-selected={isSelected}>
      <div>
        <div className="version-title-row">
          <strong>Версия {version.version}</strong>
          {isSelected ? <span className="version-current-badge">Текущая</span> : null}
        </div>
        <span>{createdAt}</span>
        <span>{version.userName ? `Автор: ${version.userName}` : 'Автор: не указан'}</span>
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
        <div className="version-menu" ref={menuRef}>
          <button
            type="button"
            className="ghost-button icon-menu-button"
            aria-label={`Действия для версии ${version.version}`}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
          >
            ⋯
          </button>
          {isMenuOpen ? (
            <div className="version-menu-popover" role="menu">
              <button type="button" role="menuitem" onClick={handleRename}>
                Rename
              </button>
              <button type="button" role="menuitem" onClick={handleDuplicate}>
                Duplicate
              </button>
              {versionCount > 1 ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canDelete}
                    title={
                      isSelected
                        ? 'The current version cannot be deleted.'
                        : undefined
                    }
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                  {!canDelete ? (
                    <span className="version-menu-note">
                      The current version cannot be deleted.
                    </span>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canKeepOnly}
                    onClick={handleKeepOnly}
                  >
                    Keep only this version
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}
