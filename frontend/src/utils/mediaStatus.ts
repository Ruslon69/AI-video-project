import type { MediaStatus } from '../types'

export const mediaStatusProgress: Record<MediaStatus, number> = {
  uploading: 15,
  metadata: 40,
  preview: 65,
  'scene-detection': 85,
  transcribing: 95,
  ready: 100,
  error: 100,
}

const mediaStatusLabels: Record<MediaStatus, string> = {
  uploading: 'Загрузка',
  metadata: 'Метаданные',
  preview: 'Предпросмотр',
  'scene-detection': 'Поиск сцен',
  transcribing: 'Транскрипция',
  ready: 'Готово',
  error: 'Ошибка',
}

export function getMediaStatusLabel(status: MediaStatus) {
  return mediaStatusLabels[status]
}

export function getMediaStatusProgress(status: MediaStatus) {
  return mediaStatusProgress[status]
}
