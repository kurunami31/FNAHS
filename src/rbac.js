import { useApp } from './context/AppContext'

/* ============================================================
   FNAHS RBAC — single source of truth for roles, positions,
   and the permission scopes that map to them.
   UI hides (useCan), route guards and server-side RPCs all
   read from these same tables.
   ============================================================ */

export const ROLES = {
  student: 'Student',
  moderator: 'Moderator',
  superadmin: 'Superadmin',
}

export const POSITION_LABELS = {
  governor: 'Governor',
  'v-governor': 'Vice Governor',
  pio: 'P.I.O',
  'assoc-pio': 'Assoc. P.I.O',
  'v-gov-internal': 'V-Gov (Internal)',
  'v-gov-external': 'V-Gov (External)',
  secretary: 'Secretary',
  'assoc-secretary': 'Assoc. Secretary',
  treasurer: 'Treasurer',
  'assoc-treasurer': 'Assoc. Treasurer',
  auditor: 'Auditor',
  'assoc-auditor': 'Assoc. Auditor',
  'business-manager': 'Business Manager',
  'assoc-business-manager': 'Assoc. Business Manager',
  committees: 'Committees',
}

export const POSITIONS = Object.keys(POSITION_LABELS)

/* ------------------------------------------------------------
   Permission scopes
   ------------------------------------------------------------ */
export const SCOPE_LABELS = {
  'feed.post': 'Post on the feed',
  'feed.moderate': 'Moderate posts & comments',
  'announcements.post': 'Publish announcements',
  'events.manage': 'Create & manage events',
  'polls.manage': 'Manage event polls',
  'attendance.scan': 'Scan attendance at the door',
  'attendance.export': 'Export attendance & tallies',
  'members.edit': 'Edit member profiles & positions',
  'fees.view': 'See membership fee status',
  'fees.manage': 'Record membership fee payments',
  'console.access': 'Open the admin console',
  'directory.view': 'Browse the member directory',
  'settings.superadmin': 'Registrar: roles, positions, structure',
}

export const ROLE_SCOPES = {
  superadmin: ['*'],
  moderator: ['feed.moderate', 'directory.view', 'attendance.scan', 'fees.view'],
  student: [],
}

export const POSITION_SCOPES = {
  governor: [
    'feed.moderate',
    'announcements.post',
    'events.manage',
    'polls.manage',
    'attendance.scan',
    'attendance.export',
    'members.edit',
    'fees.view',
    'console.access',
    'directory.view',
  ],
  'v-governor': [
    'feed.moderate',
    'announcements.post',
    'events.manage',
    'polls.manage',
    'attendance.scan',
    'attendance.export',
    'members.edit',
    'fees.view',
    'console.access',
    'directory.view',
  ],
  pio: ['announcements.post', 'events.manage', 'feed.moderate'],
  'assoc-pio': ['announcements.post', 'feed.moderate'],
  'v-gov-internal': ['announcements.post', 'events.manage', 'attendance.scan'],
  'v-gov-external': ['announcements.post', 'events.manage', 'attendance.scan'],
  secretary: ['announcements.post', 'events.manage', 'attendance.scan', 'members.edit', 'fees.view', 'console.access', 'directory.view'],
  'assoc-secretary': ['events.manage', 'attendance.scan'],
  treasurer: ['events.manage', 'attendance.scan', 'attendance.export', 'fees.view', 'fees.manage', 'console.access', 'directory.view'],
  'assoc-treasurer': ['attendance.scan', 'attendance.export', 'fees.view', 'fees.manage'],
  auditor: ['feed.moderate', 'attendance.export', 'fees.view', 'fees.manage', 'console.access', 'directory.view'],
  'assoc-auditor': ['attendance.export'],
  'business-manager': ['events.manage', 'attendance.scan', 'attendance.export', 'fees.view', 'fees.manage', 'console.access', 'directory.view'],
  'assoc-business-manager': ['attendance.scan'],
  committees: [],
}

const SUPERADMIN_ONLY = ['settings.superadmin']

/* ------------------------------------------------------------
   Tool cards — what each permission unlocks, for the Home
   "Your Tools" grid. Route is where the tool lives in the app.
   ------------------------------------------------------------ */
export const TOOLS = {
  'feed.moderate': { label: 'Moderation desk', desc: 'Pin, hide & remove feed posts', route: '/app/feed' },
  'announcements.post': { label: 'Announcements', desc: 'Publish org bulletins', route: '/app' },
  'events.manage': { label: 'Events', desc: 'Create & manage events', route: '/app/events' },
  'polls.manage': { label: 'Event polls', desc: 'Run polls on events', route: '/app/events' },
  'attendance.scan': { label: 'Door scanner', desc: 'Scan attendance at the door', route: '/app/staff' },
  'attendance.export': { label: 'Attendance export', desc: 'Export rosters & tallies', route: '/app/staff' },
  'members.edit': { label: 'Member records', desc: 'Edit profiles & positions', route: '/app/admin' },
  'fees.view': { label: 'Fee status', desc: 'See membership fee standing', route: '/app/admin' },
  'fees.manage': { label: 'Fee ledger', desc: 'Record membership payments', route: '/app/admin' },
  'console.access': { label: 'Admin console', desc: 'Full org management', route: '/app/admin' },
  'directory.view': { label: 'Directory', desc: 'Browse member profiles', route: '/app/directory' },
  'settings.superadmin': { label: 'Registrar', desc: 'Roles, positions, structure', route: '/app/admin' },
}

export function toolsFor(user) {
  if (!user) return []
  const scopes = scopesFor(user)
  const active = scopes.includes('*') ? Object.keys(TOOLS) : scopes
  return active.filter((s) => TOOLS[s]).map((s) => ({ id: s, ...TOOLS[s] }))
}

/* ------------------------------------------------------------
   Resolution helpers
   ------------------------------------------------------------ */
export function scopesFor(user) {
  if (!user) return []
  const fromRole = ROLE_SCOPES[user.role] || []
  if (fromRole.includes('*')) return ['*']
  const fromPositions = (user.positions || [])
    .filter((p) => POSITION_SCOPES[p])
    .flatMap((p) => POSITION_SCOPES[p])
  return Array.from(new Set([...fromRole, ...fromPositions]))
}

export function can(user, scope) {
  if (!user) return false
  const scopes = scopesFor(user)
  if (scopes.includes('*')) return scope === 'settings.superadmin' ? user.role === 'superadmin' : true
  if (SUPERADMIN_ONLY.includes(scope)) return user.role === 'superadmin'
  return scopes.includes(scope)
}

export function canAny(user, scopes) {
  return scopes.some((s) => can(user, s))
}

export function useCan() {
  const { user } = useApp()
  return (scope) => can(user, scope)
}

export function positionLabel(position) {
  return POSITION_LABELS[position] || position
}

export function roleLabel(role) {
  return ROLES[role] || role || 'Member'
}
