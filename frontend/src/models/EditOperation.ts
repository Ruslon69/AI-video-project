export type EditOperationType =
  | 'trim'
  | 'split'
  | 'delete'
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

export interface TrimOperationParameters {
  start: number
  end: number
}

export interface SplitOperationParameters {
  timestamp: number
}

export interface DeleteOperationParameters {
  ripple: boolean
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

export interface TrimOperation
  extends EditOperationBase<'trim', TrimOperationParameters> {}

export interface SplitOperation
  extends EditOperationBase<'split', SplitOperationParameters> {}

export interface DeleteOperation
  extends EditOperationBase<'delete', DeleteOperationParameters> {}

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
