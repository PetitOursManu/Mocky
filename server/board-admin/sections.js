// Mocky's admin, described for Kosmy Board (protocol kosmy.board-admin.v1).
//
// Every section is a VIEW of what Admin's own screens read, and every action
// calls the function Admin's own route calls (server/index.js, the dashboard
// router, the MCP routes) — the same checks, the same side effects, the same
// audit line, with `via: 'kosmy-board'` added to its detail. Nothing here
// decides anything Admin does not already decide: the Board only transmits, so
// every value it sends back is checked again below as if it came from a stranger.
//
// What the protocol cannot carry stays in the app, and each section that has
// such parts says so in a notice: provider settings and their keys, the price
// table, Muse's sources, Motion Ultra's allowlist, the MCP switch and its
// runner, the server migration, an administrator's own "test the free plan".
//
// Never a secret: no password, hash, key, token or client secret leaves here.
// A password Mocky GENERATES for an account goes back once, as a `reveal`.

import crypto from 'node:crypto'
import { MAX_DAILY_LIMIT } from '../plan.js'

/** The order of the Board's menu; the first opens with the admin. */
export const SECTION_IDS = [
  'overview',
  'users',
  'sessions',
  'access',
  'announcement',
  'maintenance',
  'activity',
  'spend',
  'assistants',
  'providers',
  'audit',
]

const TITLES = {
  overview: 'overview.title',
  users: 'users.title',
  sessions: 'sessions.title',
  access: 'access.title',
  announcement: 'announce.title',
  maintenance: 'maint.title',
  activity: 'activity.title',
  spend: 'spend.title',
  assistants: 'mcp.title',
  providers: 'providers.title',
  audit: 'audit.title',
}

/** The protocol's ceiling per table. */
const MAX_ROWS = 500
const MIN_PASSWORD = 8

/** A refusal the Board shows as is: `{ error: code, message }` with `status`. */
export class BoardAdminError extends Error {
  constructor(status, code, message) {
    super(message || code)
    this.status = status
    this.code = code
    this.userMessage = message
  }
}

/* ---------- formatting: the Board shows text, so the words are made here ---------- */

function formatters(lang) {
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const num = new Intl.NumberFormat(locale)
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'medium' })
  const units = lang === 'en' ? ['B', 'KB', 'MB', 'GB', 'TB'] : ['o', 'Ko', 'Mo', 'Go', 'To']
  return {
    num: (n) => (typeof n === 'number' && Number.isFinite(n) ? num.format(n) : null),
    date: (ms) => (typeof ms === 'number' && ms > 0 ? date.format(new Date(ms)) : null),
    day: (ms) => (typeof ms === 'number' && ms > 0 ? day.format(new Date(ms)) : null),
    time: (ms) => (typeof ms === 'number' && ms > 0 ? time.format(new Date(ms)) : null),
    bytes(n) {
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null
      let i = 0
      let v = n
      while (v >= 1024 && i < units.length - 1) (v /= 1024), i++
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: v < 10 && i ? 1 : 0 }).format(v)} ${units[i]}`
    },
    ms(n) {
      if (typeof n !== 'number' || !Number.isFinite(n)) return null
      if (n < 1000) return `${Math.round(n)} ms`
      if (n < 60_000) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n / 1000)} s`
      return `${Math.floor(n / 60_000)} min ${Math.round((n % 60_000) / 1000)} s`
    },
    usd: (n) =>
      typeof n === 'number' && Number.isFinite(n)
        ? new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: n < 1 ? 4 : 2 }).format(n)
        : null,
  }
}

const cell = (text, tone) => (tone ? { text: String(text), tone } : String(text))
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * @param {object} d  what server/index.js hands over — functions, never stores
 *   of its own: see the call in server/index.js for each one.
 */
export function createSections(d) {
  /* ---------- the sections ---------- */

  function overview({ t, f, base }) {
    const o = d.dashboard().overview()
    const blocks = []
    const m = d.maintenance()
    if (m.on) {
      blocks.push({ type: 'notice', tone: 'danger', title: t('overview.maintenance'), text: m.message || t('overview.maintenanceText') })
    }
    if (o.announcement) {
      blocks.push({
        type: 'notice',
        tone: o.announcement.tone === 'warn' ? 'warning' : 'info',
        title: t(o.announcement.status === 'scheduled' ? 'overview.announceScheduled' : 'overview.announceLive'),
        text: o.announcement.message,
      })
    }
    const budget = o.storage?.budget
    if (budget?.ratio != null && budget.ratio >= 0.9) {
      const full = budget.ratio >= 1
      blocks.push({
        type: 'notice',
        tone: full ? 'danger' : 'warning',
        title: t(full ? 'overview.storageFull' : 'overview.storageHigh'),
        text: full ? t('overview.storageFullText') : t('overview.storageHighText', { percent: Math.round(budget.ratio * 100) }),
      })
    }
    const c = o.counts || {}
    blocks.push({
      type: 'stats',
      title: t('overview.people'),
      items: [
        { label: t('overview.accounts'), value: c.users ?? 0 },
        { label: t('overview.admins'), value: c.admins ?? 0 },
        { label: t('overview.online'), value: c.online ?? 0 },
        { label: t('overview.working'), value: c.working ?? 0 },
        { label: t('overview.sessions'), value: c.sessions ?? 0 },
      ],
    })
    blocks.push({
      type: 'stats',
      title: t('overview.security'),
      items: [
        { label: t('overview.failedLogins'), value: o.security?.failedLogins24h ?? 0 },
        { label: t('overview.lockouts'), value: o.security?.lockouts24h ?? 0 },
      ],
    })
    const s = o.sample
    const machine = []
    if (typeof s?.process?.cpu === 'number') machine.push({ label: t('overview.cpu'), value: `${Math.round(s.process.cpu)} %` })
    if (s?.host?.memTotal) {
      machine.push({
        label: t('overview.memory'),
        value: f.bytes(s.host.memUsed),
        hint: t('overview.memoryHint', { total: f.bytes(s.host.memTotal) }),
      })
    }
    if (budget) {
      machine.push({
        label: t('overview.storage'),
        value: f.bytes(budget.bytes) ?? t('unknown'),
        ...(budget.maxBytes ? { hint: t('overview.storageHint', { max: f.bytes(budget.maxBytes) }) } : {}),
      })
    }
    const disk = o.storage?.disk
    if (disk?.total) {
      machine.push({ label: t('overview.diskFree'), value: f.bytes(disk.free), hint: t('overview.diskHint', { total: f.bytes(disk.total) }) })
    }
    if (machine.length) blocks.push({ type: 'stats', title: t('overview.machine'), items: machine })
    const info = o.info || {}
    blocks.push({
      type: 'fields',
      title: t('overview.instance'),
      items: [
        { label: t('overview.version'), value: d.version() },
        { label: t('overview.address'), value: d.baseUrl() || base || t('unknown') },
        { label: t('overview.node'), value: info.node || process.version },
        { label: t('overview.platform'), value: [info.platform, info.arch].filter(Boolean).join(' · ') || t('unknown') },
        { label: t('overview.container'), value: t(info.container ? 'yes' : 'no') },
        { label: t('overview.started'), value: f.date(info.startedAt) || t('unknown') },
        {
          label: t('overview.registration'),
          value: t(d.loadConfig().allowRegistration !== false ? 'overview.registrationOpen' : 'overview.registrationClosed'),
        },
      ],
    })
    return blocks
  }

  function users({ t, f, me }) {
    const people = new Map((d.dashboard().overview().people || []).map((p) => [p.id, p]))
    const rows = d.users().slice(0, MAX_ROWS).map((u) => {
      const self = u.id === me.id
      const ways = []
      if (u.hasPassword) ways.push(t('users.signIn.password'))
      if (u.kosmyBoard) ways.push(t('users.signIn.kosmy'))
      if (u.sso) ways.push(t('users.signIn.dashy'))
      const state = people.get(u.id)?.state || 'offline'
      const actions = []
      // As Admin → Users offers them: the plan for non-admins, sign-out and a
      // new password for everybody, deletion for everybody but yourself.
      if (u.role !== 'admin') actions.push(u.plan === 'free' ? 'plan-standard' : 'plan-free')
      actions.push('reset-password', 'signout')
      if (!self) actions.push('delete')
      return {
        id: u.id,
        cells: {
          name: self ? t('you', { name: u.username }) : u.username,
          role: cell(t(`role.${u.role === 'admin' ? 'admin' : 'user'}`), u.role === 'admin' ? 'success' : 'muted'),
          plan: cell(t(`plan.${u.plan === 'free' ? 'free' : 'standard'}`), u.plan === 'free' ? 'warning' : undefined),
          signIn: u.mustChangePassword
            ? cell(`${ways.join(', ') || t('none')} · ${t('users.signIn.mustChange')}`, 'warning')
            : ways.join(', ') || t('none'),
          state: cell(t(`users.state.${state}`), state === 'active' ? 'success' : state === 'idle' ? 'warning' : 'muted'),
          created: f.day(u.createdAt) || t('none'),
        },
        actions,
      }
    })
    const cfg = d.loadConfig()
    return [
      {
        type: 'table',
        id: 'accounts',
        title: t('users.table'),
        columns: [
          { key: 'name', label: t('users.col.name') },
          { key: 'role', label: t('users.col.role') },
          { key: 'plan', label: t('users.col.plan') },
          { key: 'signIn', label: t('users.col.signIn') },
          { key: 'state', label: t('users.col.state') },
          { key: 'created', label: t('users.col.created') },
        ],
        rows,
        rowActions: [
          {
            id: 'reset-password',
            label: t('users.reset'),
            fields: [
              { name: 'password', label: t('users.resetPassword'), type: 'password', help: t('users.resetPasswordHelp'), maxLength: 200 },
              { name: 'mustChange', label: t('users.mustChange'), type: 'checkbox', value: true },
            ],
          },
          { id: 'plan-free', label: t('users.planFree') },
          { id: 'plan-standard', label: t('users.planStandard') },
          { id: 'signout', label: t('users.signOut'), confirm: t('users.signOutConfirm') },
          { id: 'delete', label: t('users.delete'), danger: true, confirm: t('users.deleteConfirm') },
        ],
        actions: [
          {
            id: 'create',
            label: t('users.create'),
            fields: [
              { name: 'username', label: t('users.username'), type: 'text', required: true, maxLength: 64 },
              { name: 'password', label: t('users.password'), type: 'password', help: t('users.resetPasswordHelp'), maxLength: 200 },
              {
                name: 'role',
                label: t('users.role'),
                type: 'select',
                value: 'user',
                options: [
                  { value: 'user', label: t('role.user') },
                  { value: 'admin', label: t('role.admin') },
                ],
              },
              {
                name: 'plan',
                label: t('users.plan'),
                type: 'select',
                value: d.freePlan(cfg).newAccounts,
                options: [
                  { value: 'standard', label: t('plan.standard') },
                  { value: 'free', label: t('plan.free') },
                ],
              },
              { name: 'mustChange', label: t('users.mustChange'), type: 'checkbox', value: true },
            ],
          },
        ],
        empty: t('users.empty'),
      },
    ]
  }

  function sessions({ t, f }) {
    const rows = d
      .dashboard()
      .sessions()
      .slice(0, MAX_ROWS)
      .map((s) => ({
        id: s.id,
        cells: {
          account: s.username,
          device: s.device || t('unknown'),
          ip: s.ip || t('none'),
          created: f.date(s.createdAt) || t('none'),
          last: f.date(s.lastUsedAt) || t('none'),
        },
        actions: ['revoke'],
      }))
    return [
      {
        type: 'table',
        id: 'sessions',
        columns: [
          { key: 'account', label: t('sessions.col.account') },
          { key: 'device', label: t('sessions.col.device') },
          { key: 'ip', label: t('sessions.col.ip') },
          { key: 'created', label: t('sessions.col.created') },
          { key: 'last', label: t('sessions.col.last') },
        ],
        rows,
        rowActions: [{ id: 'revoke', label: t('sessions.revoke'), danger: true, confirm: t('sessions.revokeConfirm') }],
        empty: t('sessions.empty'),
      },
    ]
  }

  function access({ t, me, base }) {
    const view = d.configView(d.loadConfig(), me)
    const kb = d.kosmyBoard(base)
    const blocks = []
    if (!view.freePlan.modelConfigured) blocks.push({ type: 'notice', tone: 'info', text: t('access.noFreeModel') })
    blocks.push({
      type: 'form',
      id: 'access',
      title: t('access.form'),
      action: 'save-access',
      submit: t('save'),
      fields: [
        { name: 'allowRegistration', label: t('access.registration'), type: 'checkbox', value: view.allowRegistration, help: t('access.registrationHelp') },
        { name: 'ownKeys', label: t('access.ownKeys'), type: 'checkbox', value: view.ownKeys, help: t('access.ownKeysHelp') },
        {
          name: 'newAccounts',
          label: t('access.newAccounts'),
          type: 'select',
          value: view.freePlan.newAccounts,
          options: [
            { value: 'free', label: t('plan.free') },
            { value: 'standard', label: t('plan.standard') },
          ],
        },
        { name: 'dailyLimit', label: t('access.dailyLimit'), type: 'number', value: view.freePlan.dailyLimit, min: 0, max: MAX_DAILY_LIMIT, step: 1, required: true },
      ],
    })
    blocks.push({
      type: 'fields',
      title: t('access.kosmy'),
      items: [
        { label: t('access.kosmyIssuer'), value: kb.issuer || t('none') },
        { label: t('access.kosmyClient'), value: kb.clientId || t('none') },
        { label: t('access.kosmyAutoCreate'), value: t(kb.autoCreate ? 'on' : 'off') },
        { label: t('access.kosmyRedirect'), value: kb.redirectUri },
      ],
    })
    blocks.push({ type: 'notice', tone: 'info', text: t('access.kosmyHere') })
    return blocks
  }

  function announcement({ t, f }) {
    const a = d.dashboard().announcement()
    const blocks = []
    if (a) {
      const when = a.status === 'scheduled' ? t('announce.scheduled', { when: f.date(a.startsAt) }) : t('announce.live')
      const until = a.expiresAt ? ` · ${t('announce.until', { when: f.date(a.expiresAt) })}` : ''
      blocks.push({ type: 'notice', tone: a.tone === 'warn' ? 'warning' : 'info', title: `${t('announce.current')} — ${when}${until}`, text: a.message })
    } else {
      blocks.push({ type: 'notice', tone: 'info', text: t('announce.none') })
    }
    blocks.push({
      type: 'form',
      id: 'announcement',
      title: t('announce.form'),
      action: 'publish',
      submit: t('announce.publish'),
      fields: [
        { name: 'message', label: t('announce.message'), type: 'textarea', value: a?.message || '', required: true, maxLength: 500, help: t('announce.messageHelp') },
        {
          name: 'tone',
          label: t('announce.tone'),
          type: 'select',
          value: a?.tone === 'warn' ? 'warn' : 'info',
          options: [
            { value: 'info', label: t('announce.tone.info') },
            { value: 'warn', label: t('announce.tone.warn') },
          ],
        },
        { name: 'startsAt', label: t('announce.startsAt'), type: 'text', maxLength: 40, help: t('announce.startsAtHelp') },
        { name: 'expiresInHours', label: t('announce.hours'), type: 'number', min: 0, max: 24 * 30, step: 1, help: t('announce.hoursHelp') },
      ],
    })
    if (a) {
      blocks.push({ type: 'actions', items: [{ id: 'clear', label: t('announce.clear'), danger: true, confirm: t('announce.clearConfirm') }] })
    }
    return blocks
  }

  function maintenance({ t, f }) {
    const m = d.maintenance()
    return [
      m.on
        ? { type: 'notice', tone: 'warning', text: t('maint.onSince', { when: f.date(m.since) || t('unknown') }) }
        : { type: 'notice', tone: 'success', text: t('maint.offNow') },
      {
        type: 'form',
        id: 'maintenance',
        title: t('maint.form'),
        action: 'save-maintenance',
        submit: t('save'),
        fields: [
          { name: 'on', label: t('maint.on'), type: 'checkbox', value: m.on },
          { name: 'message', label: t('maint.message'), type: 'textarea', value: m.message || '', maxLength: 500, help: t('maint.messageHelp') },
        ],
      },
      { type: 'notice', tone: 'info', text: t('maint.migration') },
    ]
  }

  function activity({ t, f }) {
    const names = new Map(d.users().map((u) => [u.id, u.username]))
    const inflight = d.activity.inflight()
    const recent = d.activity.recent({ limit: MAX_ROWS })
    const failed = recent.filter((e) => e.outcome && e.outcome !== 'ok' && e.outcome !== 'aborted').length
    const tone = (outcome) => (outcome === 'ok' ? 'success' : outcome === 'aborted' ? 'muted' : 'danger')
    return [
      {
        type: 'stats',
        title: t('activity.now'),
        items: [
          { label: t('activity.inflight'), value: inflight.length },
          { label: t('activity.lastHour'), value: recent.length },
          { label: t('activity.errors'), value: failed },
        ],
      },
      {
        type: 'table',
        id: 'events',
        columns: [
          { key: 'when', label: t('activity.col.when') },
          { key: 'account', label: t('activity.col.account') },
          { key: 'kind', label: t('activity.col.kind') },
          { key: 'action', label: t('activity.col.action') },
          { key: 'provider', label: t('activity.col.provider') },
          { key: 'duration', label: t('activity.col.duration') },
          { key: 'outcome', label: t('activity.col.outcome') },
        ],
        rows: recent
          .slice()
          .reverse()
          .map((e) => ({
            id: String(e.seq),
            cells: {
              when: f.time(e.endedAt) || t('none'),
              account: names.get(e.userId) || t('none'),
              kind: e.kind,
              action: e.action,
              provider: e.source === 'browser' ? `${e.provider} (${t('spend.browser')})` : e.provider,
              duration: f.ms(e.ms) || t('none'),
              outcome: cell(e.outcome || t('unknown'), tone(e.outcome)),
            },
          })),
        empty: t('activity.empty'),
      },
    ]
  }

  function spend({ t, f }) {
    const report = d.spendReport(30)
    const groups = new Map()
    let calls = 0
    let input = 0
    let output = 0
    let cost = 0
    const unpriced = new Set()
    for (const e of report.entries) {
      const key = `${e.userId}|${e.provider}|${e.model}|${e.source}`
      let g = groups.get(key)
      if (!g) groups.set(key, (g = { ...e, calls: 0, input: 0, output: 0, cost: null, unpriced: false }))
      g.calls += e.calls
      g.input += e.input
      g.output += e.output
      if (typeof e.cost === 'number') g.cost = (g.cost || 0) + e.cost
      if (e.unpriced) (g.unpriced = true), unpriced.add(`${e.provider}::${e.model}`)
      calls += e.calls
      input += e.input
      output += e.output
      if (typeof e.cost === 'number') cost += e.cost
    }
    const rows = [...groups.values()]
      .sort((a, b) => (b.cost || 0) - (a.cost || 0) || b.calls - a.calls)
      .slice(0, MAX_ROWS)
      .map((g, i) => ({
        id: String(i),
        cells: {
          account: g.username || t('spend.outside'),
          model: g.model,
          provider: g.source === 'browser' ? `${g.provider} (${t('spend.browser')})` : g.provider,
          calls: g.calls,
          input: f.num(g.input),
          output: f.num(g.output),
          cost: g.unpriced && g.cost == null ? cell(t('none'), 'warning') : f.usd(g.cost) || t('none'),
        },
      }))
    return [
      {
        type: 'stats',
        title: t('spend.totals'),
        items: [
          { label: t('spend.calls'), value: calls },
          { label: t('spend.input'), value: f.num(input) },
          { label: t('spend.output'), value: f.num(output) },
          { label: t('spend.cost'), value: f.usd(cost), ...(unpriced.size ? { hint: t('spend.unpriced', { n: unpriced.size }) } : {}) },
        ],
      },
      {
        type: 'table',
        id: 'spend',
        columns: [
          { key: 'account', label: t('spend.col.account') },
          { key: 'model', label: t('spend.col.model') },
          { key: 'provider', label: t('spend.col.provider') },
          { key: 'calls', label: t('spend.calls') },
          { key: 'input', label: t('spend.input') },
          { key: 'output', label: t('spend.output') },
          { key: 'cost', label: t('spend.cost') },
        ],
        rows,
        empty: t('spend.empty'),
      },
      {
        type: 'actions',
        title: t('spend.prices'),
        items: [{ id: 'import-prices', label: t('spend.import'), description: t('spend.importHelp') }],
      },
    ]
  }

  function assistants({ t, f }) {
    const v = d.mcp().adminView()
    return [
      {
        type: 'stats',
        items: [
          { label: t('mcp.state'), value: t(v.active ? 'on' : 'off') },
          { label: t('mcp.connections'), value: v.connections.length },
          { label: t('mcp.keys'), value: v.keys.length },
        ],
      },
      {
        type: 'table',
        id: 'connections',
        title: t('mcp.connections'),
        columns: [
          { key: 'account', label: t('mcp.col.account') },
          { key: 'client', label: t('mcp.col.client') },
          { key: 'scopes', label: t('mcp.col.scopes') },
          { key: 'created', label: t('mcp.col.created') },
          { key: 'last', label: t('mcp.col.last') },
        ],
        rows: v.connections.slice(0, MAX_ROWS).map((c) => ({
          id: String(c.id),
          cells: {
            account: c.username || t('none'),
            client: c.clientName || c.clientId || t('unknown'),
            scopes: Array.isArray(c.scopes) ? c.scopes.join(', ') : t('none'),
            created: f.date(c.createdAt) || t('none'),
            last: f.date(c.lastUsedAt) || t('none'),
          },
          actions: ['revoke-connection'],
        })),
        rowActions: [{ id: 'revoke-connection', label: t('mcp.revoke'), danger: true, confirm: t('mcp.revokeConnectionConfirm') }],
        empty: t('mcp.noConnections'),
      },
      {
        type: 'table',
        id: 'keys',
        title: t('mcp.keys'),
        columns: [
          { key: 'account', label: t('mcp.col.account') },
          { key: 'name', label: t('mcp.col.name') },
          { key: 'level', label: t('mcp.col.level') },
          { key: 'created', label: t('mcp.col.created') },
          { key: 'last', label: t('mcp.col.last') },
          { key: 'expires', label: t('mcp.col.expires') },
        ],
        rows: v.keys.slice(0, MAX_ROWS).map((k) => ({
          id: String(k.id),
          cells: {
            account: k.username || t('none'),
            name: k.name || t('none'),
            level: k.level || t('none'),
            created: f.date(k.createdAt) || t('none'),
            last: f.date(k.lastUsedAt) || t('none'),
            expires: k.expired ? cell(t('mcp.expired'), 'danger') : f.date(k.expiresAt) || t('none'),
          },
          actions: ['revoke-key'],
        })),
        rowActions: [{ id: 'revoke-key', label: t('mcp.revoke'), danger: true, confirm: t('mcp.revokeKeyConfirm') }],
        empty: t('mcp.noKeys'),
      },
    ]
  }

  function providers({ t }) {
    const p = d.providers()
    const named = (x) => (x?.provider ? [x.provider, x.model].filter(Boolean).join(' · ') : null)
    return [
      {
        type: 'fields',
        title: t('providers.text'),
        items: ['generation', 'inspiration', 'free'].map((k) => ({
          label: t(`providers.text.${k}`),
          value: named(p.text[k]) || t('providers.browser'),
        })),
      },
      {
        type: 'fields',
        title: t('providers.images'),
        items: [
          ...['content', 'inspiration', 'edit'].map((k) => ({ label: t(`providers.images.${k}`), value: named(p.images[k]) || t('notConfigured') })),
          { label: t('providers.video'), value: named(p.video) || t('notConfigured') },
          { label: t('providers.worker'), value: t(p.worker ? 'on' : 'off') },
        ],
      },
      { type: 'notice', tone: 'info', text: t('providers.here') },
    ]
  }

  function audit({ t, f }) {
    const detailText = (detail) =>
      detail && typeof detail === 'object'
        ? Object.entries(detail)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
            .join(' · ')
        : ''
    return [
      {
        type: 'table',
        id: 'audit',
        columns: [
          { key: 'when', label: t('audit.col.when') },
          { key: 'action', label: t('audit.col.action') },
          { key: 'actor', label: t('audit.col.actor') },
          { key: 'target', label: t('audit.col.target') },
          { key: 'detail', label: t('audit.col.detail') },
          { key: 'ip', label: t('audit.col.ip') },
        ],
        rows: d.audit.list({ limit: MAX_ROWS }).map((e) => ({
          id: String(e.id),
          cells: {
            when: f.date(e.at) || t('none'),
            action: cell(e.action, /failed|locked|delete|revoke/.test(e.action) ? 'warning' : undefined),
            actor: e.actor?.name || t('none'),
            target: e.target?.name || t('none'),
            detail: detailText(e.detail) || t('none'),
            ip: e.ip || t('none'),
          },
        })),
        empty: t('audit.empty'),
      },
    ]
  }

  const BUILDERS = { overview, users, sessions, access, announcement, maintenance, activity, spend, assistants, providers, audit }

  /* ---------- the actions ---------- */

  /**
   * An answer from one of Admin's own functions (`{ status, body, code }`),
   * turned into the Board's error when it is a refusal. The words are ours when
   * we have them for its code, else the function's own message.
   */
  function check(out, { t }) {
    if (!out || out.status < 400) return out
    const known = {
      not_found: ['err.rowGone', 404],
      username: ['err.username'],
      password: ['err.password'],
      taken: ['err.taken', 409],
      self: ['err.self'],
      'admin-free': ['err.adminFree'],
      plan: ['err.plan'],
      failed: ['err.failed', 502],
    }[out.code]
    const message = known ? t(known[0], { n: MIN_PASSWORD }) : str(out.body?.error, 500) || t('err.failed')
    const status = known?.[1] || (out.status === 404 ? 404 : out.status === 409 ? 409 : 422)
    throw new BoardAdminError(status, out.code === 'not_found' ? 'not_found' : 'invalid', message)
  }

  const generatedPassword = () => crypto.randomBytes(12).toString('base64url')

  /** The row an action names, among the rows the section would show — or 404. */
  function rowOf(list, row, t) {
    if (typeof row !== 'string' || !row) throw new BoardAdminError(404, 'not_found', t('err.rowGone'))
    const found = list.find((x) => String(x.id) === row)
    if (!found) throw new BoardAdminError(404, 'not_found', t('err.rowGone'))
    return found
  }

  async function act(id, body, ctx) {
    const { t, by, me } = ctx
    // The dashboard's verbs take the audit actor itself rather than an account.
    const verb = { actor: d.auditActor(me), ip: by.ip, detail: by.detail }
    const action = typeof body?.action === 'string' ? body.action : ''
    const v = body?.values && typeof body.values === 'object' && !Array.isArray(body.values) ? body.values : {}
    const notFound = () => new BoardAdminError(404, 'not_found', t('err.notFound'))

    if (id === 'users') {
      if (action === 'create') {
        const username = str(v.username, 64)
        const typed = typeof v.password === 'string' ? v.password : ''
        const password = typed || generatedPassword()
        const out = check(
          d.ops.createUser(by, {
            username,
            password,
            role: v.role === 'admin' ? 'admin' : 'user',
            plan: v.plan === 'free' || v.plan === 'standard' ? v.plan : undefined,
            mustChangePassword: v.mustChange === true,
          }),
          ctx,
        )
        const name = out.body.user.username
        return {
          message: t('users.createDone', { name }),
          ...(typed ? {} : { reveal: { label: t('users.revealPassword', { name }), value: password } }),
        }
      }
      const user = rowOf(d.users(), body?.row, t)
      // The same conditions as the row's `actions`: a list the Board was sent is
      // not proof the action is allowed on that row now.
      if (action === 'reset-password') {
        const typed = typeof v.password === 'string' ? v.password : ''
        const password = typed || generatedPassword()
        check(d.ops.resetPassword(by, user.id, { password, mustChange: v.mustChange === true }), ctx)
        return {
          message: t('users.resetDone', { name: user.username }),
          ...(typed ? {} : { reveal: { label: t('users.revealPassword', { name: user.username }), value: password } }),
        }
      }
      if (action === 'plan-free' || action === 'plan-standard') {
        const plan = action === 'plan-free' ? 'free' : 'standard'
        check(d.ops.setPlan(by, user.id, plan), ctx)
        return { message: t('users.planDone', { name: user.username, plan: t(`plan.${plan}`) }) }
      }
      if (action === 'signout') {
        const out = check(d.dashboard().signOutUser(user.id, verb), ctx)
        return { message: t('users.signOutDone', { n: out.body.revoked }) }
      }
      if (action === 'delete') {
        check(d.ops.deleteUser(by, user.id), ctx)
        return { message: t('users.deleteDone') }
      }
      throw notFound()
    }

    if (id === 'sessions' && action === 'revoke') {
      const s = rowOf(d.dashboard().sessions(), body?.row, t)
      check(d.dashboard().revokeSession(s.id, verb), ctx)
      return { message: t('sessions.revokeDone') }
    }

    if (id === 'access' && action === 'save-access') {
      const limit = Number(v.dailyLimit)
      // Admin's own route ignores a limit it cannot read; here the person would
      // see "saved" and the old number, so it is refused instead.
      if (!Number.isInteger(limit) || limit < 0 || limit > MAX_DAILY_LIMIT) {
        throw new BoardAdminError(422, 'invalid', t('err.dailyLimit', { max: MAX_DAILY_LIMIT }))
      }
      const patch = { freePlan: { dailyLimit: limit } }
      if (typeof v.allowRegistration === 'boolean') patch.allowRegistration = v.allowRegistration
      if (typeof v.ownKeys === 'boolean') patch.ownKeys = v.ownKeys
      if (v.newAccounts === 'free' || v.newAccounts === 'standard') patch.freePlan.newAccounts = v.newAccounts
      check(d.ops.updateConfig(by, patch), ctx)
      return { message: t('access.saved') }
    }

    if (id === 'announcement') {
      if (action === 'publish') {
        const hours = v.expiresInHours === '' || v.expiresInHours == null ? null : v.expiresInHours
        check(
          d.dashboard().setAnnouncement(
            { message: str(v.message, 2000), tone: v.tone === 'warn' ? 'warn' : 'info', startsAt: str(v.startsAt, 40) || null, expiresInHours: hours },
            verb,
          ),
          ctx,
        )
        return { message: t('announce.published') }
      }
      if (action === 'clear') {
        check(d.dashboard().clearAnnouncement(verb), ctx)
        return { message: t('announce.cleared') }
      }
      throw notFound()
    }

    if (id === 'maintenance' && action === 'save-maintenance') {
      check(d.ops.setMaintenance(by, { on: v.on === true, message: typeof v.message === 'string' ? v.message : '' }), ctx)
      return { message: t('maint.saved') }
    }

    if (id === 'spend' && action === 'import-prices') {
      const out = check(await d.ops.importPrices(by), ctx)
      return { message: t('spend.imported', { n: out.imported ?? 0 }) }
    }

    if (id === 'assistants' && (action === 'revoke-connection' || action === 'revoke-key')) {
      const view = d.mcp().adminView()
      const list = action === 'revoke-key' ? view.keys : view.connections
      const row = rowOf(list, body?.row, t)
      const fn = action === 'revoke-key' ? d.mcp().adminRevokeKey : d.mcp().adminRevokeConnection
      check(fn(row.id, by), ctx)
      return { message: t('mcp.revoked') }
    }

    throw notFound()
  }

  return {
    /** The menu: `{ id, title }` per section. */
    list: ({ t }) => SECTION_IDS.map((id) => ({ id, title: t(TITLES[id]) })),
    has: (id) => SECTION_IDS.includes(id),
    get(id, ctx) {
      const t = ctx.t
      const full = { ...ctx, f: formatters(ctx.lang) }
      const description = { users: 'users.description', sessions: 'sessions.description', announcement: 'announce.description', maintenance: 'maint.description', activity: 'activity.description', spend: 'spend.description', assistants: 'mcp.description', providers: 'providers.description', audit: 'audit.description' }[id]
      return {
        id,
        title: t(TITLES[id]),
        ...(description ? { description: t(description) } : {}),
        blocks: BUILDERS[id](full).slice(0, 30),
      }
    },
    act,
  }
}
