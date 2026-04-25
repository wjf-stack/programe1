import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'data', 'db.json')

const defaultData = { users: [], notes: [], tags: [], noteTags: [], relations: [] }

const adapter = new JSONFile(dbPath)
export const db = new Low(adapter, defaultData)

export const initDB = async () => {
  await db.read()
  db.data ||= defaultData
  await db.write()
}

export { uuidv4 as newId }
export default db
