import type { VideoMetadata, VideoPreviews, VideoScenes } from '../types'

const API_BASE_URL = 'http://127.0.0.1:8000'

type ApiRequestOptions = RequestInit & {
  path: string
}

export async function apiFetch<T>({ path, ...options }: ApiRequestOptions) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`Backend request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function checkBackendHealth() {
  try {
    await apiFetch<unknown>({ path: '/health' })
    return true
  } catch {
    return false
  }
}

export async function uploadVideoMetadata(file: File, signal?: AbortSignal) {
  const formData = new FormData()
  formData.append('file', file)

  return apiFetch<VideoMetadata>({
    path: '/video/metadata',
    method: 'POST',
    body: formData,
    signal,
  })
}

export async function uploadVideoPreviews(file: File, signal?: AbortSignal) {
  const formData = new FormData()
  formData.append('file', file)

  return apiFetch<VideoPreviews>({
    path: '/video/previews',
    method: 'POST',
    body: formData,
    signal,
  })
}

export async function uploadVideoScenes(file: File, signal?: AbortSignal) {
  const formData = new FormData()
  formData.append('file', file)

  return apiFetch<VideoScenes>({
    path: '/video/scenes',
    method: 'POST',
    body: formData,
    signal,
  })
}
