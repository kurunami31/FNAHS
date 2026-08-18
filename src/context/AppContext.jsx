import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { onStatus, flushQueue } from '../lib/offline'
import { ORG_FULL } from '../lib/mock'

const AppContext = createContext(null)

const THEME_KEY = 'fnahs-theme'

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light')
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [toasts, setToasts] = useState([])
  const [maintenance, setMaintenance] = useState(false)
  const [online, setOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  // Connectivity + pending changes. The offline engine flushes the queue
  // automatically when the connection returns; the banner offers a manual
  // "Sync now" too.
  useEffect(() => {
    return onStatus(({ online: o, pending }) => {
      setOnline(o)
      setPendingCount(pending)
    })
  }, [])

  const toast = useCallback((message, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  // Toast fired when the offline engine finishes a queue flush.
  useEffect(() => {
    const onSynced = (e) => {
      const n = e?.detail?.count || 0
      if (!n) return
      toast(`Back online — ${n} change${n === 1 ? '' : 's'} synced`)
    }
    window.addEventListener('fnahs:synced', onSynced)
    return () => window.removeEventListener('fnahs:synced', onSynced)
  }, [toast])

  const syncNow = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await flushQueue()
    } finally {
      setSyncing(false)
    }
  }, [syncing])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#faf7ee')
  }, [theme])

  // Maintenance mode is an admin-toggled flag in the database. Read it on
  // boot and re-poll so users get bounced to the maintenance screen shortly
  // after an officer flips it on.
  const refreshMaintenance = useCallback(async () => {
    try {
      const on = await api.getMaintenance()
      setMaintenance(!!on)
    } catch (e) {
      console.warn('Could not read maintenance flag:', e)
    }
  }, [])

  useEffect(() => {
    refreshMaintenance()
    const id = setInterval(refreshMaintenance, 60_000)
    return () => clearInterval(id)
  }, [refreshMaintenance])

  const setMaintenanceFlag = useCallback(async (on) => {
    await api.setMaintenance(on)
    setMaintenance(!!on)
    return !!on
  }, [])

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

  const login = useCallback(
    async (email, password) => {
      const res = await api.signIn(email, password)
      if (res?.mfa) return res
      setUser(res.user)
      return res.user
    },
    []
  )

  const finishMfa = useCallback(async (factorId, code) => {
    const user = await api.mfaSignIn(factorId, code)
    setUser(user)
    return user
  }, [])

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

  // Single-session guard: signing in on another device invalidates this
  // session server-side. Poll is_latest_session and force a sign-out with
  // a notice the moment this device is no longer the newest one.
  useEffect(() => {
    if (!user) return
    let alive = true
    const check = async () => {
      try {
        const latest = await api.isLatestSession()
        if (!alive || latest) return
        await api.signOut().catch(() => {})
        if (!alive) return
        setUser(null)
        toast('You were signed out — your account was used on another device.', 'err')
      } catch {
        /* transient failure — retry on the next tick */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    const t = setInterval(check, 30_000)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(t)
    }
  }, [user, toast])

  const value = useMemo(
    () => ({
      theme,
      setTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      user,
      setUser,
      authLoading,
      maintenance,
      setMaintenanceFlag,
      toasts,
      toast,
      login,
      finishMfa,
      signup,
      logout,
      refreshUser,
      isDemo: !api.isSupabase,
      orgFull: ORG_FULL,
      online,
      pendingCount,
      syncing,
      syncNow,
    }),
    [theme, user, authLoading, maintenance, setMaintenanceFlag, toasts, toast, login, finishMfa, signup, logout, refreshUser, online, pendingCount, syncing, syncNow]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}
