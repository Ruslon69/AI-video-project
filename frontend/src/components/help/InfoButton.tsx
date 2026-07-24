type InfoButtonProps = {
  label: string
  isExpanded: boolean
  onActivate: () => void
}

export function InfoButton({
  label,
  isExpanded,
  onActivate,
}: InfoButtonProps) {
  return (
    <span
      role="button"
      tabIndex={0}
      className="info-button"
      aria-label={label}
      aria-expanded={isExpanded}
      onClick={(event) => {
        event.stopPropagation()
        onActivate()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        onActivate()
      }}
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
    </span>
  )
}
