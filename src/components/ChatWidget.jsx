import { useEffect, useRef, useState } from 'react'
import { Stethoscope, User, Send, Sparkles, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { SUGGESTIONS } from '../lib/mock'

export default function ChatWidget() {
  const { user, isDemo } = useApp()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content: `Hello! I'm Florence, the ${isDemo ? 'demo ' : ''}AI assistant of the Faculty of Nursing and Allied Health Sciences — named after the lady with the lamp. Ask me about study plans, clinical skills, medications, or org info. 🩺`,
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const logRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const openHandler = () => setOpen(true)
    window.addEventListener('florence:open', openHandler)
    return () => window.removeEventListener('florence:open', openHandler)
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
    if (open && !busy) inputRef.current?.focus()
    const last = messages[messages.length - 1]
    if (!open && last?.role === 'bot' && last.content && messages.length > 1) setUnread(true)
  }, [messages, open, busy])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setInput('')
    setBusy(true)
    setMessages((m) => [...m, { role: 'user', content }, { role: 'bot', content: '' }])
    try {
      await api.aiChat({
        messages: [...messages, { role: 'user', content }],
        onChunk: (chunk) =>
          setMessages((m) => {
            const next = [...m]
            next[next.length - 1] = { role: 'bot', content: next[next.length - 1].content + chunk }
            return next
          }),
      })
    } finally {
      setBusy(false)
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const toggle = () => {
    setOpen((o) => !o)
    setUnread(false)
  }

  return (
    <>
      <button
        className="chat-fab"
        onClick={toggle}
        aria-label={open ? 'Close Florence chat' : 'Open Florence chat'}
        aria-expanded={open}
        title="Florence — AI assistant"
      >
        {open ? <X size={24} /> : <Stethoscope size={24} />}
        {!open && unread && <span className="chat-fab-dot" />}
      </button>

      {open && (
        <div className="chat-panel" role="dialog" aria-label="Florence AI chat">
          <div className="chat-head">
            <span className="dot" />
            <div>
              <h2>Florence · FNAHS</h2>
              <div className="sub">{isDemo ? 'demo replies · ' : ''}assistant online · nursing & allied health</div>
            </div>
            <Sparkles size={18} style={{ color: 'var(--accent)' }} />
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={18} />
            </button>
          </div>

          <div className="chat-log" ref={logRef}>
            {messages.map((m, i) => (
              <div key={i} className={`msg msg--${m.role}`}>
                <div className="msg-avatar">
                  {m.role === 'bot' ? (
                    <Stethoscope size={17} />
                  ) : user?.avatar_url ? (
                    <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <User size={17} />
                  )}
                </div>
                <div className="msg-bubble">
                  {m.content}
                  {busy && i === messages.length - 1 && m.content !== '' && <span className="stream-caret" />}
                </div>
              </div>
            ))}
            {busy && messages[messages.length - 1]?.content === '' && (
              <div className="msg msg--bot">
                <div className="msg-avatar"><Stethoscope size={17} /></div>
                <div className="typing"><i /><i /><i /></div>
              </div>
            )}
          </div>

          <div className="suggest-row">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="suggest-chip" disabled={busy} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>

          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Ask Florence anything…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
            />
            <button className="btn btn--primary" disabled={busy || !input.trim()} onClick={() => send()}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
