import fs from "node:fs";
import path from "node:path";
import { db } from "./db.js";

type Frontmatter = { title?: string; date?: string; tags?: string };

function markdownFiles(folder: string): string[] {
  const entries = fs.readdirSync(folder, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(folder, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith("."))
      return markdownFiles(fullPath);
    return entry.isFile() && /\.md$/i.test(entry.name) ? [fullPath] : [];
  });
}

export function parseMarkdown(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const meta: Frontmatter = {};
  if (match)
    match[1].split("\n").forEach((line) => {
      const index = line.indexOf(":");
      if (index > 0)
        meta[line.slice(0, index).trim() as keyof Frontmatter] = line
          .slice(index + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");
    });
  const content = match ? raw.slice(match[0].length) : raw;
  const heading = content.match(/^#\s+(.+)$/m)?.[1];
  const filename = path.basename(filePath, path.extname(filePath));
  const dateFromName = filename.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const stat = fs.statSync(filePath);
  return {
    title: meta.title || heading || filename.replace(/[-_]/g, " "),
    reportDate:
      meta.date || dateFromName || stat.mtime.toISOString().slice(0, 10),
    content,
    tags: meta.tags
      ? meta.tags
          .replace(/^\[|\]$/g, "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [],
    mtime: Math.floor(stat.mtimeMs),
  };
}

export function syncSource(sourceId: number) {
  const source = db
    .prepare("SELECT * FROM project_sources WHERE id = ?")
    .get(sourceId) as
    { id: number; project_id: number; folder_path: string } | undefined;
  if (!source) throw new Error("Sumber sinkronisasi tidak ditemukan.");
  const folder = path.resolve(source.folder_path);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory())
    throw new Error("Folder sumber tidak ditemukan atau tidak dapat dibaca.");
  let pendingNew = 0,
    pendingModified = 0,
    unchanged = 0;
  const seen: string[] = [];
  for (const filePath of markdownFiles(folder)) {
    seen.push(filePath);
    const mtime = Math.floor(fs.statSync(filePath).mtimeMs);
    const file = db
      .prepare(
        "SELECT * FROM source_files WHERE source_id = ? AND file_path = ?",
      )
      .get(sourceId, filePath) as
      | { id: number; report_id?: number; file_mtime: number; status: string }
      | undefined;
    if (!file) {
      const report = db
        .prepare(
          "SELECT id, source_mtime FROM reports WHERE project_id = ? AND source_path = ?",
        )
        .get(source.project_id, filePath) as
        { id: number; source_mtime: number } | undefined;
      const alreadyImported = report && report.source_mtime === mtime;
      db.prepare(
        "INSERT INTO source_files (source_id, report_id, file_path, relative_path, file_mtime, status, change_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(
        sourceId,
        report?.id || null,
        filePath,
        path.relative(folder, filePath),
        mtime,
        alreadyImported ? "imported" : "pending",
        alreadyImported ? "unchanged" : report ? "modified" : "new",
      );
      if (!alreadyImported) report ? pendingModified++ : pendingNew++;
      else unchanged++;
    } else if (file.file_mtime !== mtime) {
      db.prepare(
        "UPDATE source_files SET file_mtime = ?, status = 'pending', change_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(mtime, file.report_id ? "modified" : "new", file.id);
      file.report_id ? pendingModified++ : pendingNew++;
    } else unchanged++;
  }
  const files = db
    .prepare("SELECT id, file_path FROM source_files WHERE source_id = ?")
    .all(sourceId) as { id: number; file_path: string }[];
  for (const file of files)
    if (!seen.includes(file.file_path))
      db.prepare(
        "UPDATE source_files SET status = 'missing', change_type = 'missing', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(file.id);
  const message = `${pendingNew} baru, ${pendingModified} berubah, ${unchanged} tetap`;
  db.prepare(
    "UPDATE project_sources SET last_synced_at = CURRENT_TIMESTAMP, last_status = 'success', last_message = ? WHERE id = ?",
  ).run(message, sourceId);
  return { pendingNew, pendingModified, unchanged, message };
}

export function applySourceFile(fileId: number, action: "import" | "ignore") {
  const file = db
    .prepare(
      `SELECT f.*, s.project_id FROM source_files f JOIN project_sources s ON s.id = f.source_id WHERE f.id = ?`,
    )
    .get(fileId) as
    | {
        id: number;
        project_id: number;
        report_id?: number;
        file_path: string;
        file_mtime: number;
      }
    | undefined;
  if (!file) throw new Error("File sumber tidak ditemukan.");
  if (action === "ignore") {
    db.prepare(
      "UPDATE source_files SET status = 'ignored', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(file.id);
    return { action: "ignored" };
  }
  if (!fs.existsSync(file.file_path))
    throw new Error("File tidak lagi tersedia.");
  const parsed = parseMarkdown(file.file_path);
  let reportId = file.report_id;
  if (reportId) {
    db.prepare(
      "UPDATE reports SET title = ?, report_date = ?, content = ?, tags = ?, source_mtime = ?, sync_status = 'synced', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(
      parsed.title,
      parsed.reportDate,
      parsed.content,
      JSON.stringify(parsed.tags),
      parsed.mtime,
      reportId,
    );
  } else {
    const result = db
      .prepare(
        "INSERT INTO reports (project_id, title, report_date, content, status, tags, source_path, source_mtime, sync_status) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, 'synced')",
      )
      .run(
        file.project_id,
        parsed.title,
        parsed.reportDate,
        parsed.content,
        JSON.stringify(parsed.tags),
        file.file_path,
        parsed.mtime,
      );
    reportId = Number(result.lastInsertRowid);
  }
  db.prepare(
    "UPDATE source_files SET report_id = ?, file_mtime = ?, status = 'imported', change_type = 'unchanged', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(reportId, parsed.mtime, file.id);
  return { action: "imported", reportId };
}

let syncing = false;
export function syncWatchedSources() {
  if (syncing) return;
  syncing = true;
  try {
    const sources = db
      .prepare("SELECT id FROM project_sources WHERE is_watching = 1")
      .all() as { id: number }[];
    for (const source of sources) {
      try {
        syncSource(source.id);
      } catch (error) {
        db.prepare(
          "UPDATE project_sources SET last_synced_at = CURRENT_TIMESTAMP, last_status = 'error', last_message = ? WHERE id = ?",
        ).run(
          error instanceof Error ? error.message : "Sinkronisasi gagal.",
          source.id,
        );
      }
    }
  } finally {
    syncing = false;
  }
}
