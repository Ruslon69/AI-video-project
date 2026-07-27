import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  uploadVideoMetadata,
  uploadVideoPreviews,
} from '../services/api'
import type { MediaFileRejection, MediaItem, MediaStatus, MediaType } from '../types'
import { getMediaIdentity, hasPlayableSource } from '../utils/mediaSource'
import { getMediaStatusProgress } from '../utils/mediaStatus'

const MAX_ACTIVE_PREVIEW_REQUESTS = 2
const FALLBACK_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'mkv'])

export type PersistedMediaLibraryItem = Readonly<{
  id: string
  filename: string
  type: MediaType
  size?: number
  lastModified?: number
}>

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

function createUnavailableMediaItem(
  item: PersistedMediaLibraryItem,
): MediaItem {
  return {
    id: item.id,
    file: null,
    filename: item.filename,
    type: item.type,
    size: item.size ?? 0,
    lastModified: item.lastModified ?? 0,
    objectUrl: '',
    status: 'unavailable',
    progress: getMediaStatusProgress('unavailable'),
    metadata: null,
    errorMessage: undefined,
    previewState: 'idle',
    previews: null,
    previewError: null,
    sceneState: 'idle',
    scenes: null,
    sceneError: null,
    transcriptionState: 'idle',
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
  const previewQueueRef = useRef<MediaItem[]>([])
  const queuedPreviewIdsRef = useRef(new Set<string>())
  const activePreviewIdsRef = useRef(new Set<string>())
  const pendingDuplicateKeysRef = useRef(new Set<string>())

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeItemId) ?? null,
    [activeItemId, items],
  )

  useEffect(() => {
    itemsRef.current = items

    for (const item of items) {
      pendingDuplicateKeysRef.current.delete(getMediaIdentity(item))
    }
  }, [items])

  const updateItems = useCallback((updater: (items: MediaItem[]) => MediaItem[]) => {
    if (!isMountedRef.current) {
      return
    }

    setItems(updater)
  }, [])

  const clearQueuedMediaWork = useCallback(() => {
    previewQueueRef.current = []
    queuedPreviewIdsRef.current.clear()
  }, [])

  const abortMediaWork = useCallback((itemId: string) => {
    metadataControllersRef.current.get(itemId)?.abort()
    metadataControllersRef.current.delete(itemId)
    previewControllersRef.current.get(itemId)?.abort()
    previewControllersRef.current.delete(itemId)
    queuedPreviewIdsRef.current.delete(itemId)
    previewQueueRef.current = previewQueueRef.current.filter((item) => item.id !== itemId)
  }, [])

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

	      const latestItem = itemsRef.current.find((currentItem) => currentItem.id === item.id)
	      const file = latestItem?.file

	      if (!file) {
	        activePreviewIdsRef.current.delete(item.id)
	        continue
	      }

	      const controller = new AbortController()
	      previewControllersRef.current.set(item.id, controller)

	      void uploadVideoPreviews(file, controller.signal)
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
                    ...applyMediaStatus(latestItem, 'ready'),
                    previews,
                    previewState: 'ready',
                    previewError: null,
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
  }, [onBackendConnectionChange, updateItems])

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
	      getMediaIdentity(item)
	    )))
	    const addedItems: MediaItem[] = []
	    const addedVideoItems: MediaItem[] = []
	    const reconnectedItems: MediaItem[] = []
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

	      const reconnectableItem = itemsRef.current.find((item) => (
	        getMediaIdentity(item) === duplicateKey && !hasPlayableSource(item)
	      ))

      if (reconnectableItem) {
        const objectUrl = URL.createObjectURL(file)

        if (reconnectableItem.objectUrl) {
          URL.revokeObjectURL(reconnectableItem.objectUrl)
        }

	      reconnectedItems.push({
	          ...reconnectableItem,
	          file,
	          objectUrl,
	          status: reconnectableItem.metadata ? 'ready' : 'uploading',
	          progress: reconnectableItem.metadata
	            ? getMediaStatusProgress('ready')
	            : getMediaStatusProgress('uploading'),
	          errorMessage: undefined,
        })
        existingKeys.add(duplicateKey)
        pendingDuplicateKeysRef.current.add(duplicateKey)
        continue
      }

      if (
        existingKeys.has(duplicateKey) ||
        pendingDuplicateKeysRef.current.has(duplicateKey)
      ) {
	        continue
	      }

      existingKeys.add(duplicateKey)

      const item = createMediaItem(file, type)
      addedItems.push(item)
      pendingDuplicateKeysRef.current.add(duplicateKey)

      if (type === 'video') {
        addedVideoItems.push(item)
      }
    }

    setFileRejections(rejectedFiles)

    if (addedItems.length === 0 && reconnectedItems.length === 0) {
      return []
	    }

	    updateItems((currentItems) => {
	      const reconnectedById = new Map(
	        reconnectedItems.map((item) => [item.id, item]),
	      )

	      return [
	        ...currentItems.map((item) => reconnectedById.get(item.id) ?? item),
	        ...addedItems,
	      ]
	    })

	    if (reconnectedItems.length > 0) {
	      setActiveItemId(reconnectedItems[0].id)
	    } else if (!activeItemId && itemsRef.current.length === 0) {
	      setActiveItemId(addedItems[0].id)
	    }

    for (const item of [
      ...addedVideoItems,
      ...reconnectedItems.filter((item) => (
        item.type === 'video' && item.metadata === null
      )),
    ]) {
	      const file = item.file

	      if (!file) {
	        continue
	      }

	      const controller = new AbortController()
	      metadataControllersRef.current.set(item.id, controller)

      updateItems((latestItems) =>
        latestItems.map((latestItem) =>
          latestItem.id === item.id
            ? applyMediaStatus(latestItem, 'metadata')
            : latestItem,
        ),
      )

	      void uploadVideoMetadata(file, controller.signal)
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

    return [...reconnectedItems, ...addedItems]
  }, [
    activeItemId,
    enqueuePreview,
    onBackendConnectionChange,
    updateItems,
  ])

  const selectItem = useCallback((itemId: string) => {
    setActiveItemId(itemId)
  }, [])

  const restorePersistedItems = useCallback((persistedItems: PersistedMediaLibraryItem[]) => {
    if (!persistedItems.length) {
      return
    }

    updateItems((currentItems) => {
      const knownIds = new Set(currentItems.map((item) => item.id))
      const missingItems = persistedItems
        .filter((item) => !knownIds.has(item.id))
        .map(createUnavailableMediaItem)

      return missingItems.length
        ? [...currentItems, ...missingItems]
        : currentItems
    })
  }, [updateItems])

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
    restorePersistedItems,
    selectItem,
    removeItem,
    clearLibrary,
  }
}
