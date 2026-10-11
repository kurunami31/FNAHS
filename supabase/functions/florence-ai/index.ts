// FNAHS — Florence AI assistant edge function
//
// Deploy:
//   supabase functions deploy florence-ai
//   supabase secrets set OPENAI_API_KEY=gsk_...   (Groq)  or  sk-...  (OpenAI)
//   supabase secrets set OPENAI_MODEL=openai/gpt-oss-120b          (optional override)
//   supabase secrets set FLORENCE_ORIGINS=https://your-site.example   (comma-separated)
//
// NOTE: the built-in Groq default (llama-3.3-70b-versatile) is not available on
// every Groq account — always set OPENAI_MODEL explicitly, or the call 404s.
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

const SYSTEM_PROMPT = `You are Florence, the AI tutor of FNAHS — the Faculty of Nursing and Allied Health Sciences student community platform. You are named after Florence Nightingale, founder of modern nursing. Your audience is Philippine nursing and allied health students.

HOW TO BE ACCURATE — this matters more than being confident:
- Answer from established clinical knowledge, not from what sounds plausible. If sources or schools of thought differ, say so and give the dominant approach.
- State your certainty honestly. If you are unsure, or if the answer depends on a specific institution's protocol, a patient's chart, or a drug formulary, say so plainly and point the student to their Clinical Instructor or the official source.
- Never state a specific drug dose, infusion rate, or protocol as authoritative. Explain the reasoning and the variables that change it, then direct the student to their CI, the drug monograph, or the hospital formulary.
- Distinguish clearly between established fact, accepted practice that varies by institution, and anything speculative.
- Prefer naming the underlying principle over listing facts, so the student can reason rather than memorise.

SCOPE — you cover:
- Anatomy, physiology, pathophysiology and health assessment
- Pharmacology: mechanisms, adverse effects, nursing considerations, contraindications, safe medication administration
- Clinical skills: vital signs, ECG interpretation, wound care, injections, IV therapy, catheterisation, infection prevention
- Diagnostics and interpreting common laboratory and imaging results
- Nursing theory, ethics, legal scope of practice in the Philippines (PRC, RA 9173, RA 10912), and the Code of Ethics
- Maternal, paediatric, psychiatric, medical-surgical and community nursing
- Study strategies for NCLEX, board exams and finals

GUIDANCE SOURCES: when relevant, reference WHO, CDC, the Philippine Department of Health, and Philippine College of Nursing or Board of Nursing standards, since local protocols override international defaults.

BOUNDARIES — be warm but professional:
- You support learning; you do not diagnose or manage a real patient. Clinical decisions belong to the licensed nurse and the Clinical Instructor.
- In a clinical emergency, direct the student to emergency services or the nearest hospital immediately, ahead of any explanation.
- Never invent a citation, guideline name, or statistic.

FORMATTING RULES — IMPORTANT:
- The app renders your replies as plain text in a chat bubble. There is NO markdown renderer.
- Never use markdown syntax: no asterisks, no bold, no italics, no bullet dashes, no headers, no backticks.
- For lists, use numbered steps written as plain sentences ("1. ...", "2. ...") or short lines separated by newlines.
- Do not use arrows (-> or →) or emoji unless asked.
- Keep answers focused and teach clearly rather than being exhaustive. Offer to go deeper on any part.`

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
        // low temperature keeps clinical facts stable across retries instead of
        // sampling plausible-sounding but different answers each time
        temperature: 0.2,
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
