# FNAHS · Community Platform

A community platform for the **Faculty of Nursing and Allied Health Sciences**, built in the style of [bsitcodex.vercel.app](https://bsitcodex.vercel.app) (CODEX · CODEBYTERS) — rebranded with the FNAHS logo and a blue/magenta palette drawn from it.

> One terminal for the FNAHS squad — attend org events with a scan, keep up with students, learn from live feeds, and get help from Florence, the in-house AI assistant.

## Features

- **Home** — terminal-style welcome hero with the FNAHS logo, live Hacker News / GitHub / org-event feeds
- **Feed** — org posts with likes, comments, image attachments, archive & delete, search
- **Events** — upcoming org events with RSVP and event creation
- **Florence** — the org's in-house AI assistant, named after Florence Nightingale (chat with streaming replies)
- **My ID** — digital student ID card with a QR code, scannable at events
- **Staff tools** — camera-based QR scanner to log event attendance
- **Settings** — profile, program/year level, dark/light theme
- Dark terminal theme by default, light theme toggle, PWA-ready

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
```

**Demo mode:** without any env vars the app runs fully in the browser with seed data (localStorage). Any email + password logs in (`staff@fnahs.edu.ph` gives a staff account).

## Go live with Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the SQL Editor.
3. Create `.env.local` (see `.env.example`) with your project URL + anon key.
4. Promote a staff account: `update public.profiles set role = 'staff' where id = '<user id>';`

## Florence (AI assistant)

1. `npx supabase init && npx supabase functions deploy florence-ai`
2. Set the LLM provider key:
   - **Groq** (recommended — fast, free tier): `npx supabase secrets set OPENAI_API_KEY=gsk_...` — a `gsk_` key is auto-routed to Groq with `llama-3.3-70b-versatile`.
   - **OpenAI**: `npx supabase secrets set OPENAI_API_KEY=sk-...` (default model `gpt-4o-mini`).
   - Optional overrides: `OPENAI_BASE_URL` and `OPENAI_MODEL` for any other OpenAI-compatible API.
3. Until the function is deployed, the chat falls back to built-in demo replies so the UI always works.

## Stack

React 19 · Vite 6 · Supabase (auth, Postgres + RLS, Edge Functions) · lucide-react · qrcode.react · html5-qrcode · vite-plugin-pwa

Fonts mirror the original's look: Press Start 2P (display), Archivo Black (IDs), Share Tech Mono (mono), Inter (body).
