import { initialProjectState } from '../data/stages'
import type {
  EditingStage,
  EditingSubstage,
  ProjectState,
  ProjectStats,
  StageStatus,
  VersionRecord,
} from '../types'

const terminalUnlockedStatuses: StageStatus[] = [
  'ready',
  'in_progress',
  'review',
  'approved',
  'revision',
]

export const statusLabels: Record<StageStatus, string> = {
  blocked: 'Заблокировано',
  ready: 'Готово к работе',
  in_progress: 'В работе',
  review: 'Ожидает проверки',
  approved: 'Принято',
  revision: 'На доработке',
}

export function isUnlocked(status: StageStatus) {
  return terminalUnlockedStatuses.includes(status)
}

export function getSelectedStage(state: ProjectState) {
  return (
    state.stages.find((stage) => stage.id === state.selectedStageId) ??
    state.stages[0]
  )
}

export function getSelectedSubstage(state: ProjectState) {
  const selectedStage = getSelectedStage(state)
  return (
    selectedStage.substages.find(
      (substage) => substage.id === state.selectedSubstageId,
    ) ?? selectedStage.substages[0]
  )
}

export function getProjectStats(stages: EditingStage[]): ProjectStats {
  const totalStages = stages.length
  const approvedStages = stages.filter((stage) => stage.status === 'approved').length
  const substages = stages.flatMap((stage) => stage.substages)
  const totalSubstages = substages.length
  const approvedSubstages = substages.filter(
    (substage) => substage.status === 'approved',
  ).length

  return {
    totalStages,
    approvedStages,
    totalSubstages,
    approvedSubstages,
    progress:
      totalSubstages === 0
        ? 0
        : Math.round((approvedSubstages / totalSubstages) * 100),
  }
}

export function createVersion(
  substage: EditingSubstage,
  status: StageStatus,
  description: string,
  comment = substage.comment,
): VersionRecord {
  return {
    id: `${substage.id}-v${substage.versions.length + 1}-${Date.now()}`,
    version: substage.versions.length + 1,
    createdAt: new Date().toISOString(),
    description,
    status,
    comment,
    userName: undefined,
    pinned: false,
    tags: [],
  }
}

export function renameSelectedSubstageVersion(
  state: ProjectState,
  versionId: string,
  description: string,
) {
  const nextDescription = description.trim()

  if (!nextDescription) {
    return state
  }

  return updateSelectedSubstage(state, (substage) => ({
    ...substage,
    versions: substage.versions.map((version) =>
      version.id === versionId
        ? { ...version, description: nextDescription }
        : version,
    ),
  }))
}

export function duplicateSelectedSubstageVersion(
  state: ProjectState,
  versionId: string,
) {
  return updateSelectedSubstage(state, (substage) => {
    const version = substage.versions.find((item) => item.id === versionId)

    if (!version) {
      return substage
    }

    const duplicate: VersionRecord = {
      ...version,
      id: `${substage.id}-v${substage.versions.length + 1}-${Date.now()}`,
      version: substage.versions.length + 1,
      createdAt: new Date().toISOString(),
      description: `${version.description} copy`,
    }

    return {
      ...substage,
      versions: [...substage.versions, duplicate],
    }
  })
}

export function deleteSelectedSubstageVersion(
  state: ProjectState,
  versionId: string,
) {
  return updateSelectedSubstage(state, (substage) => {
    if (
      substage.versions.length <= 1 ||
      substage.selectedVersionId === versionId
    ) {
      return substage
    }

    return {
      ...substage,
      versions: substage.versions.filter((version) => version.id !== versionId),
    }
  })
}

export function keepOnlySelectedSubstageVersion(
  state: ProjectState,
  versionId: string,
) {
  return updateSelectedSubstage(state, (substage) => {
    const version = substage.versions.find((item) => item.id === versionId)

    if (!version) {
      return substage
    }

    return {
      ...substage,
      comment: version.comment,
      status: version.status,
      selectedVersionId: version.id,
      versions: [version],
    }
  })
}

function normalizeStageStatus(substages: EditingSubstage[]): StageStatus {
  if (substages.every((substage) => substage.status === 'approved')) {
    return 'approved'
  }

  if (substages.some((substage) => substage.status === 'revision')) {
    return 'revision'
  }

  if (substages.some((substage) => substage.status === 'review')) {
    return 'review'
  }

  if (substages.some((substage) => substage.status === 'in_progress')) {
    return 'in_progress'
  }

  if (substages.some((substage) => substage.status === 'ready')) {
    return 'ready'
  }

  return 'blocked'
}

function unlockNextSubstage(substages: EditingSubstage[]) {
  const firstBlockedIndex = substages.findIndex(
    (substage) => substage.status === 'blocked',
  )

  if (firstBlockedIndex === -1) {
    return substages
  }

  return substages.map((substage, index): EditingSubstage =>
    index === firstBlockedIndex ? { ...substage, status: 'ready' } : substage,
  )
}

function unlockNextStage(stages: EditingStage[], approvedStageIndex: number) {
  return stages.map((stage, index): EditingStage => {
    if (index !== approvedStageIndex + 1 || stage.status !== 'blocked') {
      return stage
    }

    const substages = stage.substages.map((substage, substageIndex): EditingSubstage =>
      substageIndex === 0 ? { ...substage, status: 'ready' } : substage,
    )

    return { ...stage, status: 'ready', substages }
  })
}

export function updateSelectedSubstage(
  state: ProjectState,
  updater: (substage: EditingSubstage) => EditingSubstage,
): ProjectState {
  const stageIndex = state.stages.findIndex(
    (stage) => stage.id === state.selectedStageId,
  )

  if (stageIndex === -1) {
    return state
  }

  const stages = state.stages.map((stage, index) => {
    if (index !== stageIndex) {
      return stage
    }

    const changedSubstages = stage.substages.map((substage) =>
      substage.id === state.selectedSubstageId ? updater(substage) : substage,
    )
    const maybeUnlocked = unlockNextSubstage(changedSubstages)

    return {
      ...stage,
      substages: maybeUnlocked,
      status: normalizeStageStatus(maybeUnlocked),
    }
  })

  const selectedStage = stages[stageIndex]
  const nextStages =
    selectedStage.status === 'approved'
      ? unlockNextStage(stages, stageIndex)
      : stages

  return { ...state, stages: nextStages }
}

export function setSelectedSubstageStatus(
  state: ProjectState,
  status: StageStatus,
  description: string,
) {
  return updateSelectedSubstage(state, (substage) => {
    if (substage.status === 'blocked') {
      return substage
    }

    const version = createVersion(substage, status, description)

    return {
      ...substage,
      status,
      selectedVersionId: version.id,
      versions: [...substage.versions, version],
    }
  })
}

export function updateSelectedSubstageComment(
  state: ProjectState,
  comment: string,
) {
  return updateSelectedSubstage(state, (substage) => ({ ...substage, comment }))
}

export function createReviewVersion(state: ProjectState) {
  return updateSelectedSubstage(state, (substage) => {
    if (substage.status === 'blocked') {
      return substage
    }

    const version = createVersion(
      substage,
      'review',
      'Создана новая проверка с текущим комментарием',
    )

    return {
      ...substage,
      status: 'review',
      selectedVersionId: version.id,
      versions: [...substage.versions, version],
    }
  })
}

export function restoreSelectedSubstageVersion(
  state: ProjectState,
  versionId: string,
) {
  return updateSelectedSubstage(state, (substage) => {
    const version = substage.versions.find((item) => item.id === versionId)

    if (!version) {
      return substage
    }

    return {
      ...substage,
      comment: version.comment,
      status: version.status,
      selectedVersionId: version.id,
    }
  })
}

export function getPreviousVersion(substage: EditingSubstage) {
  const currentIndex = substage.versions.findIndex(
    (version) => version.id === substage.selectedVersionId,
  )

  if (currentIndex <= 0) {
    return null
  }

  return substage.versions[currentIndex - 1]
}

export function ensureProjectState(value: unknown): ProjectState {
  if (!value || typeof value !== 'object') {
    return initialProjectState
  }

  const candidate = value as Partial<ProjectState>
  const hasValidStages =
    Array.isArray(candidate.stages) &&
    candidate.stages.length === initialProjectState.stages.length

  if (!hasValidStages || !candidate.selectedStageId || !candidate.selectedSubstageId) {
    return initialProjectState
  }

  return {
    stages: candidate.stages as EditingStage[],
    selectedStageId: candidate.selectedStageId,
    selectedSubstageId: candidate.selectedSubstageId,
    expandedStageIds: Array.isArray(candidate.expandedStageIds)
      ? candidate.expandedStageIds
      : initialProjectState.expandedStageIds,
  }
}
