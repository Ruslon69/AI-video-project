import type { MouseEvent } from 'react'

type InfoButtonProps = {
  label: string
  isExpanded: boolean
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
}

export function InfoButton({
  label,
  isExpanded,
  onClick,
}: InfoButtonProps) {
  return (
    <button
      type="button"
      className="info-button"
      aria-label={label}
      aria-expanded={isExpanded}
      onClick={onClick}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="info-button-icon">
        <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 9.1v4.3M10 6.4h.01"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    </button>
  )
}
