import type { EditingStage } from '../../types'
import { HelpEntry } from '../help/HelpEntry'
import { helpContent } from '../../data/helpContent'
import { statusLabels } from '../../utils/projectState'

type EditingStageListProps = {
  stages: EditingStage[]
  selectedStageId: string
  selectedSubstageId: string
  expandedStageIds: string[]
  openHelpId: string | null
  onStageSelect: (stageId: string, substageId?: string) => void
  onStageToggle: (stageId: string) => void
  onHelpOpenChange: (helpId: string, isOpen: boolean) => void
}

export function EditingStageList({
  stages,
  selectedStageId,
  selectedSubstageId,
  expandedStageIds,
  openHelpId,
  onStageSelect,
  onStageToggle,
  onHelpOpenChange,
}: EditingStageListProps) {
  return (
    <ol className="stage-list" aria-label="Этапы монтажа">
      {stages.map((stage, index) => {
        const isExpanded = expandedStageIds.includes(stage.id)
        const approvedCount = stage.substages.filter(
          (substage) => substage.status === 'approved',
        ).length

        return (
          <li key={stage.id} className="stage-group">
            <div
              className="stage-item"
              data-selected={stage.id === selectedStageId}
              data-status={stage.status}
            >
              <button
                type="button"
                className="stage-main"
                onClick={() => onStageSelect(stage.id)}
                aria-current={stage.id === selectedStageId ? 'step' : undefined}
              >
                <span className="stage-number">{index + 1}</span>
                <span className="stage-copy">
                  <span className="stage-title-row">
                    <span className="stage-title">{stage.title}</span>
                    <HelpEntry
                      content={helpContent[stage.id]}
                      isOpen={openHelpId === stage.id}
                      onOpenChange={(isOpen) =>
                        onHelpOpenChange(stage.id, isOpen)
                      }
                    />
                  </span>
                  <span className={`stage-status stage-status-${stage.status}`}>
                    {statusLabels[stage.status]}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="stage-toggle"
                onClick={() => onStageToggle(stage.id)}
                aria-label={`${isExpanded ? 'Скрыть' : 'Показать'} подэтапы: ${stage.title}`}
                aria-expanded={isExpanded}
              >
                <ChevronIcon expanded={isExpanded} />
              </button>
            </div>

            <div className="substage-shell" data-open={isExpanded}>
              <ol className="substage-list" aria-label={`Подэтапы: ${stage.title}`}>
                {stage.substages.map((substage) => (
                  <li key={substage.id}>
                    <button
                      type="button"
                      className="substage-item"
                      data-selected={substage.id === selectedSubstageId}
                      data-status={substage.status}
                      onClick={() => onStageSelect(stage.id, substage.id)}
                      aria-current={
                        substage.id === selectedSubstageId ? 'step' : undefined
                      }
                    >
                      <span className="substage-dot" aria-hidden="true" />
                      <span className="substage-title-row">
                        <span>{substage.title}</span>
                        <HelpEntry
                          content={helpContent[substage.id]}
                          isOpen={openHelpId === substage.id}
                          onOpenChange={(isOpen) =>
                            onHelpOpenChange(substage.id, isOpen)
                          }
                        />
                      </span>
                      <span className={`stage-status stage-status-${substage.status}`}>
                        {statusLabels[substage.status]}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <p className="substage-count">
                Принято {approvedCount} из {stage.substages.length}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="chevron-icon"
      data-expanded={expanded}
    >
      <path
        d="M6.5 8l3.5 3.5L13.5 8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}
