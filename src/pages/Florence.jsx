import { useEffect, useRef, useState } from 'react'
import { Stethoscope, User, Send, Sparkles, Info } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { SUGGESTIONS } from '../lib/mock'

export default function Florence() {
  const { user, isDemo } = useApp()
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content: `Hello! I'm Florence, the ${isDemo ? 'demo ' : ''}AI assistant of the Faculty of Nursing and Allied Health Sciences — named after the lady with the lamp. Ask me about study plans, clinical skills, medications, or org info. 🩺`,
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const logRef = useRef(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

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

  return (
    <div>
      <h1 className="page-title">FLORENCE</h1>
      <p className="page-sub">The faculty's in-house AI assistant — named after Florence Nightingale.</p>

      {isDemo && (
        <div className="form-ok" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Info size={16} />
          Demo mode — replies use canned answers. Deploy the <code>florence-ai</code> edge function and add Supabase keys to go live.
        </div>
      )}

      <div className="chat-shell">
        <div className="chat-head">
          <span className="dot" />
          <div>
            <h2>Florence · FNAHS</h2>
            <div className="sub">assistant online · knowledge of nursing & allied health</div>
          </div>
          <Sparkles size={18} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />
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
    </div>
  )
}
