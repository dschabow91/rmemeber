import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

const dataDir = process.env.DATA_DIR || process.cwd()
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}
const file = join(dataDir, 'motherlode.json')

const adapter = new JSONFile(file)
export const db = new Low(adapter)
await db.read()
if (!db.data) {
  db.data = { users: [], entries: [] }
  await db.write()
}

export default db
