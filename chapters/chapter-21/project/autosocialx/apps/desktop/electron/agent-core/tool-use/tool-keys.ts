import { app, safeStorage } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

interface SavedToolKey { encryptedKey: string }
type SavedToolKeys = Record<string, SavedToolKey>

// In-memory registry for fast access during a session
const keyRegistry = new Map<string, string>()

function getPath(): string {
  return join(app.getPath('userData'), 'tool_keys.enc.json')
}

function encrypt(key: string): string {
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key).toString('base64')
    : Buffer.from(key, 'utf-8').toString('base64')
}

function decrypt(enc: string): string {
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.decryptString(Buffer.from(enc, 'base64'))
    : Buffer.from(enc, 'base64').toString('utf-8')
}

export function loadToolKeys(): void {
  const path = getPath()
  if (!existsSync(path)) return
  try {
    const saved = JSON.parse(readFileSync(path, 'utf-8')) as SavedToolKeys
    for (const [name, { encryptedKey }] of Object.entries(saved)) {
      try { keyRegistry.set(name, decrypt(encryptedKey)) } catch { /* skip corrupt */ }
    }
  } catch { /* ignore */ }
}

export function setToolKey(name: string, key: string): void {
  keyRegistry.set(name, key)
  const path = getPath()
  let saved: SavedToolKeys = {}
  if (existsSync(path)) {
    try { saved = JSON.parse(readFileSync(path, 'utf-8')) as SavedToolKeys } catch { /* corrupted */ }
  }
  saved[name] = { encryptedKey: encrypt(key) }
  writeFileSync(path, JSON.stringify(saved, null, 2), 'utf-8')
}

export function getToolKey(name: string): string | undefined {
  return keyRegistry.get(name)
}

export function deleteToolKey(name: string): void {
  keyRegistry.delete(name)
  const path = getPath()
  if (!existsSync(path)) return
  try {
    const saved = JSON.parse(readFileSync(path, 'utf-8')) as SavedToolKeys
    delete saved[name]
    writeFileSync(path, JSON.stringify(saved, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

export function listToolKeys(): string[] {
  return [...keyRegistry.keys()]
}
