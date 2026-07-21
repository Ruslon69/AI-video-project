export type EditOperationType =
  | 'trim'
  | 'split'
  | 'delete'
  | 'review-decision'
  | 'speed'
  | 'text-overlay'
  | 'transition'
  | 'audio'

export interface EditOperationBase<TType extends EditOperationType, TParameters> {
  id: string
  type: TType
  targetId: string
  parameters: TParameters
  createdAt: string
}

export interface SplitOperationParameters {
  timestamp: number
}

export interface DeleteOperationParameters {
  ripple: boolean
}

export interface DeleteOperation {
  id: string
  type: 'delete'
  trackId: string
  clipId: string
  startTime: number
  endTime: number
  createdAt: string
}

export interface ReviewDecisionOperation {
  id: string
  type: 'review-decision'
  suggestionId: string
  decision: 'accepted' | 'rejected'
  createdAt: string
}

export interface TrimOperation {
  id: string
  type: 'trim'
  clipId: string
  trimStart: number
  trimEnd: number
  createdAt: string
}

export interface SpeedOperationParameters {
  playbackRate: number
  preservePitch: boolean
}

export interface TextOverlayOperationParameters {
  text: string
  start: number
  end: number
  position: {
    x: number
    y: number
  }
}

export interface TransitionOperationParameters {
  transitionType: 'cut' | 'fade' | 'crossfade' | 'dip'
  duration: number
}

export interface AudioOperationParameters {
  volume?: number
  muted?: boolean
  fadeIn?: number
  fadeOut?: number
}

export interface SplitOperation
  extends EditOperationBase<'split', SplitOperationParameters> {}

export interface SpeedOperation
  extends EditOperationBase<'speed', SpeedOperationParameters> {}

export interface TextOverlayOperation
  extends EditOperationBase<'text-overlay', TextOverlayOperationParameters> {}

export interface TransitionOperation
  extends EditOperationBase<'transition', TransitionOperationParameters> {}

export interface AudioOperation
  extends EditOperationBase<'audio', AudioOperationParameters> {}

export type EditOperation =
  | TrimOperation
  | SplitOperation
  | DeleteOperation
  | ReviewDecisionOperation
  | SpeedOperation
  | TextOverlayOperation
  | TransitionOperation
  | AudioOperation

export interface EditPlan {
  id: string
  projectId: string
  operations: EditOperation[]
  createdAt: string
}

export interface EditOperationGroup {
  actionId: string
  operations: EditOperation[]
}
