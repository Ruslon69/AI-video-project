import { useEffect, useRef } from 'react'
import type { HelpContent } from '../../data/helpContent'

type HelpPanelProps = {
  content: HelpContent | null
  onClose: () => void
  onExplainMore: (helpTitle: string) => void
}

const helpSections = [
  ['does', 'Что делает этап?'],
  ['check', 'Что проверить?'],
  ['next', 'Что будет дальше?'],
] as const

export function HelpPanel({
  content,
  onClose,
  onExplainMore,
}: HelpPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!content) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      const targetElement = event.target as Element | null

      if (
        panelRef.current?.contains(target) ||
        targetElement?.closest('.help-entry')
      ) {
        return
      }

      onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [content, onClose])

  return (
    <aside
      ref={panelRef}
      className={`help-panel${content ? ' help-panel-open' : ''}`}
      aria-label={content ? `Помощь: ${content.title}` : 'Помощь'}
      aria-hidden={!content}
    >
      {content ? (
        <>
          <div className="help-panel-head">
            <div>
              <p className="section-label">Помощь</p>
              <h2>{content.title}</h2>
            </div>
            <button
              type="button"
              className="help-close-button"
              onClick={onClose}
              aria-label="Закрыть панель помощи"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="help-section-list">
            {helpSections.map(([key, title]) => (
              <section key={key} className="help-section">
                <span className="help-section-icon" aria-hidden="true">
                  <SectionIcon />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{content[key]}</p>
                </div>
              </section>
            ))}
          </div>

          <button
            type="button"
            className="secondary-button help-explain-button"
            onClick={() => onExplainMore(content.title)}
          >
            Объяснить подробнее
          </button>
        </>
      ) : null}
    </aside>
  )
}

function SectionIcon() {
  return (
    <svg viewBox="0 0 20 20" className="help-section-svg">
      <path
        d="M4 10.2l3.2 3.1L16 5.8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="button-icon">
      <path
        d="M5 5l10 10M15 5L5 15"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}
