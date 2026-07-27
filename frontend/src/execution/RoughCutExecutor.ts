import type { ProjectAnalysis, ProjectAnalysisState } from '../analysis/models'
import type {
  EditOperation,
  EditOperationGroup,
  SplitOperation,
} from '../models/EditOperation'
import type { Project } from '../models/Project'
import { sourceTime, timelineTime } from '../models/Time'
import { createRippleDeleteOperation } from '../operations/RippleDeleteOperation'
import {
  RIPPLE_TIME_TOLERANCE_SECONDS,
  normalizeRippleTimelineTime,
} from '../operations/RippleDeleteOperation'
import { createSplitOperation } from '../operations/SplitOperation'
import {
  isRoughCutPlanForAnalysis,
  roughCutPlannerRules,
} from '../planner/RoughCutPlanner'
import type {
  RoughCutPlan,
  RoughCutPlanItem,
} from '../planner/models'
import {
  buildEditProjection,
  type ComputedClip,
  type EditProjection,
} from '../selectors/editProjection'
import { getRippleDeleteValidation } from '../selectors/rippleDeleteSelectors'
import { sourceToTimeline, timelineToSource } from '../selectors/timeMapping'
import { getPrimaryProjectMediaBinding } from '../state/ProjectMedia'

export type RoughCutExecutionRejectionReason =
  | 'missing-plan'
  | 'missing-analysis'
  | 'stale-analysis'
  | 'primary-asset-mismatch'
  | 'source-unavailable'
  | 'already-applied'
  | 'no-approved-items'
  | 'invalid-approved-item'
  | 'locked-or-hidden-track'
  | 'ambiguous-mapping'
  | 'no-available-items'
  | 'operation-build-failed'

type ResolvedRemovalSegment = Readonly<{
  trackId: string
  timelineItemId: string
  sourceStart: number
  sourceEnd: number
  timelineStart: number
  timelineEnd: number
  itemIds: string[]
}>

export type RoughCutExecutionPreview = Readonly<{
  valid: boolean
  reason: RoughCutExecutionRejectionReason | null
  approvedCount: number
  availableCount: number
  unavailableCount: number
  estimatedRemovedDuration: number
  warningCount: number
  appliedItemIds: string[]
  skippedItemIds: string[]
  removalRanges: ReadonlyArray<{
    start: number
    end: number
  }>
}>

export type RoughCutExecutionResult =
  | {
      valid: true
      operationGroup: EditOperationGroup
      planAfter: RoughCutPlan
      selectionAfterTimelineItemId: string | null
      playheadAfter: number
      actualRemovedDuration: number
    }
  | {
      valid: false
      reason: RoughCutExecutionRejectionReason
    }

type RoughCutExecutionOptions = Readonly<{
  sourceAvailable: boolean
  selectionBeforeTimelineItemId: string | null
  playheadBefore: number
  createdAt: string
  actionId: string
  createId: (prefix: string) => string
}>

export function getRoughCutExecutionPreview(
  project: Project,
  analysisState: ProjectAnalysisState,
  projection: EditProjection,
  sourceAvailable: boolean,
): RoughCutExecutionPreview {
  const preparation = prepareExecution(
    project,
    analysisState,
    projection,
    sourceAvailable,
  )

  return preparation.valid
    ? {
        valid: true,
        reason: null,
        approvedCount: preparation.approvedItems.length,
        availableCount: preparation.appliedItemIds.length,
        unavailableCount: preparation.skippedItemIds.length,
        estimatedRemovedDuration: getRangesDuration(
          preparation.removalRanges,
        ),
        warningCount: preparation.warningCount,
        appliedItemIds: preparation.appliedItemIds,
        skippedItemIds: preparation.skippedItemIds,
        removalRanges: preparation.removalRanges,
      }
    : {
        valid: false,
        reason: preparation.reason,
        approvedCount: preparation.approvedCount,
        availableCount: 0,
        unavailableCount: preparation.unavailableCount,
        estimatedRemovedDuration: 0,
        warningCount: preparation.warningCount,
        appliedItemIds: [],
        skippedItemIds: preparation.skippedItemIds,
        removalRanges: [],
      }
}

export function createRoughCutExecution(
  project: Project,
  analysisState: ProjectAnalysisState,
  options: RoughCutExecutionOptions,
): RoughCutExecutionResult {
  const projection = buildEditProjection(project)
  const preparation = prepareExecution(
    project,
    analysisState,
    projection,
    options.sourceAvailable,
  )

  if (!preparation.valid) {
    return {
      valid: false,
      reason: preparation.reason,
    }
  }

  let workingProject = project
  const operations: EditOperation[] = []
  let actualRemovedDuration = 0
  const removalSegments = [...preparation.removalSegments].sort(
    (left, right) =>
      right.timelineStart - left.timelineStart ||
      right.timelineEnd - left.timelineEnd ||
      left.timelineItemId.localeCompare(right.timelineItemId),
  )

  for (const segment of removalSegments) {
    const result = createRemovalOperations(
      workingProject,
      segment,
      options,
    )

    if (!result.valid) {
      return {
        valid: false,
        reason: 'operation-build-failed',
      }
    }

    operations.push(...result.operations)
    actualRemovedDuration += result.removedDuration
    workingProject = {
      ...workingProject,
      operations: [
        ...workingProject.operations,
        ...result.operations,
      ],
    }
  }

  const normalizedRemovedDuration = normalizeRippleTimelineTime(
    actualRemovedDuration,
  )
  const playheadAfter = remapPlayheadAcrossRanges(
    options.playheadBefore,
    preparation.removalRanges,
  )
  const finalProjection = buildEditProjection(workingProject)
  const selectionAfterTimelineItemId = getSelectionAfterExecution(
    finalProjection,
    options.selectionBeforeTimelineItemId,
    playheadAfter,
  )
  const planAfter = getExecutedPlan(
    preparation.plan,
    preparation.appliedItemIds,
    preparation.skippedItemIds,
    normalizedRemovedDuration,
    options.createdAt,
    options.actionId,
  )
  const operationGroup: EditOperationGroup = {
    actionId: options.actionId,
    operations,
    roughCutExecution: {
      executionVersion: 'rough-cut-executor-v1',
      planBefore: preparation.plan,
      planAfter,
      selectionBeforeTimelineItemId:
        options.selectionBeforeTimelineItemId,
      selectionAfterTimelineItemId,
      playheadBefore: normalizeTime(options.playheadBefore),
      playheadAfter,
    },
  }

  return {
    valid: true,
    operationGroup,
    planAfter,
    selectionAfterTimelineItemId,
    playheadAfter,
    actualRemovedDuration: normalizedRemovedDuration,
  }
}

type ExecutionPreparation =
  | {
      valid: true
      plan: RoughCutPlan
      approvedItems: RoughCutPlanItem[]
      removalSegments: ResolvedRemovalSegment[]
      removalRanges: Array<{ start: number; end: number }>
      appliedItemIds: string[]
      skippedItemIds: string[]
      warningCount: number
    }
  | {
      valid: false
      reason: RoughCutExecutionRejectionReason
      approvedCount: number
      unavailableCount: number
      warningCount: number
      skippedItemIds: string[]
    }

function prepareExecution(
  project: Project,
  analysisState: ProjectAnalysisState,
  projection: EditProjection,
  sourceAvailable: boolean,
): ExecutionPreparation {
  const plan = project.roughCutPlan
  const analysis = analysisState.status === 'completed'
    ? analysisState.result
    : null

  if (!plan) {
    return rejectPreparation('missing-plan')
  }

  if (!analysis) {
    return rejectPreparation('missing-analysis')
  }

  if (!isRoughCutPlanForAnalysis(plan, analysis)) {
    return rejectPreparation('stale-analysis')
  }

  const primaryAssetId =
    getPrimaryProjectMediaBinding(project)?.asset.id ?? null

  if (
    !primaryAssetId ||
    plan.primaryAssetId !== primaryAssetId ||
    analysis.sourceAssetId !== primaryAssetId
  ) {
    return rejectPreparation('primary-asset-mismatch')
  }

  if (!sourceAvailable) {
    return rejectPreparation('source-unavailable')
  }

  if (plan.execution?.status === 'applied') {
    return rejectPreparation('already-applied')
  }

  const approvedItems = plan.items.filter(
    (item) =>
      item.reviewStatus === 'approved' &&
      item.executionStatus === 'not-applied',
  )
  const warningCount = approvedItems.filter(
    (item) =>
      item.confidence <
      roughCutPlannerRules.confidenceWarningThreshold,
  ).length

  if (!approvedItems.length) {
    return rejectPreparation('no-approved-items', 0, 0, warningCount)
  }

  if (approvedItems.some((item) => !isValidPlanItem(item, analysis))) {
    return rejectPreparation(
      'invalid-approved-item',
      approvedItems.length,
      0,
      warningCount,
    )
  }

  const videoTrack = project.timeline.tracks.find(
    (track) => track.type === 'video',
  )

  if (
    !videoTrack ||
    videoTrack.locked ||
    !videoTrack.visible ||
    projection.clips.some(
      (clip) => clip.locked || !clip.visible,
    )
  ) {
    return rejectPreparation(
      'locked-or-hidden-track',
      approvedItems.length,
      0,
      warningCount,
    )
  }

  const sourceGroups = mergeApprovedSourceRanges(approvedItems)
  const removalSegments: ResolvedRemovalSegment[] = []
  const appliedItemIdSet = new Set<string>()
  const skippedItemIdSet = new Set<string>()

  for (const group of sourceGroups) {
    const resolution = resolveEarliestOccurrence(
      projection,
      group.start,
      group.end,
      group.itemIds,
    )

    if (resolution.status === 'ambiguous') {
      return rejectPreparation(
        'ambiguous-mapping',
        approvedItems.length,
        skippedItemIdSet.size,
        warningCount,
        [...skippedItemIdSet],
      )
    }

    if (resolution.status === 'unavailable') {
      for (const itemId of group.itemIds) {
        skippedItemIdSet.add(itemId)
      }
      continue
    }

    removalSegments.push(...resolution.segments)

    for (const item of approvedItems) {
      if (
        group.itemIds.includes(item.id) &&
        resolution.segments.some((segment) =>
          rangesOverlap(
            item.sourceStart,
            item.sourceEnd,
            segment.sourceStart,
            segment.sourceEnd,
          ),
        )
      ) {
        appliedItemIdSet.add(item.id)
      }
    }

    for (const itemId of group.itemIds) {
      if (!appliedItemIdSet.has(itemId)) {
        skippedItemIdSet.add(itemId)
      }
    }
  }

  const normalizedRemovalSegments =
    normalizeRemovalSegments(removalSegments)
  const removalRanges = normalizeTimelineRanges(
    normalizedRemovalSegments.map((segment) => ({
      start: segment.timelineStart,
      end: segment.timelineEnd,
    })),
  )

  if (!normalizedRemovalSegments.length || !appliedItemIdSet.size) {
    return rejectPreparation(
      'no-available-items',
      approvedItems.length,
      skippedItemIdSet.size,
      warningCount,
      [...skippedItemIdSet],
    )
  }

  return {
    valid: true,
    plan,
    approvedItems,
    removalSegments: normalizedRemovalSegments,
    removalRanges,
    appliedItemIds: [...appliedItemIdSet],
    skippedItemIds: [...skippedItemIdSet].filter(
      (itemId) => !appliedItemIdSet.has(itemId),
    ),
    warningCount,
  }
}

function createRemovalOperations(
  project: Project,
  segment: ResolvedRemovalSegment,
  options: RoughCutExecutionOptions,
):
  | {
      valid: true
      operations: EditOperation[]
      removedDuration: number
    }
  | {
      valid: false
    } {
  let workingProject = project
  const operations: EditOperation[] = []
  let target = findExecutionTarget(
    buildEditProjection(workingProject),
    segment,
  )

  if (!target) {
    return { valid: false }
  }

  const removalStart = Math.max(segment.timelineStart, target.timelineRange.start)
  const removalEnd = Math.min(segment.timelineEnd, target.timelineRange.end)

  if (
    removalEnd - removalStart <= RIPPLE_TIME_TOLERANCE_SECONDS
  ) {
    return { valid: false }
  }

  if (
    target.timelineRange.end - removalEnd >
    RIPPLE_TIME_TOLERANCE_SECONDS
  ) {
    const splitOperation = createExecutionSplitOperation(
      target,
      removalEnd,
      options,
    )

    if (!splitOperation) {
      return { valid: false }
    }

    operations.push(splitOperation)
    workingProject = appendWorkingOperation(
      workingProject,
      splitOperation,
    )
    target = buildEditProjection(workingProject)
      .clipsById[splitOperation.leftTimelineItemId]

    if (!target) {
      return { valid: false }
    }
  }

  if (
    removalStart - target.timelineRange.start >
    RIPPLE_TIME_TOLERANCE_SECONDS
  ) {
    const splitOperation = createExecutionSplitOperation(
      target,
      removalStart,
      options,
    )

    if (!splitOperation) {
      return { valid: false }
    }

    operations.push(splitOperation)
    workingProject = appendWorkingOperation(
      workingProject,
      splitOperation,
    )
    target = buildEditProjection(workingProject)
      .clipsById[splitOperation.rightTimelineItemId]

    if (!target) {
      return { valid: false }
    }
  }

  const projection = buildEditProjection(workingProject)
  const validation = getRippleDeleteValidation(
    workingProject,
    projection,
    target.timelineItemId,
  )

  if (!validation.valid) {
    return { valid: false }
  }

  const rippleOperation = createRippleDeleteOperation(
    validation.plan,
    {
      operationId: options.createId('rough-cut-ripple-delete'),
      createdAt: options.createdAt,
      selectionBeforeTimelineItemId:
        options.selectionBeforeTimelineItemId,
      playheadTime: options.playheadBefore,
    },
  )

  if (!rippleOperation) {
    return { valid: false }
  }

  operations.push(rippleOperation)

  return {
    valid: true,
    operations,
    removedDuration: rippleOperation.shiftDuration,
  }
}

function createExecutionSplitOperation(
  target: ComputedClip,
  splitTime: number,
  options: RoughCutExecutionOptions,
): SplitOperation | null {
  return createSplitOperation(
    {
      timelineItemId: target.timelineItemId,
      timelineRange: target.timelineRange,
    },
    splitTime,
    {
      operationId: options.createId('rough-cut-split'),
      leftTimelineItemId: options.createId('timeline-item'),
      rightTimelineItemId: options.createId('timeline-item'),
    },
    options.createdAt,
  )
}

function findExecutionTarget(
  projection: EditProjection,
  segment: ResolvedRemovalSegment,
) {
  const candidates = projection.clips
    .filter((clip) => clip.trackId === segment.trackId)
    .filter((clip) =>
      rangesOverlap(
        clip.timelineRange.start,
        clip.timelineRange.end,
        segment.timelineStart,
        segment.timelineEnd,
      ),
    )
    .filter((clip) =>
      rangesOverlap(
        clip.sourceRange.start,
        clip.sourceRange.end,
        segment.sourceStart,
        segment.sourceEnd,
      ),
    )
    .sort((left, right) =>
      left.timelineRange.start - right.timelineRange.start ||
      left.timelineItemId.localeCompare(right.timelineItemId),
    )

  return candidates.length === 1 ? candidates[0] : null
}

function appendWorkingOperation(
  project: Project,
  operation: EditOperation,
): Project {
  return {
    ...project,
    operations: [...project.operations, operation],
  }
}

function resolveEarliestOccurrence(
  projection: EditProjection,
  rangeStart: number,
  rangeEnd: number,
  itemIds: string[],
):
  | {
      status: 'resolved'
      segments: ResolvedRemovalSegment[]
    }
  | {
      status: 'unavailable'
    }
  | {
      status: 'ambiguous'
    } {
  const candidates = projection.clips
    .flatMap((clip) =>
      getClipRangeIntersections(
        clip,
        rangeStart,
        rangeEnd,
        itemIds,
      ),
    )
    .sort(compareRemovalSegments)

  if (!candidates.length) {
    return { status: 'unavailable' }
  }

  const chains: ResolvedRemovalSegment[][] = []

  for (const segment of candidates) {
    const previousChain = chains.at(-1)
    const previousSegment = previousChain?.at(-1)

    if (
      previousChain &&
      previousSegment &&
      previousSegment.trackId === segment.trackId &&
      (
        previousSegment.timelineItemId === segment.timelineItemId ||
        (
          areAdjacent(previousSegment.timelineEnd, segment.timelineStart) &&
          areAdjacent(previousSegment.sourceEnd, segment.sourceStart)
        )
      )
    ) {
      previousChain.push(segment)
    } else {
      chains.push([segment])
    }
  }

  const earliestStart = chains[0]?.[0]?.timelineStart
  const earliestChains = chains.filter(
    (chain) =>
      earliestStart !== undefined &&
      areAdjacent(chain[0].timelineStart, earliestStart),
  )

  if (earliestChains.length !== 1) {
    return { status: 'ambiguous' }
  }

  return {
    status: 'resolved',
    segments: earliestChains[0],
  }
}

function getClipRangeIntersections(
  clip: ComputedClip,
  rangeStart: number,
  rangeEnd: number,
  itemIds: string[],
): ResolvedRemovalSegment[] {
  const sourceIntersectionStart = Math.max(
    rangeStart,
    clip.sourceRange.start,
  )
  const sourceIntersectionEnd = Math.min(
    rangeEnd,
    clip.sourceRange.end,
  )

  if (
    sourceIntersectionEnd - sourceIntersectionStart <=
    RIPPLE_TIME_TOLERANCE_SECONDS
  ) {
    return []
  }

  const requestedTimelineStart = sourceToTimeline(
    sourceTime(sourceIntersectionStart),
    clip.timeMapping,
  )
  const requestedTimelineEnd = sourceToTimeline(
    sourceTime(sourceIntersectionEnd),
    clip.timeMapping,
  )

  return clip.playbackRanges.flatMap((playbackRange) => {
    const timelineStart = Math.max(
      requestedTimelineStart,
      playbackRange.start,
    )
    const timelineEnd = Math.min(
      requestedTimelineEnd,
      playbackRange.end,
    )

    if (
      timelineEnd - timelineStart <=
      RIPPLE_TIME_TOLERANCE_SECONDS
    ) {
      return []
    }

    return [{
      trackId: clip.trackId,
      timelineItemId: clip.timelineItemId,
      sourceStart: timelineToSource(
        timelineTime(timelineStart),
        clip.timeMapping,
      ),
      sourceEnd: timelineToSource(
        timelineTime(timelineEnd),
        clip.timeMapping,
      ),
      timelineStart,
      timelineEnd,
      itemIds: [...itemIds],
    }]
  })
}

function mergeApprovedSourceRanges(items: RoughCutPlanItem[]) {
  const groups: Array<{
    start: number
    end: number
    itemIds: string[]
  }> = []

  for (const item of [...items].sort(
    (left, right) =>
      left.sourceStart - right.sourceStart ||
      left.sourceEnd - right.sourceEnd ||
      left.id.localeCompare(right.id),
  )) {
    const previous = groups.at(-1)

    if (
      previous &&
      item.sourceStart <=
        previous.end + RIPPLE_TIME_TOLERANCE_SECONDS
    ) {
      previous.end = Math.max(previous.end, item.sourceEnd)
      previous.itemIds.push(item.id)
    } else {
      groups.push({
        start: item.sourceStart,
        end: item.sourceEnd,
        itemIds: [item.id],
      })
    }
  }

  return groups
}

function normalizeRemovalSegments(
  segments: ResolvedRemovalSegment[],
) {
  const normalized: ResolvedRemovalSegment[] = []

  for (const segment of [...segments].sort(compareRemovalSegments)) {
    const previous = normalized.at(-1)

    if (
      previous &&
      previous.trackId === segment.trackId &&
      previous.timelineItemId === segment.timelineItemId &&
      segment.timelineStart <=
        previous.timelineEnd + RIPPLE_TIME_TOLERANCE_SECONDS
    ) {
      normalized[normalized.length - 1] = {
        ...previous,
        sourceEnd: Math.max(previous.sourceEnd, segment.sourceEnd),
        timelineEnd: Math.max(
          previous.timelineEnd,
          segment.timelineEnd,
        ),
        itemIds: [...new Set([...previous.itemIds, ...segment.itemIds])],
      }
    } else {
      normalized.push(segment)
    }
  }

  return normalized
}

function normalizeTimelineRanges(
  ranges: Array<{ start: number; end: number }>,
) {
  const normalized: Array<{ start: number; end: number }> = []

  for (const range of [...ranges].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  )) {
    const previous = normalized.at(-1)

    if (
      previous &&
      range.start <=
        previous.end + RIPPLE_TIME_TOLERANCE_SECONDS
    ) {
      previous.end = Math.max(previous.end, range.end)
    } else {
      normalized.push({ ...range })
    }
  }

  return normalized
}

function getRangesDuration(
  ranges: ReadonlyArray<{ start: number; end: number }>,
) {
  return normalizeRippleTimelineTime(
    ranges.reduce(
      (total, range) => total + Math.max(range.end - range.start, 0),
      0,
    ),
  )
}

function remapPlayheadAcrossRanges(
  playhead: number,
  ranges: ReadonlyArray<{ start: number; end: number }>,
) {
  const normalizedPlayhead = normalizeTime(playhead)
  let removedBeforePlayhead = 0

  for (const range of ranges) {
    const duration = range.end - range.start

    if (normalizedPlayhead < range.start) {
      break
    }

    if (normalizedPlayhead <= range.end) {
      return normalizeRippleTimelineTime(
        Math.max(range.start - removedBeforePlayhead, 0),
      )
    }

    removedBeforePlayhead += duration
  }

  return normalizeRippleTimelineTime(
    Math.max(normalizedPlayhead - removedBeforePlayhead, 0),
  )
}

function getSelectionAfterExecution(
  projection: EditProjection,
  selectionBeforeTimelineItemId: string | null,
  playheadAfter: number,
) {
  if (
    selectionBeforeTimelineItemId &&
    projection.clipsById[selectionBeforeTimelineItemId]
  ) {
    return selectionBeforeTimelineItemId
  }

  const orderedClips = [...projection.clips].sort(
    (left, right) =>
      left.visibleStart - right.visibleStart ||
      left.visibleEnd - right.visibleEnd ||
      left.timelineItemId.localeCompare(right.timelineItemId),
  )
  const containingClip = orderedClips.find(
    (clip) =>
      playheadAfter >=
        clip.visibleStart - RIPPLE_TIME_TOLERANCE_SECONDS &&
      playheadAfter <
        clip.visibleEnd - RIPPLE_TIME_TOLERANCE_SECONDS,
  )
  const nextClip = orderedClips.find(
    (clip) =>
      clip.visibleStart >=
      playheadAfter - RIPPLE_TIME_TOLERANCE_SECONDS,
  )

  return containingClip?.timelineItemId ??
    nextClip?.timelineItemId ??
    orderedClips.at(-1)?.timelineItemId ??
    null
}

function getExecutedPlan(
  plan: RoughCutPlan,
  appliedItemIds: string[],
  skippedItemIds: string[],
  actualRemovedDuration: number,
  appliedAt: string,
  historyActionId: string,
): RoughCutPlan {
  const appliedItemIdSet = new Set(appliedItemIds)
  const skippedItemIdSet = new Set(skippedItemIds)

  return {
    ...plan,
    items: plan.items.map((item) => ({
      ...item,
      executionStatus: appliedItemIdSet.has(item.id)
        ? 'applied'
        : skippedItemIdSet.has(item.id)
          ? 'skipped'
          : item.executionStatus,
    })),
    execution: {
      status: 'applied',
      executionVersion: 'rough-cut-executor-v1',
      appliedAt,
      historyActionId,
      appliedItemIds: [...appliedItemIds],
      skippedItemIds: [...skippedItemIds],
      actualRemovedDuration,
    },
  }
}

function isValidPlanItem(
  item: RoughCutPlanItem,
  analysis: ProjectAnalysis,
) {
  const silence = analysis.silences.find(
    (candidate) => candidate.id === item.analysisSourceId,
  )

  return item.analysisSource === 'silence' &&
    item.sourceCandidateId ===
      `analysis-silence-${item.analysisSourceId}` &&
    Number.isFinite(item.sourceStart) &&
    Number.isFinite(item.sourceEnd) &&
    item.sourceEnd - item.sourceStart >
      RIPPLE_TIME_TOLERANCE_SECONDS &&
    Boolean(silence) &&
    Math.abs((silence?.start ?? 0) - item.sourceStart) <=
      RIPPLE_TIME_TOLERANCE_SECONDS &&
    Math.abs((silence?.end ?? 0) - item.sourceEnd) <=
      RIPPLE_TIME_TOLERANCE_SECONDS
}

function rejectPreparation(
  reason: RoughCutExecutionRejectionReason,
  approvedCount = 0,
  unavailableCount = 0,
  warningCount = 0,
  skippedItemIds: string[] = [],
): ExecutionPreparation {
  return {
    valid: false,
    reason,
    approvedCount,
    unavailableCount,
    warningCount,
    skippedItemIds,
  }
}

function compareRemovalSegments(
  left: ResolvedRemovalSegment,
  right: ResolvedRemovalSegment,
) {
  return left.timelineStart - right.timelineStart ||
    left.timelineEnd - right.timelineEnd ||
    left.sourceStart - right.sourceStart ||
    left.timelineItemId.localeCompare(right.timelineItemId)
}

function rangesOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
) {
  return leftStart <
    rightEnd - RIPPLE_TIME_TOLERANCE_SECONDS &&
    leftEnd >
    rightStart + RIPPLE_TIME_TOLERANCE_SECONDS
}

function areAdjacent(left: number, right: number) {
  return Math.abs(left - right) <= RIPPLE_TIME_TOLERANCE_SECONDS
}

function normalizeTime(value: number) {
  return normalizeRippleTimelineTime(
    Math.max(Number.isFinite(value) ? value : 0, 0),
  )
}
