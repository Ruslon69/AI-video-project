export function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60

  if (hours > 0) {
    return [
      hours,
      minutes.toString().padStart(2, '0'),
      remainingSeconds.toString().padStart(2, '0'),
    ].join(':')
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function formatPlaybackTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(seconds, 0) : 0
  const totalCentiseconds = Math.round(safeSeconds * 100)
  const hours = Math.floor(totalCentiseconds / 360_000)
  const minutes = Math.floor((totalCentiseconds % 360_000) / 6_000)
  const remainingSeconds = Math.floor((totalCentiseconds % 6_000) / 100)
  const centiseconds = totalCentiseconds % 100

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    remainingSeconds.toString().padStart(2, '0'),
    centiseconds.toString().padStart(2, '0'),
  ].join(':')
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
