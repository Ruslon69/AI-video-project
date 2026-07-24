import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import type { PlaybackEngine, PlaybackState } from './PlaybackEngine'

export const PlaybackContext = createContext<PlaybackEngine | null>(null)

export const usePlaybackEngine = (): PlaybackEngine => {
  const engine = useContext(PlaybackContext)

  if (!engine) {
    throw new Error('usePlaybackEngine must be used within PlaybackProvider')
  }

  return engine
}

export const usePlaybackState = (): PlaybackState => {
  const engine = usePlaybackEngine()

  return useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  )
}

export const usePlaybackControls = () => {
  const engine = usePlaybackEngine()

  return useMemo(
    () => ({
      play: engine.play,
      pause: engine.pause,
      stop: engine.stop,
      toggle: engine.toggle,
      seek: engine.seek,
      beginScrub: engine.beginScrub,
      endScrub: engine.endScrub,
      setPlaybackRate: engine.setPlaybackRate,
    }),
    [engine],
  )
}
