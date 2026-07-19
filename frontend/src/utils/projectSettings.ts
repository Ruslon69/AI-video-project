import type {
  ProjectOutputSettings,
  SourceOrientation,
  TargetAspectRatio,
  TargetPlatform,
  VideoMetadata,
} from '../types'

export const targetDurationOptions: Array<{
  value: ProjectOutputSettings['duration']
  label: string
}> = [
  { value: 30, label: '30 секунд' },
  { value: 60, label: '60 секунд' },
  { value: 90, label: '1 минута 30 секунд' },
  { value: 120, label: '2 минуты' },
  { value: 180, label: '3 минуты' },
  { value: 300, label: '5 минут' },
  { value: 600, label: '10 минут' },
]

export const targetPlatformOptions: Array<{
  value: TargetPlatform
  label: string
}> = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram_reels', label: 'Instagram Reels' },
  { value: 'youtube_shorts', label: 'YouTube Shorts' },
  { value: 'custom', label: 'Custom' },
]

export const customAspectRatioOptions: Array<{
  value: TargetAspectRatio
  label: string
}> = [
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
]

export const defaultProjectOutputSettings: ProjectOutputSettings = {
  duration: 60,
  platform: 'tiktok',
  aspectRatio: '9:16',
  resolution: {
    width: 1080,
    height: 1920,
  },
  container: 'MP4',
  videoCodec: 'H.264',
  audioCodec: 'AAC',
}

export function applyPlatformDefaults(
  currentSettings: ProjectOutputSettings,
  platform: TargetPlatform,
): ProjectOutputSettings {
  if (platform === 'custom') {
    return {
      ...currentSettings,
      platform,
    }
  }

  return {
    ...currentSettings,
    platform,
    aspectRatio: '9:16',
    resolution: {
      width: 1080,
      height: 1920,
    },
    container: 'MP4',
    videoCodec: 'H.264',
    audioCodec: 'AAC',
  }
}

export function getSourceOrientation(
  metadata: VideoMetadata,
): SourceOrientation {
  if (metadata.height > metadata.width) {
    return 'vertical'
  }

  if (metadata.width > metadata.height) {
    return 'horizontal'
  }

  return 'square'
}

export function isVideoCompatibleWithTarget(
  metadata: VideoMetadata,
  targetAspectRatio: TargetAspectRatio,
) {
  const sourceRatio = metadata.width / metadata.height
  const targetRatio = getAspectRatioValue(targetAspectRatio)
  const tolerance = 0.04

  return Math.abs(sourceRatio - targetRatio) <= tolerance
}

function getAspectRatioValue(aspectRatio: TargetAspectRatio) {
  const [width, height] = aspectRatio.split(':').map(Number)

  return width / height
}
