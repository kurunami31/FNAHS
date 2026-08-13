// FNAHS — Florence AI assistant edge function
//
// Deploy:
//   supabase functions deploy florence-ai
//   supabase secrets set OPENAI_API_KEY=gsk_...   (Groq)  or  sk-...  (OpenAI)
//
// Talks to any OpenAI-compatible chat API (OpenAI, Groq, DeepSeek, etc.).
// Keys starting with gsk_ are auto-routed to Groq with a Groq default model.
// Override with OPENAI_BASE_URL / OPENAI_MODEL if needed.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const SYSTEM_PROMPT = `You are Florence, the friendly AI assistant of FNAHS — the Faculty of Nursing and Allied Health Sciences student community platform (inspired by the CODEBYTERS "CODEX" community platform). You are named after Florence Nightingale, the founder of modern nursing.
Keep answers concise, practical, and study-focused. You help nursing and allied health students with:
- study plans (NCLEX, board exams, finals)
- clinical skills (vital signs, ECG, meds, assessments)
- medication safety and nursing considerations
- general org questions about the community platform
Be warm but professional. Use short markdown (bold, lists). Never invent drug doses or give medical advice that could be dangerous; when unsure, recommend consulting clinical instructors or official references.`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ reply: "Florence's brain isn't wired up yet — ask a staff member to set the OPENAI_API_KEY secret. 🧠" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 700,
      }),
    })

    if (!upstream.ok) {
      const detail = await upstream.text()
      console.error('upstream error', upstream.status, detail)
      return new Response(JSON.stringify({ error: 'upstream failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const json = await upstream.json()
    const reply = json.choices?.[0]?.message?.content?.trim() || '…'

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('florence-ai error', err)
    return new Response(JSON.stringify({ error: 'internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
