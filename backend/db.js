import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Where to store the DB file (override via env if you want)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const file = path.join(DATA_DIR, 'motherlode.json')

// *** IMPORTANT: provide default data ***
const defaultData = {
  users: [],
  sessions: [],
  entries: []
}

const adapter = new JSONFile(file)
export const db = new Low(adapter, defaultData)

export async function initDb() {
  try {
    await db.read()
    // If file was empty or missing, ensure defaults are present
    db.data ||= defaultData
    await db.write()
  } catch (err) {
    console.error('Failed to init DB, resetting with defaults:', err)
    db.data = defaultData
    await db.write()
  }
}

