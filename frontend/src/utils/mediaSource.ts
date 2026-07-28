import type { MediaItem } from '../types'

export function hasPlayableSource(item: MediaItem) {
  return item.file instanceof File && item.objectUrl.length > 0
}

export function getMediaIdentity(item: Pick<MediaItem, 'filename' | 'size' | 'lastModified'>) {
  return `${item.filename}-${item.size}-${item.lastModified}`
}

export function matchesPersistedMediaFile(
  item: Pick<MediaItem, 'filename' | 'size' | 'lastModified'>,
  file: File,
) {
  return item.filename === file.name &&
    (item.size <= 0 || item.size === file.size) &&
    (item.lastModified <= 0 || item.lastModified === file.lastModified)
}
