import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import cors from 'cors'
import multer from 'multer'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { initDb, db } from './db.js'

const app = express()
const PORT = process.env.PORT || 10000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const ORIGIN = process.env.ORIGIN || 'http://localhost:10000'

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          'https://cdn.tailwindcss.com',
          'https://cdn.jsdelivr.net'
        ],
        scriptSrcElem: [
          "'self'",
          'https://cdn.tailwindcss.com',
          'https://cdn.jsdelivr.net'
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.tailwindcss.com',
          'https://cdn.jsdelivr.net'
        ],
        imgSrc: ["'self'", 'data:', 'https://images.unsplash.com']
      }
    }
  })
)
app.use(express.json())
app.use(cookieParser())
app.use(cors({ origin: ORIGIN, credentials: true }))

// file uploads
const uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads')
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true })
const upload = multer({ dest: uploadsDir })
app.use('/uploads', express.static(uploadsDir))

// directory for exported entries
const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data')
const entriesDir = join(dataDir, 'entries')
if (!existsSync(entriesDir)) mkdirSync(entriesDir, { recursive: true })

app.use(express.static(join(process.cwd(), 'public')))

await initDb()

// helpers
function createToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' })
}
function authRequired(req, res, next) {
  const token = req.cookies.token
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
  next()
}

function saveEntryFile(entry) {
  const fileName = `Motherlode_${entry.date}_Line${entry.line}.json`
  const filePath = join(entriesDir, fileName)
  writeFileSync(filePath, JSON.stringify(entry, null, 2))
}

// seed admin
if (!db.data.users.find(u => u.email === 'admin@motherlode.local')) {
  const id = Date.now().toString()
  const password = bcrypt.hashSync('ChangeMe123!', 10)
  db.data.users.push({ id, name: 'Admin', email: 'admin@motherlode.local', password, role: 'admin' })
  await db.write()
}

// routes
app.get('/api/health', (req, res) => res.json({ ok: true }))

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body
  await db.read()
  const user = db.data.users.find(u => u.email === email)
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' })
  const token = createToken(user)
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
  res.json({ user: { id: user.id, name: user.name, role: user.role } })
})

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

app.get('/api/auth/me', authRequired, async (req, res) => {
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  res.json({ user: { id: user.id, name: user.name, role: user.role } })
})

app.post('/api/users', authRequired, adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body
  await db.read()
  if (db.data.users.find(u => u.email === email)) return res.status(400).json({ error: 'Email exists' })
  const id = Date.now().toString()
  const hash = bcrypt.hashSync(password, 10)
  db.data.users.push({ id, name, email, password: hash, role })
  await db.write()
  res.status(201).json({ id, name, email, role })
})

app.get('/api/users', authRequired, adminOnly, async (req, res) => {
  await db.read()
  const users = db.data.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }))
  res.json(users)
})

app.post('/api/users/change-password', authRequired, async (req, res) => {
  const { oldPassword, newPassword } = req.body
  await db.read()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!bcrypt.compareSync(oldPassword, user.password)) return res.status(400).json({ error: 'Wrong password' })
  user.password = bcrypt.hashSync(newPassword, 10)
  await db.write()
  res.json({ ok: true })
})

app.post('/api/upload', authRequired, upload.array('files'), (req, res) => {
  const files = req.files.map(f => ({ filename: f.filename, originalname: f.originalname }))
  res.json({ files })
})

app.post('/api/entries', authRequired, async (req, res) => {
  const { date, line, shift, completedTasks = '', issues = '', nextActions = '', attachments = [] } = req.body
  await db.read()
  if (db.data.entries.find(e => e.date === date && e.line === line)) {
    return res.status(400).json({ error: 'Entry already exists for this date and line' })
  }
  const entry = { id: Date.now().toString(), createdBy: req.user.id, date, line, shift, completedTasks, issues, nextActions, attachments }
  db.data.entries.push(entry)
  await db.write()
  saveEntryFile(entry)
  res.status(201).json(entry)
})

app.get('/api/entries', authRequired, async (req, res) => {
  const { date, shift, line, limit = 20 } = req.query
  await db.read()
  let entries = db.data.entries
  if (date) entries = entries.filter(e => e.date === date)
  if (shift) entries = entries.filter(e => e.shift === shift)
  if (line) entries = entries.filter(e => e.line === line)
  entries = entries.slice(-Number(limit)).reverse()
  res.json(entries)
})

app.get('/api/entries/export', authRequired, async (req, res) => {
  const { date, line } = req.query
  if (!date || !line) return res.status(400).json({ error: 'date and line required' })
  await db.read()
  const entry = db.data.entries.find(e => e.date === date && e.line === line)
  if (!entry) return res.status(404).json({ error: 'Not found' })
  const fileName = `Motherlode_${date}_Line${line}.json`
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  res.send(JSON.stringify(entry, null, 2))
})

app.get('/api/entries/:id', authRequired, async (req, res) => {
  await db.read()
  const entry = db.data.entries.find(e => e.id === req.params.id)
  if (!entry) return res.status(404).json({ error: 'Not found' })
  res.json(entry)
})

app.put('/api/entries/:id', authRequired, async (req, res) => {
  await db.read()
  const entry = db.data.entries.find(e => e.id === req.params.id)
  if (!entry) return res.status(404).json({ error: 'Not found' })
  if (entry.createdBy !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
  Object.assign(entry, req.body)
  await db.write()
  res.json(entry)
})

app.delete('/api/entries/:id', authRequired, adminOnly, async (req, res) => {
  await db.read()
  const index = db.data.entries.findIndex(e => e.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: 'Not found' })
  db.data.entries.splice(index, 1)
  await db.write()
  res.json({ ok: true })
})

app.listen(PORT, () => console.log(`Server running on ${PORT}`))
