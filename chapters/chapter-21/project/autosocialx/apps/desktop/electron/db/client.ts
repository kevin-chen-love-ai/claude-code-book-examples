// better-sqlite3 singleton for use by all main-process modules
import { app } from 'electron'
import Database from 'better-sqlite3'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const userDataPath = app?.getPath ? app.getPath('userData') : os.tmpdir()
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true })
  const dbPath = path.join(userDataPath, 'autosocialx.db')
  db = new Database(dbPath)

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')   // wait up to 5 s on SQLITE_BUSY instead of failing instantly
  db.pragma('synchronous = NORMAL')  // WAL + NORMAL is safe and faster than the default FULL
  db.pragma('foreign_keys = ON')

  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
