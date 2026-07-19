import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  uploadVideoMetadata,
  uploadVideoPreviews,
  uploadVideoScenes,
} from '../services/api'
import type { MediaItem, MediaType } from '../types'

const MAX_ACTIVE_PREVIEW_REQUESTS = 2
const MAX_ACTIVE_SCENE_REQUESTS = 1

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

  return null
}

function getDuplicateKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function createMediaId(file: File) {
  return `${getDuplicateKey(file)}-${crypto.randomUUID()}`
}

export function useMediaLibrary(
  onBackendConnectionChange: (isConnected: boolean) => void,
) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const itemsRef = useRef<MediaItem[]>([])
  const isMountedRef = useRef(true)
  const metadataControllersRef = useRef(new Map<string, AbortController>())
  const previewControllersRef = useRef(new Map<string, AbortController>())
  const sceneControllersRef = useRef(new Map<string, AbortController>())
  const previewQueueRef = useRef<MediaItem[]>([])
  const sceneQueueRef = useRef<MediaItem[]>([])
  const queuedPreviewIdsRef = useRef(new Set<string>())
  const activePreviewIdsRef = useRef(new Set<string>())
  const queuedSceneIdsRef = useRef(new Set<string>())
  const activeSceneIdsRef = useRef(new Set<string>())

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
    queuedPreviewIdsRef.current.clear()
    queuedSceneIdsRef.current.clear()
  }, [])

  const abortMediaWork = useCallback((itemId: string) => {
    metadataControllersRef.current.get(itemId)?.abort()
    metadataControllersRef.current.delete(itemId)
    previewControllersRef.current.get(itemId)?.abort()
    previewControllersRef.current.delete(itemId)
    sceneControllersRef.current.get(itemId)?.abort()
    sceneControllersRef.current.delete(itemId)
    queuedPreviewIdsRef.current.delete(itemId)
    queuedSceneIdsRef.current.delete(itemId)
    previewQueueRef.current = previewQueueRef.current.filter((item) => item.id !== itemId)
    sceneQueueRef.current = sceneQueueRef.current.filter((item) => item.id !== itemId)
  }, [])

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
                    ...latestItem,
                    scenes,
                    sceneState: 'ready',
                    sceneError: null,
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
                    ...latestItem,
                    sceneState: 'error',
                    sceneError: 'Не удалось определить смены сцен.',
                  }
                : latestItem,
            ),
          )
        })
        .finally(() => {
          sceneControllersRef.current.delete(item.id)
          activeSceneIdsRef.current.delete(item.id)
          if (isMountedRef.current) {
            pumpSceneQueue()
          }
        })
    }
  }, [onBackendConnectionChange, updateItems])

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
              ...latestItem,
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
                    ...latestItem,
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
                    ...latestItem,
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

  useEffect(() => () => {
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

    for (const item of itemsRef.current) {
      URL.revokeObjectURL(item.objectUrl)
    }
  }, [clearQueuedMediaWork])

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList)

    updateItems((currentItems) => {
      const existingKeys = new Set(currentItems.map((item) => (
        getDuplicateKey(item.file)
      )))

      const nextItems = [...currentItems]
      const addedVideoItems: MediaItem[] = []

      for (const file of files) {
        const type = getMediaType(file)
        const duplicateKey = getDuplicateKey(file)

        if (!type || existingKeys.has(duplicateKey)) {
          continue
        }

        existingKeys.add(duplicateKey)

        const item: MediaItem = {
          id: createMediaId(file),
          file,
          filename: file.name,
          type,
          size: file.size,
          lastModified: file.lastModified,
          objectUrl: URL.createObjectURL(file),
          state: type === 'video' ? 'processing' : 'ready',
          metadata: null,
          error: null,
          previewState: type === 'video' ? 'idle' : 'ready',
          previews: null,
          previewError: null,
          sceneState: type === 'video' ? 'idle' : 'ready',
          scenes: null,
          sceneError: null,
        }

        nextItems.push(item)

        if (type === 'video') {
          addedVideoItems.push(item)
        }
      }

      if (!activeItemId && nextItems.length > 0) {
        setActiveItemId(nextItems[0].id)
      }

      for (const item of addedVideoItems) {
        const controller = new AbortController()
        metadataControllersRef.current.set(item.id, controller)

        void uploadVideoMetadata(item.file, controller.signal)
          .then((metadata) => {
            updateItems((latestItems) =>
              latestItems.map((latestItem) =>
                latestItem.id === item.id
                  ? {
                      ...latestItem,
                      metadata,
                      state: 'ready',
                      error: null,
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
                      ...latestItem,
                      state: 'error',
                      error:
                        'Не удалось прочитать метаданные. Файл можно оставить в библиотеке.',
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

      return nextItems
    })
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
    addFiles,
    selectItem,
    removeItem,
    clearLibrary,
  }
}
