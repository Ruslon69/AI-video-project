export type EditOperationType =
  | 'trim'
  | 'split'
  | 'delete'
  | 'move'
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

export interface DeleteOperationParameters {
  ripple: boolean
}

export interface DeleteOperation {
  id: string
  type: 'delete'
  timelineItemId: string
  relativeStart: number
  relativeEnd: number
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
  timelineItemId: string
  relativeStart: number
  relativeEnd: number
  createdAt: string
}

export interface SplitOperation {
  id: string
  type: 'split'
  timelineItemId: string
  splitTime: number
  leftTimelineItemId: string
  rightTimelineItemId: string
  createdAt: string
}

export interface MoveOperation {
  id: string
  type: 'move'
  timelineItemId: string
  timelineStart: number
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
  | MoveOperation
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
