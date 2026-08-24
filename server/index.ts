import express from "express"
import multer from "multer"
import path from "node:path"
import fs from "node:fs"
import crypto from "node:crypto"
import PDFDocument from "pdfkit"
import { fileURLToPath } from "node:url"
import {
  databasePassphrase,
  databaseStatus,
  changeDatabasePassphrase,
  db,
  dbPath,
  lockDatabase,
  serializeReport,
  unlockDatabase,
} from "./db.js"
import { applySourceFile, syncSource, syncWatchedSources } from "./sync.js"
import {
  assertSafeBaseUrl,
  generateAiWriting,
  type AiSettings,
  type AiWritingAction,
} from "./ai.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const uploadDir = path.join(root, "uploads")
fs.mkdirSync(uploadDir, { recursive: true })
const app = express()
app.use(express.json({ limit: "8mb" }))

app.get("/api/database/status", (_req, res) =>
  res.json({
    status: databaseStatus(),
    isNew: !fs.existsSync(dbPath),
  }),
)
app.post("/api/database/unlock", (req, res) => {
  try {
    unlockDatabase(String(req.body?.passphrase || ""))
    res.json({ ok: true, status: databaseStatus() })
  } catch {
    res.status(401).json({ message: "Passphrase database tidak valid." })
  }
})
app.post("/api/database/lock", (_req, res) => {
  lockDatabase()
  res.json({ ok: true, status: databaseStatus() })
})
app.use("/api", (req, res, next) => {
  if (databaseStatus() === "unlocked") return next()
  res.status(423).json({ message: "Database terkunci.", code: "DATABASE_LOCKED" })
})

app.put("/api/database/passphrase", (req, res) => {
  try {
    const { currentPassphrase, nextPassphrase, security } = req.body as {
      currentPassphrase?: string
      nextPassphrase?: string
      security?: string
    }
    if (
      typeof currentPassphrase !== "string" ||
      typeof nextPassphrase !== "string" ||
      typeof security !== "string"
    )
      return res.status(400).json({ message: "Data passphrase tidak valid." })
    changeDatabasePassphrase(currentPassphrase, nextPassphrase)
    db.prepare(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('security', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    ).run(security)
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Passphrase tidak dapat diubah.",
    })
  }
})

function attachmentKey() {
  return crypto.scryptSync(databasePassphrase(), "rangkai-attachments-v1", 32)
}
function encryptAttachment(filePath: string) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", attachmentKey(), iv)
  const encrypted = Buffer.concat([cipher.update(fs.readFileSync(filePath)), cipher.final()])
  fs.writeFileSync(
    filePath,
    Buffer.concat([Buffer.from("RGAT1"), iv, cipher.getAuthTag(), encrypted]),
  )
}
function decryptAttachment(filePath: string) {
  const payload = fs.readFileSync(filePath)
  if (payload.subarray(0, 5).toString() !== "RGAT1") throw new Error("Lampiran tidak terenkripsi.")
  const decipher = crypto.createDecipheriv("aes-256-gcm", attachmentKey(), payload.subarray(5, 17))
  decipher.setAuthTag(payload.subarray(17, 33))
  return Buffer.concat([decipher.update(payload.subarray(33)), decipher.final()])
}
app.get("/uploads/:filename", (req, res) => {
  try {
    if (databaseStatus() !== "unlocked") return res.status(423).end()
    if (!/^[a-zA-Z0-9._-]+$/.test(req.params.filename)) return res.status(400).end()
    const file = path.join(uploadDir, req.params.filename)
    if (!fs.existsSync(file)) return res.status(404).end()
    const attachment = db
      .prepare("SELECT mime_type FROM attachments WHERE filename = ?")
      .get(req.params.filename) as { mime_type: string } | undefined
    res.type(attachment?.mime_type || "application/octet-stream").send(decryptAttachment(file))
  } catch {
    res.status(403).end()
  }
})

app.get("/api/settings/secure", (_req, res) => {
  const rows = db
    .prepare("SELECT key, value FROM app_settings WHERE key IN (?, ?)")
    .all("security", "ai") as { key: string; value: string }[]
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]))
  res.json({ security: values.security || null, ai: values.ai || null })
})
app.put("/api/settings/secure", (req, res) => {
  const { key, value } = req.body as { key?: string; value?: string | null }
  if (!key || !["security", "ai"].includes(key) || typeof value !== "string")
    return res.status(400).json({ message: "Pengaturan tidak valid." })
  db.prepare(
    "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
  ).run(key, value)
  res.json({ ok: true })
})

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, done) =>
      done(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, done) => done(null, file.mimetype.startsWith("image/")),
})
const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
})

const backupTables = [
  "projects",
  "reports",
  "attachments",
  "templates",
  "monthly_reports",
  "project_sources",
  "source_files",
] as const
function encryptBackup(value: unknown, passphrase: string) {
  if (!passphrase) throw new Error("Passphrase wajib diisi.")
  const salt = crypto.randomBytes(16),
    iv = crypto.randomBytes(12)
  const key = crypto.scryptSync(passphrase, salt, 32)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return {
    format: "rangkai-backup-encrypted",
    version: 1,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  }
}
function decryptBackup(
  value: { salt?: string; iv?: string; tag?: string; data?: string },
  passphrase: string,
) {
  if (!passphrase || !value.salt || !value.iv || !value.tag || !value.data)
    throw new Error("Passphrase atau file backup tidak valid.")
  try {
    const key = crypto.scryptSync(passphrase, Buffer.from(value.salt, "base64"), 32)
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64"))
    decipher.setAuthTag(Buffer.from(value.tag, "base64"))
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(value.data, "base64")),
        decipher.final(),
      ]).toString("utf8"),
    ) as Record<string, unknown>
  } catch {
    throw new Error("Passphrase atau file backup tidak valid.")
  }
}
function createBackup() {
  const tables = Object.fromEntries(
    backupTables.map((table) => [table, db.prepare(`SELECT * FROM ${table}`).all()]),
  )
  const files = (tables.attachments as { filename: string }[]).flatMap((attachment) => {
    const file = path.join(uploadDir, attachment.filename)
    return fs.existsSync(file)
      ? [
          {
            filename: attachment.filename,
            data: fs.readFileSync(file).toString("base64"),
          },
        ]
      : []
  })
  return {
    format: "rangkai-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    tables,
    files,
  }
}

function clearWorkspace(all: boolean) {
  const attachmentFiles = db.prepare("SELECT filename FROM attachments").all() as {
    filename: string
  }[]
  db.transaction(() => {
    db.prepare("DELETE FROM source_files").run()
    db.prepare("DELETE FROM project_sources").run()
    db.prepare("DELETE FROM attachments").run()
    db.prepare("DELETE FROM monthly_reports").run()
    db.prepare("DELETE FROM reports").run()
    if (all) {
      db.prepare("DELETE FROM templates").run()
      db.prepare("DELETE FROM projects").run()
    }
  })()
  attachmentFiles.forEach(({ filename }) =>
    fs.rmSync(path.join(uploadDir, filename), { force: true }),
  )
  if (all) {
    db.prepare("INSERT INTO projects (name, description, color) VALUES (?, ?, ?)").run(
      "Project Utama",
      "Project default untuk laporan baru.",
      "#6c8f58",
    )
    db.prepare(
      "INSERT INTO templates (name, description, content, is_default) VALUES (?, ?, ?, 1)",
    ).run(
      "Laporan Profesional",
      "Format laporan default.",
      "# {{title}}\n\n**Periode:** {{period}}\n\n## Ringkasan Eksekutif\n\n{{summary}}\n\n## Rincian Aktivitas\n\n{{daily_reports}}\n\n## Lampiran\n\n{{attachments}}\n",
    )
  }
}

function attachmentsFor(reportId: number) {
  return db.prepare("SELECT * FROM attachments WHERE report_id = ? ORDER BY id").all(reportId)
}

app.get("/api/health", (_req, res) => {
  const size = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0
  res.json({ ok: true, database: "SQLite", file: "rangkai.db", size })
})
app.post("/api/settings/backup/encrypted", (req, res) => {
  try {
    const backup = encryptBackup(createBackup(), String(req.body?.passphrase || ""))
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rangkai-backup-${new Date().toISOString().slice(0, 10)}.encrypted.json"`,
    )
    res.send(JSON.stringify(backup))
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Backup tidak dapat dienkripsi.",
    })
  }
})
app.post("/api/settings/restore", backupUpload.single("backup"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File backup wajib dipilih." })
    const uploaded = JSON.parse(req.file.buffer.toString("utf8")) as {
      format?: string
      version?: number
      tables?: Record<string, Record<string, unknown>[]>
      files?: { filename: string; data: string }[]
    }
    const backup =
      uploaded.format === "rangkai-backup-encrypted"
        ? (decryptBackup(
            uploaded as {
              salt?: string
              iv?: string
              tag?: string
              data?: string
            },
            String(req.body?.passphrase || ""),
          ) as typeof uploaded)
        : uploaded
    if (backup.format !== "rangkai-backup" || backup.version !== 1 || !backup.tables)
      return res.status(400).json({ message: "Format backup tidak valid." })
    const oldFiles = db.prepare("SELECT filename FROM attachments").all() as {
      filename: string
    }[]
    db.transaction(() => {
      for (const table of [...backupTables].reverse()) db.prepare(`DELETE FROM ${table}`).run()
      for (const table of backupTables) {
        const allowed = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
          (column) => column.name,
        )
        for (const row of backup.tables?.[table] || []) {
          const columns = allowed.filter((column) => Object.hasOwn(row, column))
          if (!columns.length) continue
          db.prepare(
            `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
          ).run(...columns.map((column) => row[column]))
        }
      }
    })()
    oldFiles.forEach(({ filename }) => fs.rmSync(path.join(uploadDir, filename), { force: true }))
    for (const file of backup.files || [])
      if (/^[a-zA-Z0-9._-]+$/.test(file.filename))
        fs.writeFileSync(path.join(uploadDir, file.filename), Buffer.from(file.data, "base64"))
    res.json({ ok: true, restoredAt: new Date().toISOString() })
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Backup tidak dapat dipulihkan.",
    })
  }
})
app.delete("/api/settings/data/reports", (_req, res) => {
  clearWorkspace(false)
  res.json({ ok: true })
})
app.delete("/api/settings/data/all", (_req, res) => {
  clearWorkspace(true)
  res.json({ ok: true })
})
app.get("/api/dashboard-summary", (_req, res) => {
  const reports = db.prepare("SELECT COUNT(*) AS value FROM reports").get() as {
    value: number
  }
  const published = db
    .prepare("SELECT COUNT(*) AS value FROM reports WHERE status = 'published'")
    .get() as { value: number }
  const attachments = db.prepare("SELECT COUNT(*) AS value FROM attachments").get() as {
    value: number
  }
  const months = db.prepare("SELECT COUNT(DISTINCT month) AS value FROM monthly_reports").get() as {
    value: number
  }
  const projects = db.prepare("SELECT COUNT(*) AS value FROM projects").get() as { value: number }
  res.json({
    reports: reports.value,
    published: published.value,
    attachments: attachments.value,
    months: months.value,
    projects: projects.value,
  })
})

app.get("/api/dashboard-analytics", (_req, res) => {
  const monthlyRows = db
    .prepare(
      "SELECT substr(report_date, 1, 7) AS period, COUNT(*) AS count FROM reports GROUP BY period",
    )
    .all() as { period: string; count: number }[]
  const projectRows = db
    .prepare(
      `SELECT p.id, p.name, p.color, substr(r.report_date, 1, 7) AS period, COUNT(r.id) AS count
    FROM projects p LEFT JOIN reports r ON r.project_id = p.id
    GROUP BY p.id, period ORDER BY p.id, period`,
    )
    .all() as {
    id: number
    name: string
    color: string
    period: string | null
    count: number
  }[]
  const dailyRows = db
    .prepare(
      "SELECT report_date AS date, COUNT(*) AS count FROM reports WHERE substr(report_date, 1, 4) = strftime('%Y', 'now') GROUP BY report_date ORDER BY report_date",
    )
    .all() as { date: string; count: number }[]
  const monthlyMap = new Map(monthlyRows.map((row) => [row.period, row.count]))
  const dailyMap = new Map(dailyRows.map((row) => [row.date, row.count]))
  const now = new Date()
  const year = now.getFullYear()
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, index, 1)
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    return {
      period,
      label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date),
      count: monthlyMap.get(period) || 0,
    }
  })
  const periods = monthly.map((item) => item.period)
  const projects = Array.from(
    new Map(
      projectRows.map((row) => [row.id, { id: row.id, name: row.name, color: row.color }]),
    ).values(),
  ).map((project) => ({
    ...project,
    values: periods.map(
      (period) =>
        projectRows.find((row) => row.id === project.id && row.period === period)?.count || 0,
    ),
  }))
  const start = new Date(year, 0, 1)
  const daysInYear = Math.round((new Date(year + 1, 0, 1).getTime() - start.getTime()) / 86_400_000)
  const daily = Array.from({ length: daysInYear }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    return { date: key, count: dailyMap.get(key) || 0 }
  })
  res.json({
    year,
    monthly,
    projects,
    daily,
    totalLastYear: daily.reduce((sum, item) => sum + item.count, 0),
  })
})

app.get("/api/projects", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, COUNT(DISTINCT r.id) AS report_count, COUNT(DISTINCT s.id) AS source_count
    FROM projects p LEFT JOIN reports r ON r.project_id = p.id LEFT JOIN project_sources s ON s.project_id = p.id
    GROUP BY p.id ORDER BY p.updated_at DESC, p.name`,
    )
    .all()
  res.json(rows)
})
app.get("/api/projects/:id", (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id)
  if (!project) return res.status(404).json({ message: "Project tidak ditemukan." })
  const sources = (
    db
      .prepare("SELECT * FROM project_sources WHERE project_id = ? ORDER BY id")
      .all(req.params.id) as Record<string, unknown>[]
  ).map((source) => ({
    ...source,
    files: db
      .prepare(
        "SELECT * FROM source_files WHERE source_id = ? ORDER BY status = 'pending' DESC, relative_path",
      )
      .all(source.id),
  }))
  res.json({ ...(project as object), sources })
})

app.get("/api/filesystem/directories", (req, res) => {
  try {
    const requested = String(req.query.path || process.cwd())
    const current = path.resolve(requested)
    if (!fs.existsSync(current) || !fs.statSync(current).isDirectory())
      return res.status(400).json({ message: "Folder tidak dapat dibuka." })
    const directories = fs
      .readdirSync(current, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => ({
        name: entry.name,
        path: path.join(current, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    const markdownCount = fs
      .readdirSync(current, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name)).length
    res.json({
      current,
      parent: path.dirname(current) === current ? null : path.dirname(current),
      directories,
      markdownCount,
    })
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Folder tidak dapat dibaca.",
    })
  }
})
app.post("/api/projects", (req, res) => {
  const { name, description = "", color = "#6c8f58" } = req.body
  if (!name?.trim()) return res.status(400).json({ message: "Nama project wajib diisi." })
  const result = db
    .prepare("INSERT INTO projects (name, description, color) VALUES (?, ?, ?)")
    .run(name.trim(), description, color)
  res.status(201).json({ id: result.lastInsertRowid })
})
app.put("/api/projects/:id", (req, res) => {
  const { name, description = "", color = "#6c8f58" } = req.body
  if (!name?.trim()) return res.status(400).json({ message: "Nama project wajib diisi." })
  const result = db
    .prepare(
      "UPDATE projects SET name = ?, description = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .run(name.trim(), description, color, req.params.id)
  if (!result.changes) return res.status(404).json({ message: "Project tidak ditemukan." })
  res.json({ ok: true })
})
app.delete("/api/projects/:id", (req, res) => {
  const count = db.prepare("SELECT COUNT(*) AS count FROM projects").get() as {
    count: number
  }
  if (count.count <= 1)
    return res.status(400).json({ message: "Minimal satu project harus tersedia." })
  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(req.params.id)
  if (!project) return res.status(404).json({ message: "Project tidak ditemukan." })
  const preserved = db
    .prepare("SELECT COUNT(*) AS count FROM reports WHERE project_id = ?")
    .get(req.params.id) as { count: number }
  db.transaction(() => {
    db.prepare("UPDATE reports SET project_id = NULL WHERE project_id = ?").run(req.params.id)
    db.prepare("UPDATE monthly_reports SET project_id = NULL WHERE project_id = ?").run(
      req.params.id,
    )
    db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id)
  })()
  res.json({ ok: true, preservedReports: preserved.count })
})
app.post("/api/projects/:id/sources", (req, res) => {
  const folder = path.resolve(String(req.body.folderPath || ""))
  if (!folder || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory())
    return res.status(400).json({ message: "Folder tidak ditemukan atau tidak dapat dibaca." })
  try {
    const result = db
      .prepare(
        "INSERT INTO project_sources (project_id, folder_path, is_watching) VALUES (?, ?, ?)",
      )
      .run(req.params.id, folder, req.body.isWatching === false ? 0 : 1)
    const sync = syncSource(Number(result.lastInsertRowid))
    res.status(201).json({ id: result.lastInsertRowid, ...sync })
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Gagal menambahkan sumber.",
    })
  }
})
app.put("/api/sources/:id", (req, res) => {
  db.prepare("UPDATE project_sources SET is_watching = ? WHERE id = ?").run(
    req.body.isWatching ? 1 : 0,
    req.params.id,
  )
  res.json({ ok: true })
})
app.delete("/api/sources/:id", (req, res) => {
  db.prepare("DELETE FROM project_sources WHERE id = ?").run(req.params.id)
  res.json({ ok: true })
})
app.post("/api/sources/:id/sync", (req, res) => {
  try {
    res.json(syncSource(Number(req.params.id)))
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Sinkronisasi gagal.",
    })
  }
})
app.post("/api/source-files/actions", (req, res) => {
  const { fileIds = [], action } = req.body as {
    fileIds: number[]
    action: "import" | "ignore"
  }
  if (!["import", "ignore"].includes(action) || !Array.isArray(fileIds))
    return res.status(400).json({ message: "Aksi file tidak valid." })
  try {
    const results = db.transaction(() => fileIds.map((id) => applySourceFile(Number(id), action)))()
    res.json({ processed: results.length, results })
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Aksi file gagal.",
    })
  }
})

app.get("/api/reports", (req, res) => {
  const month = String(req.query.month || "")
  const projectId = Number(req.query.projectId || 0)
  const summaryOnly = req.query.summary === "1"
  const where = [
    month ? "substr(r.report_date, 1, 7) = ?" : "",
    projectId ? "r.project_id = ?" : "",
  ]
    .filter(Boolean)
    .join(" AND ")
  const params = [month || null, projectId || null].filter((value) => value !== null)
  const rows = db
    .prepare(
      `SELECT r.*, p.name AS project_name, p.color AS project_color FROM reports r LEFT JOIN projects p ON p.id = r.project_id ${where ? `WHERE ${where}` : ""} ORDER BY r.report_date DESC, r.id DESC`,
    )
    .all(...params)
  res.json(
    (rows as Record<string, unknown>[]).map((row) => ({
      ...serializeReport({
        ...row,
        content: summaryOnly ? String(row.content).slice(0, 600) : row.content,
      }),
      attachments: attachmentsFor(Number(row.id)),
    })),
  )
})

app.get("/api/reports/:id", (req, res) => {
  const row = db
    .prepare(
      "SELECT r.*, p.name AS project_name, p.color AS project_color FROM reports r LEFT JOIN projects p ON p.id = r.project_id WHERE r.id = ?",
    )
    .get(req.params.id) as Record<string, unknown> | undefined
  if (!row) return res.status(404).json({ message: "Laporan tidak ditemukan." })
  res.json({
    ...serializeReport(row),
    attachments: attachmentsFor(Number(row.id)),
  })
})

app.post("/api/reports", (req, res) => {
  const { projectId, title, reportDate, content, status = "draft", tags = [] } = req.body
  if (!projectId || !title || !reportDate || !content)
    return res.status(400).json({ message: "Project, judul, tanggal, dan isi wajib diisi." })
  const result = db
    .prepare(
      "INSERT INTO reports (project_id, title, report_date, content, status, tags) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(projectId, title, reportDate, content, status, JSON.stringify(tags))
  res.status(201).json({ id: result.lastInsertRowid })
})

app.put("/api/reports/:id", (req, res) => {
  const { projectId, title, reportDate, content, status = "draft", tags = [] } = req.body
  db.prepare(
    "UPDATE reports SET project_id = ?, title = ?, report_date = ?, content = ?, status = ?, tags = ?, sync_status = CASE WHEN source_path IS NULL THEN 'manual' ELSE 'modified' END, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(projectId, title, reportDate, content, status, JSON.stringify(tags), req.params.id)
  res.json({ ok: true })
})

app.delete("/api/reports/:id", (req, res) => {
  const files = attachmentsFor(Number(req.params.id)) as { filename: string }[]
  db.prepare("DELETE FROM reports WHERE id = ?").run(req.params.id)
  files.forEach((file) => fs.rmSync(path.join(uploadDir, file.filename), { force: true }))
  res.json({ ok: true })
})

app.post("/api/reports/:id/attachments", upload.array("images", 12), (req, res) => {
  const files = req.files as Express.Multer.File[]
  try {
    files.forEach((file) => encryptAttachment(file.path))
    const insert = db.prepare(
      "INSERT INTO attachments (report_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)",
    )
    const run = db.transaction(() =>
      files.forEach((file) =>
        insert.run(req.params.id, file.filename, file.originalname, file.mimetype, file.size),
      ),
    )
    run()
    res.status(201).json(attachmentsFor(Number(req.params.id)))
  } catch (error) {
    files.forEach((file) => fs.rmSync(file.path, { force: true }))
    res.status(500).json({
      message: error instanceof Error ? error.message : "Lampiran tidak dapat dienkripsi.",
    })
  }
})

app.get("/api/templates", (_req, res) =>
  res.json(db.prepare("SELECT * FROM templates ORDER BY is_default DESC, name").all()),
)
app.post("/api/templates", (req, res) => {
  const { name, description = "", content } = req.body
  const result = db
    .prepare("INSERT INTO templates (name, description, content) VALUES (?, ?, ?)")
    .run(name, description, content)
  res.status(201).json({ id: result.lastInsertRowid })
})
app.put("/api/templates/:id", (req, res) => {
  const { name, description = "", content } = req.body
  db.prepare(
    "UPDATE templates SET name = ?, description = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(name, description, content, req.params.id)
  res.json({ ok: true })
})

function compileMonth(month: string, templateId?: number, aiSummary?: string, projectId?: number) {
  const reports = projectId
    ? (db
        .prepare(
          "SELECT * FROM reports WHERE substr(report_date, 1, 7) = ? AND project_id = ? ORDER BY report_date, id",
        )
        .all(month, projectId) as Record<string, unknown>[])
    : (db
        .prepare(
          "SELECT * FROM reports WHERE substr(report_date, 1, 7) = ? ORDER BY report_date, id",
        )
        .all(month) as Record<string, unknown>[])
  const template = templateId
    ? (db.prepare("SELECT * FROM templates WHERE id = ?").get(templateId) as {
        id: number
        content: string
      })
    : (db.prepare("SELECT * FROM templates ORDER BY is_default DESC, id LIMIT 1").get() as {
        id: number
        content: string
      })
  if (!reports.length) throw new Error("Belum ada laporan harian pada periode ini.")
  const date = new Date(`${month}-01T00:00:00`)
  const period = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date)
  const daily = reports
    .map((report) => `### ${report.report_date} — ${report.title}\n\n${report.content}`)
    .join("\n\n")
  const allAttachments = reports.flatMap((report) =>
    (
      attachmentsFor(Number(report.id)) as {
        filename: string
        original_name: string
      }[]
    ).map((item) => `![${item.original_name}](/uploads/${item.filename})`),
  )
  const summary =
    aiSummary ||
    `Sebanyak ${reports.length} laporan harian berhasil dihimpun untuk periode ${period}. Dokumen ini merangkum aktivitas, progres, dan dokumentasi yang tercatat.`
  const project = projectId
    ? (db.prepare("SELECT name FROM projects WHERE id = ?").get(projectId) as
        { name: string } | undefined)
    : undefined
  const title = `${project ? `${project.name} — ` : ""}Laporan Bulanan — ${period}`
  const content = template.content
    .replaceAll("{{title}}", title)
    .replaceAll("{{period}}", period)
    .replaceAll(
      "{{generated_at}}",
      new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date()),
    )
    .replaceAll("{{summary}}", summary)
    .replaceAll("{{daily_reports}}", daily)
    .replaceAll("{{attachments}}", allAttachments.join("\n\n") || "_Tidak ada lampiran._")
  return { title, content, templateId: template.id, count: reports.length }
}

app.get("/api/monthly", (_req, res) =>
  res.json(db.prepare("SELECT * FROM monthly_reports ORDER BY month DESC, id DESC").all()),
)

async function generateAiSummary(ai: AiSettings, raw: unknown) {
  if (!ai.apiKey || !ai.baseUrl || !ai.model) throw new Error("Konfigurasi AI belum lengkap.")
  assertSafeBaseUrl(ai.baseUrl)
  const system =
    "Ringkas laporan aktivitas berikut dalam Bahasa Indonesia profesional. Tulis satu paragraf eksekutif, faktual, tanpa mengarang."
  const input = `${system}\n\n${JSON.stringify(raw)}`
  const baseUrl = ai.baseUrl.replace(/\/$/, "")
  if (ai.provider === "gemini") {
    const response = await fetch(
      `${baseUrl}/models/${encodeURIComponent(ai.model)}:generateContent?key=${encodeURIComponent(ai.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: input }] }] }),
      },
    )
    if (!response.ok) throw new Error(`Gemini merespons ${response.status}.`)
    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || ""
  }
  if (ai.provider === "anthropic") {
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ai.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ai.model,
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: JSON.stringify(raw) }],
      }),
    })
    if (!response.ok) throw new Error(`Claude merespons ${response.status}.`)
    const data = (await response.json()) as {
      content?: { type: string; text?: string }[]
    }
    return (
      data.content
        ?.filter((item) => item.type === "text")
        .map((item) => item.text || "")
        .join("") || ""
    )
  }
  if (ai.provider === "openrouter") {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(raw) },
        ],
      }),
    })
    if (!response.ok) throw new Error(`OpenRouter merespons ${response.status}.`)
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    return data.choices?.[0]?.message?.content || ""
  }
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ai.apiKey}`,
    },
    body: JSON.stringify({
      model: ai.model,
      instructions: system,
      input: JSON.stringify(raw),
    }),
  })
  if (!response.ok) throw new Error(`OpenAI merespons ${response.status}.`)
  const data = (await response.json()) as {
    output_text?: string
    output?: { content?: { type: string; text?: string }[] }[]
  }
  return (
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text || "")
      .join("") ||
    ""
  )
}

app.post("/api/ai/write", async (req, res) => {
  try {
    const { content, action, context, ai } = req.body as {
      content: string
      action: AiWritingAction
      context?: string
      ai: AiSettings
    }
    if (!content || !action)
      return res.status(400).json({ message: "Konten dan aksi wajib diisi." })
    const result = await generateAiWriting(ai, content, action, context)
    res.json({ result })
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Gagal memproses dengan AI.",
    })
  }
})

app.post("/api/monthly/generate", async (req, res) => {
  try {
    const { month, templateId, projectId, useAi = false, ai = {} } = req.body
    let aiSummary = ""
    if (useAi) {
      const raw = projectId
        ? db
            .prepare(
              "SELECT report_date, title, content FROM reports WHERE substr(report_date, 1, 7) = ? AND project_id = ? ORDER BY report_date",
            )
            .all(month, projectId)
        : db
            .prepare(
              "SELECT report_date, title, content FROM reports WHERE substr(report_date, 1, 7) = ? ORDER BY report_date",
            )
            .all(month)
      aiSummary = await generateAiSummary(ai, raw)
    }
    const compiled = compileMonth(month, templateId, aiSummary, projectId)
    const result = db
      .prepare(
        "INSERT INTO monthly_reports (month, title, content, template_id, project_id, report_count) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        month,
        compiled.title,
        compiled.content,
        compiled.templateId,
        projectId || null,
        compiled.count,
      )
    res.status(201).json({ id: result.lastInsertRowid, ...compiled })
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Gagal membuat laporan.",
    })
  }
})

app.get("/api/monthly/:id/export.md", (req, res) => {
  const row = db.prepare("SELECT * FROM monthly_reports WHERE id = ?").get(req.params.id) as
    { title: string; content: string } | undefined
  if (!row) return res.status(404).end()
  res.setHeader("Content-Type", "text/markdown; charset=utf-8")
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${row.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md"`,
  )
  res.send(row.content)
})

app.get("/api/monthly/:id/export.pdf", (req, res) => {
  const row = db.prepare("SELECT * FROM monthly_reports WHERE id = ?").get(req.params.id) as
    { title: string; content: string } | undefined
  if (!row) return res.status(404).end()
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${row.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf"`,
  )
  const doc = new PDFDocument({
    size: "A4",
    margin: 54,
    info: { Title: row.title },
  })
  doc.pipe(res)
  row.content.split("\n").forEach((line) => {
    if (line.startsWith("# "))
      doc.moveDown(0.4).font("Helvetica-Bold").fontSize(22).text(line.slice(2)).moveDown(0.3)
    else if (line.startsWith("## "))
      doc.moveDown(0.5).font("Helvetica-Bold").fontSize(15).text(line.slice(3)).moveDown(0.2)
    else if (line.startsWith("### "))
      doc.moveDown(0.35).font("Helvetica-Bold").fontSize(12).text(line.slice(4))
    else if (!line.startsWith("!["))
      doc.font("Helvetica").fontSize(10).text(line.replace(/\*\*/g, ""), { lineGap: 3 })
  })
  doc.end()
})

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
  res.status(400).json({ message: error.message }),
)
const port = Number(process.env.PORT || 3001)
app.listen(port, () => console.log(`Rangkai API aktif di http://localhost:${port}`))
setInterval(() => {
  if (databaseStatus() === "unlocked") syncWatchedSources()
}, 15_000).unref()
