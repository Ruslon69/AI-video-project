export type RoughCutPlanStatus = 'empty' | 'reviewing' | 'reviewed'

export type RoughCutPlanItemPriority =
  | 'ignore'
  | 'low'
  | 'medium'
  | 'high'
  | 'highest'

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
  | 'pause_after_completed_thought'
  | 'long_silence_after_sentence'
  | 'silence_between_scene_blocks'
  | 'silence_after_sentence_between_scenes'
  | 'extended_silence_without_speech'
  | 'extended_silence_after_unfinished_phrase'
  | 'pause_after_unfinished_phrase'
  | 'speech_break_for_review'

export type RoughCutSentenceCompletion =
  | 'completed'
  | 'continuation'
  | 'unknown'

export type RoughCutPlanSignalScores = Readonly<{
  pause: number
  speechConfidence: number
  sentenceCompletion: number
  scene: number
}>

export type RoughCutPlanSpeechContext = Readonly<{
  precedingText: string | null
  followingText: string | null
  precedingTranscriptSegmentId: number | null
  followingTranscriptSegmentId: number | null
  relatedSceneId: string | null
  sentenceCompletion: RoughCutSentenceCompletion
}>

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
  signalScores?: RoughCutPlanSignalScores
  speechContext?: RoughCutPlanSpeechContext
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
  schemaVersion: '1.0' | '2.0'
  plannerVersion: 'rough-cut-planner-v1' | 'rough-cut-planner-v2'
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
  evaluatedPauseCount?: number
  ignoredPauseCount?: number
}>
