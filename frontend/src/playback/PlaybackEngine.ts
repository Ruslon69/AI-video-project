export type PlaybackStatus = 'stopped' | 'paused' | 'playing'

export type PlaybackState = Readonly<{
  status: PlaybackStatus
  currentTime: number
  duration: number
  playbackRate: number
}>

export type ResolvedPlaybackFrame = Readonly<{
  timelineTime: number
  mediaTime: number
  isPlayable: boolean
}>

export type PlaybackTimeline = Readonly<{
  startTime: number
  duration: number
  hasPlayableContent: boolean
  resolve: (timelineTime: number) => ResolvedPlaybackFrame
}>

export type PlaybackMediaAdapter = Readonly<{
  play: () => Promise<void>
  pause: () => void
  isPaused: () => boolean
  getCurrentTime: () => number
  setCurrentTime: (mediaTime: number) => void
  setPlaybackRate: (playbackRate: number) => void
}>

export type PlaybackScheduler = Readonly<{
  now: () => number
  requestFrame: (callback: FrameRequestCallback) => number
  cancelFrame: (requestId: number) => void
}>

const MEDIA_SYNC_TOLERANCE_SECONDS = 0.08
const PLAYBACK_END_EPSILON_SECONDS = 0.0001

const emptyPlaybackTimeline: PlaybackTimeline = {
  startTime: 0,
  duration: 0,
  hasPlayableContent: false,
  resolve: () => ({
    timelineTime: 0,
    mediaTime: 0,
    isPlayable: false,
  }),
}

function createBrowserScheduler(): PlaybackScheduler {
  return {
    now: () => performance.now(),
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (requestId) => window.cancelAnimationFrame(requestId),
  }
}

export class PlaybackEngine {
  private state: PlaybackState = {
    status: 'stopped',
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
  }

  private timeline: PlaybackTimeline = emptyPlaybackTimeline
  private media: PlaybackMediaAdapter | null = null
  private readonly listeners = new Set<() => void>()
  private readonly scheduler: PlaybackScheduler
  private animationFrameId: number | null = null
  private previousFrameTime: number | null = null
  private pendingMediaPlay: Promise<void> | null = null
  private isScrubbing = false
  private resumeAfterScrub = false

  constructor(scheduler: PlaybackScheduler = createBrowserScheduler()) {
    this.scheduler = scheduler
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.state

  readonly getCurrentTime = () => this.state.currentTime

  configureTimeline(timeline: PlaybackTimeline) {
    this.timeline = timeline
    const resolvedFrame = timeline.resolve(this.state.currentTime)
    const nextTime = resolvedFrame.isPlayable
      ? resolvedFrame.timelineTime
      : Math.min(this.state.currentTime, timeline.duration)

    if (this.state.status === 'playing' && !timeline.hasPlayableContent) {
      this.pause()
    }

    this.updateState({
      ...this.state,
      currentTime: nextTime,
      duration: timeline.duration,
    })
    this.synchronizeMedia(true)
  }

  attachMedia(media: PlaybackMediaAdapter | null) {
    if (this.media === media) {
      return
    }

    this.media?.pause()
    this.pendingMediaPlay = null
    this.media = media
    this.synchronizeMedia(true)

    if (media && this.state.status === 'playing') {
      this.startMedia(media)
    }
  }

  play = () => {
    if (!this.timeline.hasPlayableContent || this.state.duration <= 0) {
      return
    }

    if (
      this.state.currentTime >=
      this.state.duration - PLAYBACK_END_EPSILON_SECONDS
    ) {
      this.seek(this.timeline.startTime)
    }

    const frame = this.timeline.resolve(this.state.currentTime)

    if (!frame.isPlayable) {
      return
    }

    this.cancelScheduledFrame()
    this.previousFrameTime = this.scheduler.now()
    this.updateState({
      ...this.state,
      status: 'playing',
      currentTime: frame.timelineTime,
    })
    this.synchronizeMedia(true)

    if (this.media) {
      this.startMedia(this.media)
    }

    this.scheduleNextFrame()
  }

  pause = () => {
    this.cancelScheduledFrame()
    this.media?.pause()
    this.pendingMediaPlay = null

    if (this.state.status !== 'paused') {
      this.updateState({
        ...this.state,
        status: 'paused',
      })
    }
  }

  stop = () => {
    this.resumeAfterScrub = false
    this.isScrubbing = false
    this.cancelScheduledFrame()
    this.media?.pause()
    this.pendingMediaPlay = null
    const frame = this.timeline.resolve(this.timeline.startTime)

    this.updateState({
      ...this.state,
      status: 'stopped',
      currentTime: this.timeline.startTime,
    })
    this.synchronizeMediaFrame(frame, true)
  }

  toggle = () => {
    if (this.state.status === 'playing') {
      this.pause()
      return
    }

    this.play()
  }

  seek = (timelineTime: number) => {
    const frame = this.timeline.resolve(timelineTime)
    const nextTime = frame.isPlayable
      ? frame.timelineTime
      : Math.min(Math.max(timelineTime, 0), this.timeline.duration)

    this.updateState({
      ...this.state,
      currentTime: nextTime,
    })
    this.synchronizeMediaFrame(frame, true)

    if (this.state.status === 'playing') {
      this.previousFrameTime = this.scheduler.now()
    }
  }

  beginScrub = () => {
    if (this.isScrubbing) {
      return
    }

    this.isScrubbing = true
    this.resumeAfterScrub = this.state.status === 'playing'
    this.cancelScheduledFrame()
    this.media?.pause()
    this.pendingMediaPlay = null

    if (this.resumeAfterScrub) {
      this.updateState({
        ...this.state,
        status: 'paused',
      })
    }
  }

  endScrub = () => {
    if (!this.isScrubbing) {
      return
    }

    const shouldResume = this.resumeAfterScrub
    this.isScrubbing = false
    this.resumeAfterScrub = false

    if (shouldResume) {
      this.play()
    }
  }

  setPlaybackRate = (playbackRate: number) => {
    const safePlaybackRate = Number.isFinite(playbackRate)
      ? Math.min(Math.max(playbackRate, 0.1), 16)
      : 1

    this.updateState({
      ...this.state,
      playbackRate: safePlaybackRate,
    })
    this.media?.setPlaybackRate(safePlaybackRate)
  }

  synchronizeMedia = (force = false) => {
    this.synchronizeMediaFrame(
      this.timeline.resolve(this.state.currentTime),
      force,
    )
  }

  dispose() {
    this.cancelScheduledFrame()
    this.media?.pause()
    this.pendingMediaPlay = null
    this.media = null
    this.listeners.clear()
  }

  private readonly handleAnimationFrame = (frameTime: number) => {
    this.animationFrameId = null

    if (this.state.status !== 'playing') {
      return
    }

    const previousFrameTime = this.previousFrameTime ?? frameTime
    const elapsedSeconds = Math.max(frameTime - previousFrameTime, 0) / 1000
    const requestedTime =
      this.state.currentTime + elapsedSeconds * this.state.playbackRate

    this.previousFrameTime = frameTime

    if (
      requestedTime >=
      this.timeline.duration - PLAYBACK_END_EPSILON_SECONDS
    ) {
      this.finishAtProjectEnd()
      return
    }

    const frame = this.timeline.resolve(requestedTime)

    if (!frame.isPlayable) {
      this.finishAtProjectEnd()
      return
    }

    this.updateState({
      ...this.state,
      currentTime: frame.timelineTime,
    })
    this.synchronizeMediaFrame(frame)
    this.scheduleNextFrame()
  }

  private scheduleNextFrame() {
    if (
      this.animationFrameId !== null ||
      this.state.status !== 'playing'
    ) {
      return
    }

    this.animationFrameId = this.scheduler.requestFrame(
      this.handleAnimationFrame,
    )
  }

  private cancelScheduledFrame() {
    if (this.animationFrameId !== null) {
      this.scheduler.cancelFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    this.previousFrameTime = null
  }

  private finishAtProjectEnd() {
    this.cancelScheduledFrame()
    this.media?.pause()
    this.pendingMediaPlay = null
    const frame = this.timeline.resolve(this.timeline.duration)

    this.updateState({
      ...this.state,
      status: 'paused',
      currentTime: this.timeline.duration,
    })
    this.synchronizeMediaFrame(frame, true)
  }

  private synchronizeMediaFrame(
    frame: ResolvedPlaybackFrame,
    force = false,
  ) {
    const media = this.media

    if (!media) {
      return
    }

    const mediaTimeDelta = Math.abs(
      media.getCurrentTime() - frame.mediaTime,
    )

    if (force || mediaTimeDelta >= MEDIA_SYNC_TOLERANCE_SECONDS) {
      media.setCurrentTime(frame.mediaTime)
    }

    media.setPlaybackRate(this.state.playbackRate)

    if (this.state.status === 'playing' && media.isPaused()) {
      this.startMedia(media)
    }
  }

  private startMedia(media: PlaybackMediaAdapter) {
    if (this.pendingMediaPlay) {
      return
    }

    const playRequest = media.play()
    this.pendingMediaPlay = playRequest
    void playRequest
      .then(() => {
        if (this.media === media && this.state.status !== 'playing') {
          media.pause()
        }
      })
      .catch(() => {
        if (this.media === media && this.state.status === 'playing') {
          this.pause()
        }
      })
      .finally(() => {
        if (this.pendingMediaPlay === playRequest) {
          this.pendingMediaPlay = null
        }
      })
  }

  private updateState(nextState: PlaybackState) {
    if (
      nextState.status === this.state.status &&
      nextState.currentTime === this.state.currentTime &&
      nextState.duration === this.state.duration &&
      nextState.playbackRate === this.state.playbackRate
    ) {
      return
    }

    this.state = nextState

    for (const listener of this.listeners) {
      listener()
    }
  }
}
