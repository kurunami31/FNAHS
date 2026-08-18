// FNAHS — Florence AI assistant edge function
//
// Deploy:
//   supabase functions deploy florence-ai
//   supabase secrets set OPENAI_API_KEY=gsk_...   (Groq)  or  sk-...  (OpenAI)
//   supabase secrets set FLORENCE_ORIGINS=https://your-site.example   (comma-separated)
//
// Talks to any OpenAI-compatible chat API (OpenAI, Groq, DeepSeek, etc.).
// Keys starting with gsk_ are auto-routed to Groq with a Groq default model.
// Override with OPENAI_BASE_URL / OPENAI_MODEL if needed.
//
// Security: caller must be an authenticated FNAHS user (JWT), requests are
// rate-limited (bump_rate), input is size-capped, client messages are forced
// to user/assistant roles, and CORS is restricted to FLORENCE_ORIGINS.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('FLORENCE_ORIGINS') || Deno.env.get('SUPABASE_URL') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
)

const SYSTEM_PROMPT = `You are Florence, the friendly AI assistant of FNAHS — the Faculty of Nursing and Allied Health Sciences student community platform. You are named after Florence Nightingale, the founder of modern nursing.
Keep answers concise, practical, and study-focused. You help nursing and allied health students with:
- study plans (NCLEX, board exams, finals)
- clinical skills (vital signs, ECG, meds, assessments)
- medication safety and nursing considerations
- general org questions about the community platform
Be warm but professional. Never invent drug doses or give medical advice that could be dangerous; when unsure, recommend consulting clinical instructors or official references.

FORMATTING RULES — IMPORTANT:
- The app renders your replies as plain text in a chat bubble. There is NO markdown renderer.
- Never use markdown syntax: no asterisks, no bold, no italics, no bullet dashes, no headers, no backticks.
- For lists, use numbered steps written as plain sentences ("1. ...", "2. ...") or short lines separated by newlines.
- Do not use arrows (-> or →) or emoji unless asked.`

const baseHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin || 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
})

const json = (body: unknown, status = 200, origin = '') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...baseHeaders(origin), 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || ''
  const browserRequest = origin !== ''
  if (browserRequest && !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: 'origin not allowed' }, 403, origin)
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: baseHeaders(origin) })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return json({ error: 'unauthorized' }, 401, origin)
    }

    // Rate limit: 20 calls per minute per user (Postgres-backed, via service role).
    const { data: allowed, error: rateError } = await supabase.rpc('bump_rate', {
      p_bucket: `florence:${user.id}`,
      p_max: 20,
      p_window_minutes: 1,
    })
    if (rateError || allowed === false) {
      return json({ error: 'rate limited — slow down' }, 429, origin)
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return json({ error: 'json body required' }, 415, origin)
    }

    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 24) {
      return json({ error: 'messages required (1–24)' }, 400, origin)
    }

    // Only user/assistant roles pass through — never trust a client-supplied system prompt.
    const clean = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({ role: m.role, content: String(m.content ?? '').slice(0, 4000) }))
    if (clean.length === 0) {
      return json({ error: 'no usable messages' }, 400, origin)
    }
    const totalChars = clean.reduce((n, m) => n + m.content.length, 0)
    if (totalChars > 16000) {
      return json({ error: 'payload too large' }, 413, origin)
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return json(
        { reply: "Florence's brain isn't wired up yet — ask a staff member to set the OPENAI_API_KEY secret." },
        200,
        origin
      )
    }

    // gsk_ keys are Groq — route them automatically.
    const isGroq = apiKey.startsWith('gsk_')
    const base = Deno.env.get('OPENAI_BASE_URL') || (isGroq ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1')
    const model = Deno.env.get('OPENAI_MODEL') || (isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini')

    const upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...clean],
        max_tokens: 700,
      }),
    })

    if (!upstream.ok) {
      const detail = await upstream.text()
      console.error('upstream error', upstream.status, detail)
      return json({ error: 'upstream failed' }, 502, origin)
    }

    const out = await upstream.json()
    const reply = out.choices?.[0]?.message?.content?.trim()?.slice(0, 2000) || '…'

    return json({ reply }, 200, origin)
  } catch (err) {
    console.error('florence-ai error', err)
    return json({ error: 'internal error' }, 500, origin)
  }
})
