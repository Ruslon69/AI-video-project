import { useEffect, useState, type ReactNode } from 'react'
import { PlaybackContext } from './PlaybackStore'
import { PlaybackEngine } from './PlaybackEngine'

interface PlaybackProviderProps {
  children: ReactNode
}

export function PlaybackProvider({ children }: PlaybackProviderProps) {
  const [engine] = useState(() => new PlaybackEngine())

  useEffect(() => () => engine.dispose(), [engine])

  return (
    <PlaybackContext.Provider value={engine}>
      {children}
    </PlaybackContext.Provider>
  )
}
