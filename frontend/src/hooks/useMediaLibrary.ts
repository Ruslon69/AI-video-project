import { useEffect, useMemo, useRef, useState } from 'react'
import { uploadVideoMetadata } from '../services/api'
import type { MediaItem, MediaType } from '../types'

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

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeItemId) ?? null,
    [activeItemId, items],
  )

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => () => {
    for (const item of itemsRef.current) {
      URL.revokeObjectURL(item.objectUrl)
    }
  }, [])

  const addFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList)

    setItems((currentItems) => {
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
        void uploadVideoMetadata(item.file)
          .then((metadata) => {
            setItems((latestItems) =>
              latestItems.map((latestItem) =>
                latestItem.id === item.id
                  ? { ...latestItem, metadata, state: 'ready', error: null }
                  : latestItem,
              ),
            )
            onBackendConnectionChange(true)
          })
          .catch(() => {
            setItems((latestItems) =>
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
            onBackendConnectionChange(false)
          })
      }

      return nextItems
    })
  }

  const selectItem = (itemId: string) => {
    setActiveItemId(itemId)
  }

  const removeItem = (itemId: string) => {
    setItems((currentItems) => {
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
  }

  const clearLibrary = () => {
    setItems((currentItems) => {
      for (const item of currentItems) {
        URL.revokeObjectURL(item.objectUrl)
      }

      return []
    })
    setActiveItemId(null)
  }

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
