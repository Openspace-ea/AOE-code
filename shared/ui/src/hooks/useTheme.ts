/**
 * useTheme Hook - 主题管理
 */

import { useState, useCallback } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface Theme {
  mode: ThemeMode
  colors: {
    primary: string
    secondary: string
    success: string
    warning: string
    danger: string
    background: string
    surface: string
    text: string
    textSecondary: string
  }
}

const lightTheme: Theme = {
  mode: 'light',
  colors: {
    primary: '#2563eb',
    secondary: '#6b7280',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textSecondary: '#6b7280',
  },
}

const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    primary: '#3b82f6',
    secondary: '#9ca3af',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    background: '#111827',
    surface: '#1f2937',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
  },
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('aoe-theme')
    return (saved as ThemeMode) || 'light'
  })

  const theme = mode === 'dark' ? darkTheme : lightTheme

  const toggleTheme = useCallback(() => {
    const newMode = mode === 'light' ? 'dark' : 'light'
    setMode(newMode)
    localStorage.setItem('aoe-theme', newMode)
  }, [mode])

  const setThemeMode = useCallback((newMode: ThemeMode) => {
    setMode(newMode)
    localStorage.setItem('aoe-theme', newMode)
  }, [])

  return {
    mode,
    theme,
    toggleTheme,
    setThemeMode,
    isDark: mode === 'dark',
  }
}
