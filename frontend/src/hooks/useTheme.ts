import { useEffect, useState } from 'react'
import type { ThemePreference } from '../types'

const themeKey = 'ai-video-director-theme'

function readThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(themeKey)

    if (value === 'light' || value === 'dark' || value === 'system') {
      return value
    }
  } catch {
    return 'system'
  }

  return 'system'
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function useTheme() {
  const [themePreference, setThemePreference] =
    useState<ThemePreference>(readThemePreference)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    getSystemTheme(),
  )

  const resolvedTheme =
    themePreference === 'system' ? systemTheme : themePreference

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    }

    handleChange()
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.dataset.themePreference = themePreference

    try {
      window.localStorage.setItem(themeKey, themePreference)
    } catch {
      // Ignore storage failures; theme still works for the current session.
    }
  }, [resolvedTheme, themePreference])

  return { themePreference, resolvedTheme, setThemePreference }
}
