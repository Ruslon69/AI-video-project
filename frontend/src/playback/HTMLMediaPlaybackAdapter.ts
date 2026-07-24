import type { PlaybackMediaAdapter } from './PlaybackEngine'

export function createHTMLMediaPlaybackAdapter(
  media: HTMLMediaElement,
): PlaybackMediaAdapter {
  return {
    play: () => media.play(),
    pause: () => media.pause(),
    isPaused: () => media.paused,
    getCurrentTime: () =>
      Number.isFinite(media.currentTime) ? media.currentTime : 0,
    setCurrentTime: (mediaTime) => {
      try {
        media.currentTime = mediaTime
      } catch {
        // Metadata may not be available during the initial adapter attachment.
      }
    },
    setPlaybackRate: (playbackRate) => {
      media.playbackRate = playbackRate
    },
  }
}
