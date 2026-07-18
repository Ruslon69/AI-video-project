import { useEffect, useState } from 'react'

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
  validate: (value: unknown) => T,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const storedValue = window.localStorage.getItem(key)

      if (!storedValue) {
        return initialValue
      }

      return validate(JSON.parse(storedValue))
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage may be unavailable in private browsing or restricted contexts.
    }
  }, [key, value])

  return [value, setValue] as const
}
