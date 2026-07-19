import type { ThemePreference } from '../../types'

type AppHeaderProps = {
  themePreference: ThemePreference
  isBackendConnected: boolean
  onThemeChange: (theme: ThemePreference) => void
  onAssistantOpen: () => void
}

const themeLabels: Record<ThemePreference, string> = {
  light: 'Светлая',
  dark: 'Тёмная',
  system: 'Системная',
}

export function AppHeader({
  themePreference,
  isBackendConnected,
  onThemeChange,
  onAssistantOpen,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div>
        <p className="app-eyebrow">Персональный AI-монтажёр</p>
        <h1>AI Video Director</h1>
      </div>

      <div className="header-actions">
        <div
          className="backend-status"
          data-connected={isBackendConnected}
          aria-live="polite"
        >
          <span aria-hidden="true">{isBackendConnected ? '🟢' : '🔴'}</span>
          <span>
            {isBackendConnected ? 'Backend Connected' : 'Backend Offline'}
          </span>
        </div>
        <div className="theme-switcher" aria-label="Переключатель темы">
          {(['light', 'dark', 'system'] as ThemePreference[]).map((theme) => (
            <button
              key={theme}
              type="button"
              className="theme-button"
              data-active={themePreference === theme}
              aria-label={`Включить режим оформления: ${themeLabels[theme]}`}
              aria-pressed={themePreference === theme}
              onClick={() => onThemeChange(theme)}
            >
              {themeLabels[theme]}
            </button>
          ))}
        </div>
        <button
          className="secondary-button icon-button-text"
          type="button"
          onClick={onAssistantOpen}
          aria-label="Открыть AI-помощник"
        >
          <SparkIcon />
          <span>AI-помощник</span>
        </button>
      </div>
    </header>
  )
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="button-icon">
      <path
        d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3z"
        fill="currentColor"
      />
    </svg>
  )
}
