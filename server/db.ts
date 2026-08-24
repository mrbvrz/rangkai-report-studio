import Database from "better-sqlite3-multiple-ciphers"
import type BetterSqlite3 from "better-sqlite3"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = path.join(root, "data")
fs.mkdirSync(dataDir, { recursive: true })

export const dbPath = path.join(dataDir, "rangkai.db")
let connection: BetterSqlite3.Database | null = null
let activePassphrase: string | null = null

function requireConnection() {
  if (!connection)
    throw Object.assign(new Error("Database terkunci."), {
      code: "DATABASE_LOCKED",
    })
  return connection
}

function initialize(database: BetterSqlite3.Database) {
  database.pragma("journal_mode = WAL")
  database.pragma("foreign_keys = ON")
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#6c8f58', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, report_date TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', tags TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, report_id INTEGER NOT NULL, filename TEXT NOT NULL, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, caption TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', content TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS monthly_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, month TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, template_id INTEGER, report_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS project_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, folder_path TEXT NOT NULL, is_watching INTEGER NOT NULL DEFAULT 1, last_synced_at TEXT, last_status TEXT NOT NULL DEFAULT 'idle', last_message TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(project_id, folder_path), FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS source_files (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER NOT NULL, report_id INTEGER, file_path TEXT NOT NULL, relative_path TEXT NOT NULL, file_mtime INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', change_type TEXT NOT NULL DEFAULT 'new', discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(source_id, file_path), FOREIGN KEY (source_id) REFERENCES project_sources(id) ON DELETE CASCADE, FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL);
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `)
  const addColumn = (table: string, column: string, definition: string) => {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string
    }[]
    if (!columns.some((item) => item.name === column))
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
  addColumn("reports", "project_id", "INTEGER REFERENCES projects(id) ON DELETE SET NULL")
  addColumn("reports", "source_path", "TEXT")
  addColumn("reports", "source_mtime", "INTEGER")
  addColumn("reports", "sync_status", "TEXT NOT NULL DEFAULT 'manual'")
  addColumn("monthly_reports", "project_id", "INTEGER REFERENCES projects(id) ON DELETE SET NULL")
  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_project_source ON reports(project_id, source_path) WHERE source_path IS NOT NULL",
  )
  const project = database.prepare("SELECT id FROM projects ORDER BY id LIMIT 1").get() as
    { id: number } | undefined
  if (!project)
    database
      .prepare("INSERT INTO projects (name, description, color) VALUES (?, ?, ?)")
      .run("Project Utama", "Project default untuk laporan baru.", "#6c8f58")
  const defaultProject = database.prepare("SELECT id FROM projects ORDER BY id LIMIT 1").get() as {
    id: number
  }
  database
    .prepare("UPDATE reports SET project_id = ? WHERE project_id IS NULL AND source_path IS NULL")
    .run(defaultProject.id)
  const template = database.prepare("SELECT id FROM templates LIMIT 1").get()
  if (!template)
    database
      .prepare("INSERT INTO templates (name, description, content, is_default) VALUES (?, ?, ?, 1)")
      .run(
        "Laporan Profesional",
        "Format ringkas dengan ringkasan, aktivitas, dan lampiran.",
        "# {{title}}\n\n## Ringkasan Eksekutif\n\n{{summary}}\n\n## Rincian Aktivitas\n\n{{daily_reports}}\n\n## Lampiran\n\n{{attachments}}\n",
      )
}

export function unlockDatabase(passphrase: string) {
  if (!passphrase) throw new Error("Passphrase diperlukan.")
  connection?.close()
  const database = new Database(dbPath) as unknown as BetterSqlite3.Database
  database.pragma(`key = '${passphrase.replaceAll("'", "''")}'`)
  database.pragma("cipher_compatibility = 4")
  database.prepare("SELECT count(*) FROM sqlite_master").get()
  initialize(database)
  connection = database
  activePassphrase = passphrase
}

export function lockDatabase() {
  connection?.close()
  connection = null
  activePassphrase = null
}
export function changeDatabasePassphrase(currentPassphrase: string, nextPassphrase: string) {
  if (!connection || !activePassphrase || currentPassphrase !== activePassphrase)
    throw new Error("Passphrase saat ini tidak valid.")
  if (!nextPassphrase) throw new Error("Passphrase baru diperlukan.")
  connection.pragma(`rekey = '${nextPassphrase.replaceAll("'", "''")}'`)
  activePassphrase = nextPassphrase
}
export function databaseStatus() {
  return connection ? "unlocked" : "locked"
}
export function databasePassphrase() {
  if (!activePassphrase) throw new Error("Database terkunci.")
  return activePassphrase
}
export const db = new Proxy({} as BetterSqlite3.Database, {
  get: (_target, key) => {
    const value = (requireConnection() as unknown as Record<PropertyKey, unknown>)[key]
    return typeof value === "function" ? value.bind(requireConnection()) : value
  },
})

export function serializeReport(row: Record<string, unknown>) {
  return { ...row, tags: JSON.parse(String(row.tags || "[]")) }
}
