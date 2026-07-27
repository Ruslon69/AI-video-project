export type RoughCutPlanStatus = 'empty' | 'reviewing' | 'reviewed'

export type RoughCutPlanItemPriority = 'low' | 'high' | 'highest'

export type RoughCutPlanItemReviewStatus =
  | 'pending'
  | 'approved'
  | 'rejected'

export type RoughCutPlanItemExecutionStatus =
  | 'not-applied'
  | 'applied'
  | 'skipped'

export type RoughCutPlanReason =
  | 'medium_pause'
  | 'long_pause'
  | 'extended_silence'

export type RoughCutPlanItem = Readonly<{
  id: string
  sourceCandidateId: string
  analysisSourceId: string
  analysisSource: 'silence'
  reason: RoughCutPlanReason
  sourceStart: number
  sourceEnd: number
  duration: number
  confidence: number
  priority: RoughCutPlanItemPriority
  reviewStatus: RoughCutPlanItemReviewStatus
  defaultReviewStatus: RoughCutPlanItemReviewStatus
  executionStatus: RoughCutPlanItemExecutionStatus
  estimatedImpactSeconds: number
}>

export type RoughCutPlanConfidenceSummary = Readonly<{
  average: number
  minimum: number
  maximum: number
  warningCount: number
}>

export type RoughCutPlanExecution = Readonly<{
  status: 'applied'
  executionVersion: 'rough-cut-executor-v1'
  appliedAt: string
  historyActionId: string
  appliedItemIds: string[]
  skippedItemIds: string[]
  actualRemovedDuration: number
}>

export type RoughCutPlan = Readonly<{
  schemaVersion: '1.0'
  plannerVersion: 'rough-cut-planner-v1'
  id: string
  createdAt: string
  primaryAssetId: string
  analysisSchemaVersion: string
  analysisPipelineVersion: string
  analysisGeneratedAt: string
  status: RoughCutPlanStatus
  estimatedTimeSaved: number
  totalCandidateCount: number
  approvedCount: number
  rejectedCount: number
  pendingCount: number
  confidenceSummary: RoughCutPlanConfidenceSummary
  items: RoughCutPlanItem[]
  execution: RoughCutPlanExecution | null
}>
