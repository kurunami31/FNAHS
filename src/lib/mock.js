export const ORG_NAME = 'FNAHS · PULSO'
export const ORG_SUB = 'Proactive and United Legion of Student nurses Organization'
export const ORG_FULL = 'Faculty of Nursing and Allied Health Sciences'
export const ORG_TAGLINE =
  'One community for the FNAHS squad — attend org events with a scan, keep up with students, learn from live feeds, and get help from Florence, the in-house AI assistant. Built for nursing and allied health students, by students.'

export const PROGRAMS = ['BS Nursing']

const now = Date.now()
const h = 3600e3
const d = 24 * h

export function seedProfiles() {
  return {
    demo: {
      id: 'demo',
      full_name: 'Juan Dela Cruz',
      email: 'student@fnahs.edu.ph',
      program: 'BS Nursing',
      year_level: '3',
      role: 'student',
      avatar_url: null,
      created_at: new Date(now - 30 * d).toISOString(),
    },
    staff: {
      id: 'staff',
      full_name: 'Maria Santos',
      email: 'staff@fnahs.edu.ph',
      program: 'Faculty',
      year_level: '—',
      role: 'moderator',
      avatar_url: null,
      created_at: new Date(now - 90 * d).toISOString(),
    },
    admin: {
      id: 'admin',
      full_name: 'FNAHS Administrator',
      email: 'fnahsadmin@fnahs.edu.ph',
      program: 'BS Nursing',
      year_level: '—',
      role: 'superadmin',
      avatar_url: null,
      created_at: new Date(now - 180 * d).toISOString(),
    },
  }
}

export function seedPosts() {
  return [
    {
      id: 'p1',
      user_id: 'demo',
      content:
        'Reminder for all BSN students: the White Coat Ceremony is next Friday! Make sure your coats are pressed and your pins are ready. See you all there 🩺',
      image_url: null,
      created_at: new Date(now - 3 * h).toISOString(),
      likes: ['demo', 'staff'],
      comments: [
        { id: 'c1', user_id: 'staff', content: 'Can’t wait! Please be on time — 8:00 AM sharp at the auditorium.', created_at: new Date(now - 2 * h).toISOString() },
      ],
    },
    {
      id: 'p2',
      user_id: 'staff',
      content:
        'Shoutout to everyone who joined the Basic Life Support training yesterday! You all did an amazing job with the CPR drills. Certificates will be released within the week. 🎉',
      image_url: null,
      created_at: new Date(now - 26 * h).toISOString(),
      likes: ['demo'],
      comments: [],
    },
    {
      id: 'p3',
      user_id: 'demo',
      content:
        'Study tip of the day: the APGAR score — Appearance, Pulse, Grimace, Activity, Respiration. Rated 0–2 each, max of 10. Newborn assessment made easy 💡',
      image_url: null,
      created_at: new Date(now - 2 * d).toISOString(),
      likes: ['staff'],
      comments: [
        { id: 'c2', user_id: 'staff', content: 'This is gold. Add it to your clinical rotation notes!', created_at: new Date(now - 1.5 * d).toISOString() },
      ],
    },
    {
      id: 'p4',
      user_id: 'staff',
      content: 'Medical mission volunteers — final list is out. Check your names at the student lounge board or message the org page. Orientation is this Saturday, 9 AM.',
      image_url: null,
      created_at: new Date(now - 3 * d).toISOString(),
      likes: [],
      comments: [],
    },
  ]
}

export function seedEvents() {
  return [
    {
      id: 'e1',
      title: 'FNAHS General Assembly',
      description: 'State of the org address, officer reports, and plans for the semester. Attendance is required for all members.',
      location: 'Main Auditorium',
      starts_at: new Date(now + 3 * d).toISOString(),
      ends_at: new Date(now + 3 * d + 3 * h).toISOString(),
      created_by: 'staff',
      rsvps: { demo: 'going' },
    },
    {
      id: 'e2',
      title: 'Basic Life Support & First Aid Training',
      description: 'Hands-on CPR, AED, and choking response drills facilitated by certified instructors. Limited slots — sign up early!',
      location: 'Skills Lab 2',
      starts_at: new Date(now + 6 * d).toISOString(),
      ends_at: new Date(now + 6 * d + 6 * h).toISOString(),
      created_by: 'staff',
      rsvps: { demo: 'going' },
    },
    {
      id: 'e3',
      title: 'White Coat Ceremony',
      description: 'The traditional rite of passage for BSN students. Wear your white coat and nursing pin.',
      location: 'University Gymnasium',
      starts_at: new Date(now + 8 * d).toISOString(),
      ends_at: new Date(now + 8 * d + 4 * h).toISOString(),
      created_by: 'staff',
      rsvps: {},
    },
    {
      id: 'e4',
      title: 'Community Medical Mission',
      description: 'Free check-ups, blood pressure screening, and health education for the local barangay. Volunteers needed!',
      location: 'Barangay Hall, Poblacion',
      starts_at: new Date(now + 14 * d).toISOString(),
      ends_at: new Date(now + 14 * d + 8 * h).toISOString(),
      created_by: 'staff',
      rsvps: {},
    },
  ]
}

export function seedFeeds() {
  return {
    health: [
      { id: 'h1', title: 'WHO: hand hygiene remains the single most effective way to prevent infections', meta: 'who.int' },
      { id: 'h2', title: 'New guidance on antibiotic stewardship for community health workers', meta: 'health.policy' },
      { id: 'h3', title: 'Study links 30 minutes of daily activity to lower heart-disease risk', meta: 'med.news' },
      { id: 'h4', title: 'WHO publishes the 2026 global immunization coverage outlook', meta: 'who.int' },
    ],
    tips: [
      { id: 't1', title: 'Wash hands for 20 seconds — about the time it takes to hum “Happy Birthday” twice', meta: 'infection control' },
      { id: 't2', title: 'Take blood pressure with the cuff at heart level after 5 minutes of seated rest', meta: 'vital signs' },
      { id: 't3', title: 'Sleep 7–9 hours a night — immunity and memory consolidate while you rest', meta: 'wellness' },
      { id: 't4', title: 'Hydrate before you feel thirsty; mild dehydration already impairs focus', meta: 'hydration' },
    ],
    news: [
      {
        id: 'n1',
        title: 'WHO releases updated guidance on safe maternal and newborn care',
        url: 'https://www.who.int/news-room',
        source: 'WHO',
        created_at: new Date(now - 3 * h).toISOString(),
      },
      {
        id: 'n2',
        title: 'Global immunization drives restore coverage lost during the pandemic',
        url: 'https://www.who.int/news-room',
        source: 'WHO',
        created_at: new Date(now - 9 * h).toISOString(),
      },
      {
        id: 'n3',
        title: 'Study: nurse-led follow-up calls cut hospital readmission rates by a fifth',
        url: 'https://www.who.int/news-room',
        source: 'Nursing Times',
        created_at: new Date(now - 22 * h).toISOString(),
      },
      {
        id: 'n4',
        title: 'New antimicrobial resistance action plan announced for the Western Pacific',
        url: 'https://www.who.int/news-room',
        source: 'WHO',
        created_at: new Date(now - 30 * h).toISOString(),
      },
      {
        id: 'n5',
        title: 'Health workers urged to watch for heat-related illness as summers warm',
        url: 'https://www.who.int/news-room',
        source: 'WHO',
        created_at: new Date(now - 2 * d).toISOString(),
      },
    ],
  }
}

/* ---------------- mock AI ---------------- */

const AI_REPLIES = [
  {
    match: /nclex|board exam|study plan|review/i,
    reply: () =>
      `Here's a simple NCLEX-style study plan:\n\n1. **Content blocks** — group by system (cardio, neuro, pharm) and do one block per week.\n2. **Daily 30–50 practice questions** with rationales, not just answers.\n3. **Missed-question log** — revisit your wrong answers every 3 days.\n4. **Weekly full-length practice test** (75–145 questions, timed).\n5. **Rest**: sleep and short walks are part of the plan too.\n\nWant me to break this down by week, or focus on a specific subject?`,
  },
  {
    match: /blood pressure|bp|cuff|sphygmo/i,
    reply: () =>
      `Measuring BP correctly in 6 steps:\n\n1. Patient seated, feet flat, arm supported at heart level.\n2. No caffeine/smoking 30 min prior; rest 5 min first.\n3. Use the correct cuff size (bladder covers ~80% of arm circumference).\n4. Palpate the radial pulse, inflate 30 mmHg above where it disappears.\n5. Deflate slowly (~2 mmHg/sec), note first Korotkoff sound (systolic) and its disappearance (diastolic).\n6. Record to the nearest 2 mmHg.\n\nCommon error: cuff too small → falsely high reading. Always verify with the opposite arm on first visit.`,
  },
  {
    match: /ecg|ekg|electrocardiogram|heart rhythm/i,
    reply: () =>
      `ECG made simple — the 5 boxes:\n\n- **P wave**: atrial depolarization.\n- **PR interval** (0.12–0.20s): delay at the AV node.\n- **QRS** (<0.12s): ventricular depolarization.\n- **QT interval**: ventricular repolarization.\n- **T wave**: repolarization.\n\nRapid approach: rate → rhythm → axis → intervals → morphology. For the NCLEX, memorize normal values and the classic patterns: peaked T (hyperkalemia), prolonged QT (hypokalemia/drugs), ST elevation (MI).\n\nWant me to quiz you on rhythms?`,
  },
  {
    match: /drug|medication|pharm|dose|insulin|antibiotic/i,
    reply: () =>
      `A simple medication study framework — the "5 Rights + 2":\n\n1. Right patient  2. Right drug  3. Right dose  4. Right route  5. Right time\n+ Right documentation + Right to refuse.\n\nFor each drug, learn: class → mechanism → indication → side effects → nursing considerations. Example — **Metformin**: biguanide, ↓ hepatic glucose output, watch for lactic acidosis (renal impairment), hold before contrast imaging.\n\nName a drug you're reviewing and I'll break it down the same way.`,
  },
  {
    match: /hello|hi |hey|good (morning|afternoon|evening)/i,
    reply: () =>
      `Hello! 👋 I'm Florence, the FNAHS AI assistant — named after the lady with the lamp. I can help you with:\n\n- Study plans (NCLEX, board exams, finals)\n- Clinical skills refreshers (BP, ECG, meds, assessments)\n- Org info — events, attendance, the feed\n\nWhat do you need help with today?`,
  },
]

export const SUGGESTIONS = [
  'Explain ECG basics simply',
  'Give me a study plan for board exams',
  'How do I take blood pressure correctly?',
  'Tips for my first hospital duty',
]

export function mockAiReply(question) {
  const hit = AI_REPLIES.find((r) => r.match.test(question))
  return hit ? hit.reply(question) : `Good question about "${question.trim()}". I'm running in demo mode right now, so I'm using a canned response — once the Supabase edge function (florence-ai) is deployed with an API key, I'll answer from a real LLM.\n\nFor now, try asking about NCLEX study plans, blood pressure, ECG basics, or medication safety — those are the skills I've been trained on for FNAHS students. 🩺`
}

/** Simulates a streaming reply: yields chunks with delays. */
export async function streamMockReply(question, onChunk) {
  const text = mockAiReply(question)
  const chunks = text.match(/.{1,4}/gs) || []
  for (const c of chunks) {
    onChunk(c)
    await new Promise((r) => setTimeout(r, 18 + Math.random() * 26))
  }
}

export const DEMO_USER_ID = 'demo'
export const DEMO_STAFF_ID = 'staff'

export function seedAnnouncements() {
  const now = Date.now()
  const d = 86400e3
  return [
    {
      title: 'Welcome to the new FNAHS portal',
      body: 'Your digital ID, attendance records, and org announcements now live in one place. Keep your ID ready for event check-ins!',
      pinned: true,
      daysAgo: 2,
      created_at: new Date(now - 2 * d).toISOString(),
    },
    {
      title: 'Clinical duty schedules are out',
      body: 'Check the upcoming events tab for the latest duty rotation schedules. Contact the secretary if your name is missing.',
      pinned: false,
      daysAgo: 5,
      created_at: new Date(now - 5 * d).toISOString(),
    },
    {
      title: 'ID validation week',
      body: 'Stray cats and late registrants: bring your signed form to the student lounge, 8 AM–5 PM, all week.',
      pinned: false,
      daysAgo: 9,
      created_at: new Date(now - 9 * d).toISOString(),
    },
  ]
}

export function demoDb() {
  const profiles = seedProfiles()
  const posts = seedPosts()
  const events = seedEvents()
  const feeds = seedFeeds()
  const attendance = {}
  const membershipFees = {}
  return { profiles, posts, events, feeds, attendance, membershipFees }
}
