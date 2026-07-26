export function getMediaSourceColor(sourceAssetId: string) {
  const hash = hashSourceAssetId(sourceAssetId)
  const hue = (hash % 36000) / 100
  const saturation = 52 + ((hash >>> 11) % 9)
  const lightness = 42 + ((hash >>> 21) % 7)

  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function hashSourceAssetId(sourceAssetId: string) {
  let hash = 0

  for (let index = 0; index < sourceAssetId.length; index += 1) {
    hash = (hash * 31 + sourceAssetId.charCodeAt(index)) | 0
  }

  return hash >>> 0
}
