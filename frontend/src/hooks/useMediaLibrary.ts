import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  uploadVideoMetadata,
  uploadVideoPreviews,
  uploadVideoScenes,
  uploadVideoTranscription,
} from '../services/api'
import type { MediaFileRejection, MediaItem, MediaStatus, MediaType } from '../types'
import { getMediaStatusProgress } from '../utils/mediaStatus'

const MAX_ACTIVE_PREVIEW_REQUESTS = 2
const MAX_ACTIVE_SCENE_REQUESTS = 1
const MAX_ACTIVE_TRANSCRIPTION_REQUESTS = 1
const FALLBACK_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'mkv'])

function getMediaType(file: File): MediaType | null {
  if (file.type.startsWith('video/')) {
    return 'video'
  }

  if (file.type.startsWith('image/')) {
    return 'image'
  }

  if (file.type.startsWith('audio/')) {
    return 'audio'
  }

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension && FALLBACK_VIDEO_EXTENSIONS.has(extension)) {
    return 'video'
  }

  return null
}

function getDuplicateKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function createMediaId(file: File) {
  return `${getDuplicateKey(file)}-${crypto.randomUUID()}`
}

function createMediaItem(file: File, type: MediaType): MediaItem {
  const status: MediaStatus = type === 'video' ? 'uploading' : 'ready'

  return {
    id: createMediaId(file),
    file,
    filename: file.name,
    type,
    size: file.size,
    lastModified: file.lastModified,
    objectUrl: URL.createObjectURL(file),
    status,
    progress: getMediaStatusProgress(status),
    metadata: null,
    errorMessage: undefined,
    previewState: type === 'video' ? 'idle' : 'ready',
    previews: null,
    previewError: null,
    sceneState: type === 'video' ? 'idle' : 'ready',
    scenes: null,
    sceneError: null,
    transcriptionState: type === 'video' ? 'idle' : 'ready',
    transcription: null,
    transcriptionError: null,
  }
}

function applyMediaStatus(
  item: MediaItem,
  status: MediaStatus,
  errorMessage?: string,
): MediaItem {
  return {
    ...item,
    status,
    progress: getMediaStatusProgress(status),
    errorMessage,
  }
}

export function useMediaLibrary(
  onBackendConnectionChange: (isConnected: boolean) => void,
) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [fileRejections, setFileRejections] = useState<MediaFileRejection[]>([])
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const itemsRef = useRef<MediaItem[]>([])
  const isMountedRef = useRef(true)
  const metadataControllersRef = useRef(new Map<string, AbortController>())
  const previewControllersRef = useRef(new Map<string, AbortController>())
  const sceneControllersRef = useRef(new Map<string, AbortController>())
  const transcriptionControllersRef = useRef(new Map<string, AbortController>())
  const previewQueueRef = useRef<MediaItem[]>([])
  const sceneQueueRef = useRef<MediaItem[]>([])
  const transcriptionQueueRef = useRef<MediaItem[]>([])
  const queuedPreviewIdsRef = useRef(new Set<string>())
  const activePreviewIdsRef = useRef(new Set<string>())
  const queuedSceneIdsRef = useRef(new Set<string>())
  const activeSceneIdsRef = useRef(new Set<string>())
  const queuedTranscriptionIdsRef = useRef(new Set<string>())
  const activeTranscriptionIdsRef = useRef(new Set<string>())

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeItemId) ?? null,
    [activeItemId, items],
  )

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const updateItems = useCallback((updater: (items: MediaItem[]) => MediaItem[]) => {
    if (!isMountedRef.current) {
      return
    }

    setItems(updater)
  }, [])

  const clearQueuedMediaWork = useCallback(() => {
    previewQueueRef.current = []
    sceneQueueRef.current = []
    transcriptionQueueRef.current = []
    queuedPreviewIdsRef.current.clear()
    queuedSceneIdsRef.current.clear()
    queuedTranscriptionIdsRef.current.clear()
  }, [])

  const abortMediaWork = useCallback((itemId: string) => {
    metadataControllersRef.current.get(itemId)?.abort()
    metadataControllersRef.current.delete(itemId)
    previewControllersRef.current.get(itemId)?.abort()
    previewControllersRef.current.delete(itemId)
    sceneControllersRef.current.get(itemId)?.abort()
    sceneControllersRef.current.delete(itemId)
    transcriptionControllersRef.current.get(itemId)?.abort()
    transcriptionControllersRef.current.delete(itemId)
    queuedPreviewIdsRef.current.delete(itemId)
    queuedSceneIdsRef.current.delete(itemId)
    queuedTranscriptionIdsRef.current.delete(itemId)
    previewQueueRef.current = previewQueueRef.current.filter((item) => item.id !== itemId)
    sceneQueueRef.current = sceneQueueRef.current.filter((item) => item.id !== itemId)
    transcriptionQueueRef.current = transcriptionQueueRef.current.filter(
      (item) => item.id !== itemId,
    )
  }, [])

  const pumpTranscriptionQueue = useCallback(() => {
    if (!isMountedRef.current) {
      return
    }

    while (
      activeTranscriptionIdsRef.current.size < MAX_ACTIVE_TRANSCRIPTION_REQUESTS &&
      transcriptionQueueRef.current.length > 0
    ) {
      const item = transcriptionQueueRef.current.shift()

      if (!item || !itemsRef.current.some((latestItem) => latestItem.id === item.id)) {
        continue
      }

      queuedTranscriptionIdsRef.current.delete(item.id)
      activeTranscriptionIdsRef.current.add(item.id)

      const controller = new AbortController()
      transcriptionControllersRef.current.set(item.id, controller)

      void uploadVideoTranscription(item.file, controller.signal)
        .then((transcription) => {
          if (
            controller.signal.aborted ||
            !itemsRef.current.some((latestItem) => latestItem.id === item.id)
          ) {
            return
          }

          updateItems((latestItems) =>
            latestItems.map((latestItem) =>
              latestItem.id === item.id
                ? {
                    ...applyMediaStatus(latestItem, 'ready'),
                    transcription,
                    transcriptionState: 'ready',
                    transcriptionError: null,
                  }
                : latestItem,
            ),
          )
          onBackendConnectionChange(true)
        })
        .catch(() => {
          if (controller.signal.aborted) {
            return
          }

          updateItems((latestItems) =>
            latestItems.map((latestItem) =>
              latestItem.id === item.id
                ? {
                    ...applyMediaStatus(
                      latestItem,
                      'error',
                      'Не удалось расшифровать речь.',
                    ),
                    transcriptionState: 'error',
                    transcriptionError: 'Не удалось расшифровать речь.',
                  }
                : latestItem,
            ),
          )
        })
        .finally(() => {
          transcriptionControllersRef.current.delete(item.id)
          activeTranscriptionIdsRef.current.delete(item.id)
          if (isMountedRef.current) {
            pumpTranscriptionQueue()
          }
        })
    }
  }, [onBackendConnectionChange, updateItems])

  const enqueueTranscription = useCallback((item: MediaItem) => {
    if (
      queuedTranscriptionIdsRef.current.has(item.id) ||
      activeTranscriptionIdsRef.current.has(item.id) ||
      itemsRef.current.some((latestItem) => (
        latestItem.id === item.id && latestItem.transcription
      ))
    ) {
      return
    }

    queuedTranscriptionIdsRef.current.add(item.id)
    transcriptionQueueRef.current.push(item)
    updateItems((latestItems) =>
      latestItems.map((latestItem) =>
        latestItem.id === item.id
          ? {
              ...applyMediaStatus(latestItem, 'transcribing'),
              transcriptionState: 'processing',
              transcriptionError: null,
            }
          : latestItem,
      ),
    )
    pumpTranscriptionQueue()
  }, [pumpTranscriptionQueue, updateItems])

  const pumpSceneQueue = useCallback(() => {
    if (!isMountedRef.current) {
      return
    }

    while (
      activeSceneIdsRef.current.size < MAX_ACTIVE_SCENE_REQUESTS &&
      sceneQueueRef.current.length > 0
    ) {
      const item = sceneQueueRef.current.shift()

      if (!item || !itemsRef.current.some((latestItem) => latestItem.id === item.id)) {
        continue
      }

      queuedSceneIdsRef.current.delete(item.id)
      activeSceneIdsRef.current.add(item.id)

      const controller = new AbortController()
      sceneControllersRef.current.set(item.id, controller)

      void uploadVideoScenes(item.file, controller.signal)
        .then((scenes) => {
          if (
            controller.signal.aborted ||
            !itemsRef.current.some((latestItem) => latestItem.id === item.id)
          ) {
            return
          }

          updateItems((latestItems) =>
            latestItems.map((latestItem) =>
              latestItem.id === item.id
                ? {
                    ...applyMediaStatus(latestItem, 'transcribing'),
                    scenes,
                    sceneState: 'ready',
                    sceneError: null,
                  }
                : latestItem,
            ),
          )
          onBackendConnectionChange(true)
          enqueueTranscription(item)
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            return
          }

          const isTimeout = error instanceof ApiError && error.status === 504
          const sceneError = isTimeout
            ? 'Scene detection timed out'
            : 'Scene detection failed'

          updateItems((latestItems) =>
            latestItems.map((latestItem) =>
              latestItem.id === item.id
                ? {
                    ...applyMediaStatus(latestItem, 'transcribing'),
                    sceneState: isTimeout ? 'timeout' : 'error',
                    sceneError,
                  }
                : latestItem,
            ),
          )
          enqueueTranscription(item)
        })
        .finally(() => {
          sceneControllersRef.current.delete(item.id)
          activeSceneIdsRef.current.delete(item.id)
          if (isMountedRef.current) {
            pumpSceneQueue()
          }
        })
    }
  }, [enqueueTranscription, onBackendConnectionChange, updateItems])

  const enqueueSceneDetection = useCallback((item: MediaItem) => {
    if (
      queuedSceneIdsRef.current.has(item.id) ||
      activeSceneIdsRef.current.has(item.id) ||
      itemsRef.current.some((latestItem) => (
        latestItem.id === item.id && latestItem.scenes
      ))
    ) {
      return
    }

    queuedSceneIdsRef.current.add(item.id)
    sceneQueueRef.current.push(item)
    updateItems((latestItems) =>
      latestItems.map((latestItem) =>
        latestItem.id === item.id
          ? {
              ...applyMediaStatus(latestItem, 'scene-detection'),
              sceneState: 'processing',
              sceneError: null,
            }
          : latestItem,
      ),
    )
    pumpSceneQueue()
  }, [pumpSceneQueue, updateItems])

  const pumpPreviewQueue = useCallback(() => {
    if (!isMountedRef.current) {
      return
    }

    while (
      activePreviewIdsRef.current.size < MAX_ACTIVE_PREVIEW_REQUESTS &&
      previewQueueRef.current.length > 0
    ) {
      const item = previewQueueRef.current.shift()

      if (!item || !itemsRef.current.some((latestItem) => latestItem.id === item.id)) {
        continue
      }

      queuedPreviewIdsRef.current.delete(item.id)
      activePreviewIdsRef.current.add(item.id)

      const controller = new AbortController()
      previewControllersRef.current.set(item.id, controller)

      void uploadVideoPreviews(item.file, controller.signal)
        .then((previews) => {
          if (
            controller.signal.aborted ||
            !itemsRef.current.some((latestItem) => latestItem.id === item.id)
          ) {
            return
          }

          updateItems((latestItems) =>
            latestItems.map((latestItem) =>
              latestItem.id === item.id
                ? {
                    ...applyMediaStatus(latestItem, 'scene-detection'),
                    previews,
                    previewState: 'ready',
                    previewError: null,
                  }
                : latestItem,
            ),
          )
          onBackendConnectionChange(true)
          enqueueSceneDetection(item)
        })
        .catch(() => {
          if (controller.signal.aborted) {
            return
          }

          updateItems((latestItems) =>
            latestItems.map((latestItem) =>
              latestItem.id === item.id
                ? {
                    ...applyMediaStatus(
                      latestItem,
                      'error',
                      'Не удалось создать кадры предпросмотра.',
                    ),
                    previewState: 'error',
                    previewError:
                      'Не удалось создать кадры предпросмотра.',
                  }
                : latestItem,
            ),
          )
        })
        .finally(() => {
          previewControllersRef.current.delete(item.id)
          activePreviewIdsRef.current.delete(item.id)
          if (isMountedRef.current) {
            pumpPreviewQueue()
          }
        })
    }
  }, [enqueueSceneDetection, onBackendConnectionChange, updateItems])

  const enqueuePreview = useCallback((item: MediaItem) => {
    if (
      queuedPreviewIdsRef.current.has(item.id) ||
      activePreviewIdsRef.current.has(item.id) ||
      item.previews
    ) {
      return
    }

    queuedPreviewIdsRef.current.add(item.id)
    previewQueueRef.current.push(item)
    pumpPreviewQueue()
  }, [pumpPreviewQueue])

  const cleanupMediaLibrary = useCallback(() => {
    isMountedRef.current = false
    clearQueuedMediaWork()

    for (const controller of metadataControllersRef.current.values()) {
      controller.abort()
    }

    for (const controller of previewControllersRef.current.values()) {
      controller.abort()
    }

    for (const controller of sceneControllersRef.current.values()) {
      controller.abort()
    }

    for (const controller of transcriptionControllersRef.current.values()) {
      controller.abort()
    }

    for (const item of itemsRef.current) {
      URL.revokeObjectURL(item.objectUrl)
    }
  }, [clearQueuedMediaWork])

  useEffect(() => {
    isMountedRef.current = true

    return cleanupMediaLibrary
  }, [cleanupMediaLibrary])

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    const existingKeys = new Set(itemsRef.current.map((item) => (
      getDuplicateKey(item.file)
    )))
    const addedItems: MediaItem[] = []
    const addedVideoItems: MediaItem[] = []
    const rejectedFiles: MediaFileRejection[] = []

    for (const file of files) {
      const type = getMediaType(file)
      const duplicateKey = getDuplicateKey(file)

      if (!type) {
        rejectedFiles.push({
          filename: file.name,
          reason: 'Формат файла не поддерживается.',
        })
        continue
      }

      if (existingKeys.has(duplicateKey)) {
        continue
      }

      existingKeys.add(duplicateKey)

      const item = createMediaItem(file, type)
      addedItems.push(item)

      if (type === 'video') {
        addedVideoItems.push(item)
      }
    }

    setFileRejections(rejectedFiles)

    if (addedItems.length === 0) {
      return
    }

    updateItems((currentItems) => [...currentItems, ...addedItems])

    if (!activeItemId && itemsRef.current.length === 0) {
      setActiveItemId(addedItems[0].id)
    }

    for (const item of addedVideoItems) {
      const controller = new AbortController()
      metadataControllersRef.current.set(item.id, controller)

      updateItems((latestItems) =>
        latestItems.map((latestItem) =>
          latestItem.id === item.id
            ? applyMediaStatus(latestItem, 'metadata')
            : latestItem,
        ),
      )

      void uploadVideoMetadata(item.file, controller.signal)
        .then((metadata) => {
          updateItems((latestItems) =>
            latestItems.map((latestItem) =>
              latestItem.id === item.id
                ? {
                    ...applyMediaStatus(latestItem, 'preview'),
                    metadata,
                    errorMessage: undefined,
                    previewState: 'processing',
                    previewError: null,
                  }
                : latestItem,
            ),
          )
          onBackendConnectionChange(true)

          enqueuePreview(item)
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            return
          }

          updateItems((latestItems) =>
            latestItems.map((latestItem) =>
              latestItem.id === item.id
                ? {
                    ...applyMediaStatus(
                      latestItem,
                      'error',
                      'Не удалось прочитать метаданные. Файл можно оставить в библиотеке.',
                    ),
                  }
                : latestItem,
            ),
          )
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            onBackendConnectionChange(false)
          }
        })
        .finally(() => {
          metadataControllersRef.current.delete(item.id)
        })
    }
  }, [
    activeItemId,
    enqueuePreview,
    onBackendConnectionChange,
    updateItems,
  ])

  const selectItem = useCallback((itemId: string) => {
    setActiveItemId(itemId)
  }, [])

  const removeItem = useCallback((itemId: string) => {
    abortMediaWork(itemId)
    updateItems((currentItems) => {
      const removedItem = currentItems.find((item) => item.id === itemId)
      const nextItems = currentItems.filter((item) => item.id !== itemId)

      if (removedItem) {
        URL.revokeObjectURL(removedItem.objectUrl)
      }

      if (activeItemId === itemId) {
        setActiveItemId(nextItems[0]?.id ?? null)
      }

      return nextItems
    })
  }, [abortMediaWork, activeItemId, updateItems])

  const clearLibrary = useCallback(() => {
    clearQueuedMediaWork()
    setFileRejections([])

    for (const item of itemsRef.current) {
      abortMediaWork(item.id)
    }

    updateItems((currentItems) => {
      for (const item of currentItems) {
        URL.revokeObjectURL(item.objectUrl)
      }

      return []
    })
    setActiveItemId(null)
  }, [abortMediaWork, clearQueuedMediaWork, updateItems])

  return {
    items,
    activeItem,
    activeItemId,
    fileRejections,
    addFiles,
    selectItem,
    removeItem,
    clearLibrary,
  }
}
