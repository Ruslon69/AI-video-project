import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type {
  AISuggestion,
  EditingStage,
  EditingSubstage,
  VersionRecord,
} from '../../types'
import {
  getAISuggestionTitle,
  getAcceptedSuggestionDuration,
} from '../../utils/aiSuggestions'
import { formatDuration } from '../../utils/mediaFormat'
import { getPreviousVersion, statusLabels } from '../../utils/projectState'

type ReviewPanelProps = {
  stage: EditingStage
  substage: EditingSubstage
  aiSuggestions: AISuggestion[]
  selectedAISuggestionIds: string[]
  activeAISuggestionId: string | null
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
  onAISuggestionActivate: (suggestionId: string) => void
  onAISuggestionSelectionToggle: (suggestionId: string) => void
  onAISuggestionsSelect: (suggestionIds: string[]) => void
  onAISuggestionAccept: (suggestionId: string) => void
  onAISuggestionReject: (suggestionId: string) => void
  onAISuggestionsAccept: (suggestionIds: string[]) => void
  onAISuggestionsReject: (suggestionIds: string[]) => void
}

// Owns review controls, version history actions, and AI suggestion approval workflow UI.
export function ReviewPanel({
  stage,
  substage,
  aiSuggestions,
  selectedAISuggestionIds,
  activeAISuggestionId,
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
  onAISuggestionActivate,
  onAISuggestionSelectionToggle,
  onAISuggestionsSelect,
  onAISuggestionAccept,
  onAISuggestionReject,
  onAISuggestionsAccept,
  onAISuggestionsReject,
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
          selectedSuggestionIds={selectedAISuggestionIds}
          activeSuggestionId={activeAISuggestionId}
          onActivate={onAISuggestionActivate}
          onToggleSelection={onAISuggestionSelectionToggle}
          onSelectSuggestions={onAISuggestionsSelect}
          onAccept={onAISuggestionAccept}
          onReject={onAISuggestionReject}
          onAcceptSelected={onAISuggestionsAccept}
          onRejectSelected={onAISuggestionsReject}
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
  selectedSuggestionIds,
  activeSuggestionId,
  onActivate,
  onToggleSelection,
  onSelectSuggestions,
  onAccept,
  onReject,
  onAcceptSelected,
  onRejectSelected,
}: {
  suggestions: AISuggestion[]
  selectedSuggestionIds: string[]
  activeSuggestionId: string | null
  onActivate: (suggestionId: string) => void
  onToggleSelection: (suggestionId: string) => void
  onSelectSuggestions: (suggestionIds: string[]) => void
  onAccept: (suggestionId: string) => void
  onReject: (suggestionId: string) => void
  onAcceptSelected: (suggestionIds: string[]) => void
  onRejectSelected: (suggestionIds: string[]) => void
}) {
  const [statusFilter, setStatusFilter] = useState<AISuggestion['status'] | 'all'>('all')
  const filteredSuggestions = statusFilter === 'all'
    ? suggestions
    : suggestions.filter((suggestion) => suggestion.status === statusFilter)
  const selectedCount = selectedSuggestionIds.length
  const counts = getAISuggestionCounts(suggestions)
  const estimatedRemovedTime = getAcceptedSuggestionDuration(suggestions)
  const filterTabs: Array<{
    id: AISuggestion['status'] | 'all'
    label: string
    count: number
  }> = [
    { id: 'all', label: 'All', count: suggestions.length },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'accepted', label: 'Accepted', count: counts.accepted },
    { id: 'rejected', label: 'Rejected', count: counts.rejected },
  ]

  const activateAdjacentSuggestion = (direction: 1 | -1) => {
    if (!filteredSuggestions.length) {
      return
    }

    const activeIndex = filteredSuggestions.findIndex(
      (suggestion) => suggestion.id === activeSuggestionId,
    )
    const nextIndex = activeIndex === -1
      ? 0
      : (activeIndex + direction + filteredSuggestions.length) % filteredSuggestions.length

    onActivate(filteredSuggestions[nextIndex].id)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return
    }

    event.preventDefault()
    activateAdjacentSuggestion(event.key === 'ArrowDown' ? 1 : -1)
  }

  return (
    <section
      className="ai-suggestions-panel"
      aria-label="AI Suggestions"
      onKeyDown={handleKeyDown}
    >
      <div className="scene-summary-head">
        <p className="section-label">AI Suggestions</p>
        <strong>{suggestions.length}</strong>
      </div>
      <div className="ai-suggestion-tabs" role="tablist" aria-label="Filter AI Suggestions">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="ai-suggestion-tab"
            data-active={statusFilter === tab.id}
            aria-selected={statusFilter === tab.id}
            onClick={() => setStatusFilter(tab.id)}
          >
            {tab.label} <span>{tab.count}</span>
          </button>
        ))}
      </div>
      <dl className="ai-suggestion-summary">
        <div>
          <dt>Total Suggestions</dt>
          <dd>{suggestions.length}</dd>
        </div>
        <div>
          <dt>Pending</dt>
          <dd>{counts.pending}</dd>
        </div>
        <div>
          <dt>Accepted</dt>
          <dd>{counts.accepted}</dd>
        </div>
        <div>
          <dt>Rejected</dt>
          <dd>{counts.rejected}</dd>
        </div>
        <div>
          <dt>Estimated Removed Time</dt>
          <dd>{formatDuration(estimatedRemovedTime)}</dd>
        </div>
      </dl>
      <div className="ai-suggestion-legend" aria-label="AI suggestion status legend">
        <span><span className="ai-legend-swatch ai-legend-pending" />Pending</span>
        <span><span className="ai-legend-swatch ai-legend-accepted" />Accepted</span>
        <span><span className="ai-legend-swatch ai-legend-rejected" />Rejected</span>
      </div>
      <div className="ai-selection-toolbar">
        <button
          type="button"
          className="ghost-button"
          onClick={() => onSelectSuggestions(filteredSuggestions.map((suggestion) => suggestion.id))}
        >
          Select All
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={!selectedCount}
          onClick={() => onSelectSuggestions([])}
        >
          Clear Selection
        </button>
      </div>
      {selectedCount ? (
        <div className="ai-batch-actions" aria-label="Batch AI suggestion actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => onAcceptSelected(selectedSuggestionIds)}
          >
            Accept Selected
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => onRejectSelected(selectedSuggestionIds)}
          >
            Reject Selected
          </button>
        </div>
      ) : null}
      <div className="ai-suggestion-list">
        {filteredSuggestions.map((suggestion) => (
          <article
            key={suggestion.id}
            className="ai-suggestion-card"
            data-selected={selectedSuggestionIds.includes(suggestion.id)}
            data-active={suggestion.id === activeSuggestionId}
            data-status={suggestion.status}
          >
            <label className="ai-suggestion-checkbox">
              <input
                type="checkbox"
                checked={selectedSuggestionIds.includes(suggestion.id)}
                onChange={() => onToggleSelection(suggestion.id)}
              />
              <span className="visually-hidden">Select {getAISuggestionTitle(suggestion)}</span>
            </label>
            <button
              type="button"
              className="ai-suggestion-main"
              onClick={() => onActivate(suggestion.id)}
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
                onClick={() => {
                  onAccept(suggestion.id)
                  onActivate(suggestion.id)
                }}
              >
                Accept
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={suggestion.status !== 'pending'}
                onClick={() => {
                  onReject(suggestion.id)
                  onActivate(suggestion.id)
                }}
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

function getAISuggestionCounts(suggestions: AISuggestion[]) {
  return suggestions.reduce(
    (counts, suggestion) => ({
      ...counts,
      [suggestion.status]: counts[suggestion.status] + 1,
    }),
    {
      pending: 0,
      accepted: 0,
      rejected: 0,
    },
  )
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
