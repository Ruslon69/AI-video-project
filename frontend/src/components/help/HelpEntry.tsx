import type { HelpContent } from '../../data/helpContent'
import { InfoButton } from './InfoButton'

type HelpEntryProps = {
  content: HelpContent
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function HelpEntry({
  content,
  isOpen,
  onOpenChange,
}: HelpEntryProps) {
  return (
    <span className="help-entry">
      <InfoButton
        label={`Показать справку: ${content.title}`}
        isExpanded={isOpen}
        onClick={(event) => {
          event.stopPropagation()
          onOpenChange(!isOpen)
        }}
      />
    </span>
  )
}
