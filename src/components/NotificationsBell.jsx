import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellRing, CheckCheck, Megaphone, CalendarDays, BarChart3, BadgeCheck, Info, ClipboardCheck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { supabase, SUPABASE_ENABLED } from '../supabase'
import { timeAgo } from '../lib/format'

const KIND_ICON = {
  announcement: Megaphone,
  event: CalendarDays,
  poll: BarChart3,
  attendance: BadgeCheck,
  mention: Info,
  clearance: ClipboardCheck,
  system: Info,
}

const KIND_LINK = {
  announcement: '/app/feed#announcements',
  event: '/app/events',
  poll: '/app/feed',
  attendance: '/app/events',
  mention: '/app/feed',
  clearance: '/app/idcard',
  system: '/app',
}

export default function NotificationsBell() {
  const { user, toast } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState([])
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const boxRef = useRef(null)

  const load = async () => {
    const { list, unread } = await api.getNotifications()
    setList(list)
    setUnread(unread)
    setLoaded(true)
  }

  useEffect(() => {
    if (!user) return
    load().catch(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!user || !SUPABASE_ENABLED) return
    const channel = supabase
      .channel(`notifs-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new
          if (!n) return
          setList((l) => [n, ...l].slice(0, 30))
          setUnread((u) => u + 1)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const markRead = async (id) => {
    setList((l) => l.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)))
    setUnread((u) => Math.max(0, u - 1))
    try {
      await api.markNotificationRead(id)
    } catch {
      /* keep local state */
    }
  }

  const markAll = async () => {
    setList((l) => l.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })))
    setUnread(0)
    try {
      await api.markAllNotificationsRead()
      toast('All notifications marked as read')
    } catch {
      /* keep local state */
    }
  }

  const openNotification = async (n) => {
    markRead(n.id)
    setOpen(false)
    navigate(n.link || KIND_LINK[n.kind] || '/app')
  }

  if (!user) return null

  const Icon = unread > 0 ? BellRing : Bell

  return (
    <div className="notif-wrap" ref={boxRef}>
      <button
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        title="Notifications"
      >
        <Icon size={19} />
        {unread > 0 && <span className="notif-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <h3>Notifications</h3>
            {unread > 0 && (
              <button className="notif-mark" onClick={markAll}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <div className="notif-list">
            {loaded && list.length === 0 && (
              <p className="panel-muted" style={{ padding: 18, textAlign: 'center' }}>
                Nothing yet — announcements and event updates land here.
              </p>
            )}
            {!loaded && <div className="typing" style={{ justifyContent: 'center', padding: 18 }}><i /><i /><i /></div>}
            {list.map((n) => {
              const NIcon = KIND_ICON[n.kind] || Info
              return (
                <button
                  key={n.id}
                  className={`notif-item${n.read_at ? '' : ' notif-item--unread'}`}
                  onClick={() => openNotification(n)}
                >
                  <span className="notif-ic"><NIcon size={15} /></span>
                  <span className="notif-txt">
                    <b>{n.title}</b>
                    {n.body && <span>{n.body}</span>}
                    <em>{timeAgo(n.created_at)}</em>
                  </span>
                  {!n.read_at && <span className="notif-new" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}