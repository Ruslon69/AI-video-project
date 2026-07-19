export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 3,
  }).format(value)
}

export function formatBitrate(bitrate: number | null) {
  if (!bitrate) {
    return 'Не указан'
  }

  return `${formatNumber(bitrate / 1_000_000)} Мбит/с`
}

export function formatFileSize(bytes: number) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
    style: 'unit',
    unit: 'megabyte',
  }).format(bytes / 1_000_000)
}
