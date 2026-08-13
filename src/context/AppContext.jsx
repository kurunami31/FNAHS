import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { ORG_FULL } from '../lib/mock'

const AppContext = createContext(null)

const THEME_KEY = 'fnahs-codex-theme'

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#081021' : '#ffffff')
  }, [theme])

  useEffect(() => {
    let alive = true
    api
      .getSession()
      .then(({ user: u }) => alive && setUser(u))
      .catch(() => {})
      .finally(() => alive && setAuthLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const toast = useCallback((message, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const login = useCallback(
    async (email, password) => {
      const { user: u } = await api.signIn(email, password)
      setUser(u)
      return u
    },
    []
  )

  const signup = useCallback(async (name, email, password) => {
    const res = await api.signUp(name, email, password)
    if (!res.needsConfirmation) setUser(res.user)
    return res
  }, [])

  const logout = useCallback(async () => {
    await api.signOut()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const { user: u } = await api.getSession()
    setUser(u)
    return u
  }, [])

  const value = useMemo(
    () => ({
      theme,
      setTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      user,
      setUser,
      authLoading,
      toasts,
      toast,
      login,
      signup,
      logout,
      refreshUser,
      isDemo: !api.isSupabase,
      orgFull: ORG_FULL,
    }),
    [theme, user, authLoading, toasts, toast, login, signup, logout, refreshUser]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}
