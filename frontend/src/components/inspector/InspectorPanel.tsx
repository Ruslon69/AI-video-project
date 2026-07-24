import type {
  InspectorClipSelection,
  InspectorProperty,
  InspectorPropertySection,
} from '../../selectors/inspectorSelectors'

type InspectorPanelProps = {
  selection: InspectorClipSelection | null
}

// Renders a selector-owned property model so future controls can replace rows without changing selection resolution.
export function InspectorPanel({ selection }: InspectorPanelProps) {
  return (
    <aside className="panel inspector-panel" aria-label="Inspector">
      <header className="inspector-head">
        <p className="section-label">Inspector</p>
        <h2>{selection?.title ?? 'Nothing selected'}</h2>
        <p className="inspector-subtitle">
          {selection ? 'Clip properties' : 'Timeline selection details appear here.'}
        </p>
      </header>
      {selection ? (
        <div className="inspector-sections">
          {selection.sections.map((section) => (
            <InspectorPropertyGroup key={section.id} section={section} />
          ))}
        </div>
      ) : (
        <div className="inspector-empty-state">
          <p>Select a clip in the timeline.</p>
        </div>
      )}
    </aside>
  )
}

function InspectorPropertyGroup({
  section,
}: {
  section: InspectorPropertySection
}) {
  return (
    <details className="inspector-section" open>
      <summary>{section.title}</summary>
      {section.properties.length ? (
        <dl className="inspector-property-list">
          {section.properties.map((property) => (
            <InspectorPropertyRow key={property.id} property={property} />
          ))}
        </dl>
      ) : (
        <p className="inspector-section-empty">{section.emptyState}</p>
      )}
    </details>
  )
}

function InspectorPropertyRow({ property }: { property: InspectorProperty }) {
  return (
    <div className="inspector-property-row">
      <dt>{property.label}</dt>
      <dd title={property.value}>{property.value}</dd>
    </div>
  )
}
