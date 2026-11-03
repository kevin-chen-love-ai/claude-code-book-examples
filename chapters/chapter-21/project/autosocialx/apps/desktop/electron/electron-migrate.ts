import { app } from 'electron';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { runMigrations } from './db/migrate.js';

app.whenReady().then(() => {
  try {
    const userDataPath = app?.getPath ? app.getPath('userData') : os.tmpdir();
    const dbPath = path.join(userDataPath, 'autosocialx.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log('[DEBUG-MIGRATE] Running on', dbPath);
    runMigrations(db);
    console.log('[DEBUG-MIGRATE] MIGRATION SUCCESSFUL ON LIVE DB');
  } catch (e) {
    console.error('[DEBUG-MIGRATE] MIGRATION ERROR ON LIVE DB:', e);
  }
  app.quit();
});
