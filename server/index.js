// Minimal self-hosted backend for Mocky: simple accounts + per-user data sync,
// a model-provider proxy (so production works without Vite), and static serving.
// Storage is plain JSON files under server/data — no database, no native deps.
import express from 'express'
import cookieParser from 'cookie-parser'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

// ---- tiny JSON file store ----
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'))
  } catch {
    return fallback
  }
}
function writeJson(file, obj) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(obj, null, 2))
}

const loadUsers = () => readJson('users.json', [])
const saveUsers = (u) => writeJson('users.json', u)
const loadSessions = () => readJson('sessions.json', {})
const saveSessions = (s) => writeJson('sessions.json', s)
const loadConfig = () => readJson('config.json', { allowRegistration: true })
const saveConfig = (c) => writeJson('config.json', c)
const userDataFile = (id) => `data-${id}.json`

// ---- password hashing (node crypto scrypt) ----
function hashPw(pw, salt) {
  return crypto.scryptSync(pw, salt, 64).toString('hex')
}
function makeUser(username, password, role = 'user') {
  const salt = crypto.randomBytes(16).toString('hex')
  return { id: crypto.randomUUID(), username, role, salt, hash: hashPw(password, salt), createdAt: Date.now() }
}
const publicUser = (u) => ({ username: u.username, role: u.role || 'user' })
function verifyPw(user, password) {
  const a = Buffer.from(hashPw(password, user.salt), 'hex')
  const b = Buffer.from(user.hash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ---- app ----
const app = express()
app.use(cookieParser())

// Model-provider proxy — forwards to `${x-provider-base}<subpath>` (raw body,
// so it must run before express.json()).
app.use('/__provider', async (req, res) => {
  const base = String(req.headers['x-provider-base'] || '').replace(/\/+$/, '')
  if (!base) return res.status(400).json({ error: 'Missing x-provider-base header' })
  const subpath = req.originalUrl.slice('/__provider'.length)
  const target = base + subpath
  try {
    const headers = { accept: 'application/json' }
    if (req.headers['authorization']) headers['authorization'] = req.headers['authorization']
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']
    const method = req.method
    const hasBody = method !== 'GET' && method !== 'HEAD'
    const body = hasBody ? await readRawBody(req) : undefined
    const upstream = await fetch(target, { method, headers, body: body && body.length ? body : undefined })
    res.status(upstream.status)
    const ct = upstream.headers.get('content-type')
    if (ct) res.setHeader('content-type', ct)
    res.send(Buffer.from(await upstream.arrayBuffer()))
  } catch (err) {
    res.status(502).json({ error: 'Proxy request failed', detail: String(err), target })
  }
})

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

app.use('/api', express.json({ limit: '25mb' }))

// ---- session helpers ----
function currentUser(req) {
  const token = req.cookies?.mocky_sess
  if (!token) return null
  const sess = loadSessions()[token]
  if (!sess) return null
  return loadUsers().find((u) => u.id === sess.u) || null
}
function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const sessions = loadSessions()
  sessions[token] = { u: userId, t: Date.now() }
  saveSessions(sessions)
  res.cookie('mocky_sess', token, { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 90 })
}

function requireAdmin(req, res, next) {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  if ((user.role || 'user') !== 'admin') return res.status(403).json({ error: 'Admin only.' })
  req.user = user
  next()
}

// Public config so the sign-in screen knows whether to offer registration.
app.get('/api/config', (req, res) => {
  res.json({ allowRegistration: loadConfig().allowRegistration !== false, setup: loadUsers().length === 0 })
})

// ---- auth routes ----
app.post('/api/register', (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  const users = loadUsers()
  const isFirst = users.length === 0
  if (!isFirst && loadConfig().allowRegistration === false) {
    return res.status(403).json({ error: 'Public sign-ups are disabled. Ask an admin to create your account.' })
  }
  if (users.some((u) => u.username === username)) return res.status(409).json({ error: 'Username already taken.' })
  // The very first account becomes the admin.
  const user = makeUser(username, password, isFirst ? 'admin' : 'user')
  users.push(user)
  saveUsers(users)
  setSession(res, user.id)
  res.json({ user: publicUser(user) })
})

app.post('/api/login', (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const user = loadUsers().find((u) => u.username === username)
  if (!user || !verifyPw(user, password)) return res.status(401).json({ error: 'Invalid username or password.' })
  setSession(res, user.id)
  res.json({ user: publicUser(user) })
})

app.post('/api/logout', (req, res) => {
  const token = req.cookies?.mocky_sess
  if (token) {
    const sessions = loadSessions()
    delete sessions[token]
    saveSessions(sessions)
  }
  res.clearCookie('mocky_sess')
  res.json({ ok: true })
})

app.get('/api/me', (req, res) => {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  res.json({ user: publicUser(user) })
})

// ---- admin routes ----
app.get('/api/admin/config', requireAdmin, (req, res) => {
  res.json({ allowRegistration: loadConfig().allowRegistration !== false })
})

app.put('/api/admin/config', requireAdmin, (req, res) => {
  const cfg = loadConfig()
  if (typeof req.body?.allowRegistration === 'boolean') cfg.allowRegistration = req.body.allowRegistration
  saveConfig(cfg)
  res.json({ allowRegistration: cfg.allowRegistration !== false })
})

app.get('/api/admin/users', requireAdmin, (req, res) => {
  res.json({
    users: loadUsers().map((u) => ({ id: u.id, username: u.username, role: u.role || 'user', createdAt: u.createdAt })),
  })
})

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const role = req.body?.role === 'admin' ? 'admin' : 'user'
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  const users = loadUsers()
  if (users.some((u) => u.username === username)) return res.status(409).json({ error: 'Username already taken.' })
  const user = makeUser(username, password, role)
  users.push(user)
  saveUsers(users)
  res.json({ user: { id: user.id, username: user.username, role: user.role } })
})

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = req.params.id
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' })
  const users = loadUsers()
  if (!users.some((u) => u.id === id)) return res.status(404).json({ error: 'User not found.' })
  saveUsers(users.filter((u) => u.id !== id))
  try {
    fs.rmSync(path.join(DATA_DIR, userDataFile(id)), { force: true })
  } catch {
    /* ignore */
  }
  const sessions = loadSessions()
  for (const t of Object.keys(sessions)) if (sessions[t].u === id) delete sessions[t]
  saveSessions(sessions)
  res.json({ ok: true })
})

// ---- per-user data (projects + design) ----
app.get('/api/data', (req, res) => {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  res.json(readJson(userDataFile(user.id), { projects: null, design: null }))
})

app.put('/api/data', (req, res) => {
  const user = currentUser(req)
  if (!user) return res.status(401).json({ error: 'Not signed in.' })
  const { projects, design } = req.body || {}
  writeJson(userDataFile(user.id), { projects: projects ?? null, design: design ?? null, updatedAt: Date.now() })
  res.json({ ok: true })
})

// ---- serve the built frontend (production) ----
const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/__provider')) return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
}

const PORT = process.env.PORT || 8787
app.listen(PORT, () => console.log(`Mocky backend on http://localhost:${PORT}`))
