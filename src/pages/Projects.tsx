import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  ChevronRight,
  FileClock,
  FileText,
  Folder,
  FolderKanban,
  FolderOpen,
  FolderSync,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "../components/heroicons"
import { useEffect, useMemo, useState } from "react"
import { api } from "../api"
import { Button, Card, EmptyState, Field, Input, Textarea } from "../components/ui/index"
import type { Project, ProjectSource, SourceFile } from "../types"

const colors = ["#6c8f58", "#547da1", "#a76b51", "#80649a", "#b18b37", "#4d8c83"]
type DirectoryView = {
  current: string
  parent: string | null
  directories: { name: string; path: string }[]
  markdownCount: number
}

function FolderPicker({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (path: string) => void
}) {
  const [view, setView] = useState<DirectoryView | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("")
  const browse = async (path?: string) => {
    setLoading(true)
    setError("")
    try {
      setView(
        await api<DirectoryView>(
          `/filesystem/directories${path ? `?path=${encodeURIComponent(path)}` : ""}`,
        ),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Folder tidak dapat dibuka.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void browse()
  }, [])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#20251f]/45 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#e0e3db] bg-[#fbfbf8] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#e6e8e2] px-5 py-4">
          <div>
            <h2 className="font-display font-medium">Pilih folder laporan</h2>
            <p className="mt-1 text-xs text-[#82887f]">
              Pilih folder yang dapat dibaca server lokal.
            </p>
          </div>
          <button
            aria-label="Tutup pemilih folder"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-[#eef0ea]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="border-b border-[#e9ebe5] bg-white px-5 py-3">
          <div className="flex items-center gap-2 overflow-hidden font-mono text-xs text-[#66705f]">
            <FolderOpen size={15} className="shrink-0" />
            <span className="truncate">{view?.current || "Memuat…"}</span>
          </div>
        </div>
        <div className="min-h-72 max-h-[420px] overflow-auto p-3">
          {loading ? (
            <div className="grid h-64 place-items-center">
              <Loader2 className="animate-spin text-[#718665]" />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-600">{error}</div>
          ) : (
            <div className="space-y-1">
              {view?.parent && (
                <button
                  onClick={() => browse(view.parent!)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#eff2eb]"
                >
                  <ArrowLeft size={17} className="text-[#71806a]" />
                  <span className="text-sm font-medium">Folder induk</span>
                </button>
              )}
              {view?.directories.map((directory) => (
                <button
                  key={directory.path}
                  onClick={() => browse(directory.path)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#eff2eb]"
                >
                  <Folder size={18} className="text-[#809871]" fill="#e3efdc" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {directory.name}
                  </span>
                  <ChevronRight size={15} className="text-[#a1a79e]" />
                </button>
              ))}
              {!view?.directories.length && (
                <p className="p-8 text-center text-xs text-[#8a9087]">Tidak ada subfolder.</p>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e6de] bg-white px-5 py-4">
          <p className="text-xs text-[#7f857c]">
            <strong className="text-[#465043]">{view?.markdownCount || 0}</strong> file Markdown
            langsung di folder ini
          </p>
          <div className="flex gap-2">
            <Button $variant="ghost" onClick={onClose}>
              Batal
            </Button>
            <Button disabled={!view} onClick={() => view && onSelect(view.current)}>
              <FolderOpen size={16} /> Pilih folder ini
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function SourceFiles({
  source,
  selected,
  onToggle,
  onAll,
  onAction,
  onSync,
  onWatch,
  onRemove,
  busy,
}: {
  source: ProjectSource
  selected: number[]
  onToggle: (id: number) => void
  onAll: (files: SourceFile[]) => void
  onAction: (action: "import" | "ignore") => void
  onSync: () => void
  onWatch: () => void
  onRemove: () => void
  busy: boolean
}) {
  const pending = source.files.filter((file) => file.status === "pending")
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e2e5dd] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e8eae4] p-4 md:flex-row md:items-center">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf3e9] text-[#657a59]">
          <FolderSync size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs font-medium">{source.folder_path}</p>
          <p className="mt-1 text-[10px] text-[#858b82]">
            {source.last_message || "Belum dipindai"}{" "}
            {source.last_synced_at && `· ${source.last_synced_at}`}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={!!source.is_watching}
            onChange={onWatch}
            className="accent-[#698657]"
          />{" "}
          Watch
        </label>
        <button
          aria-label="Pindai folder"
          onClick={onSync}
          disabled={busy}
          className="rounded-lg p-2 hover:bg-[#eff2eb]"
        >
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
        </button>
        <button
          aria-label="Hapus sumber"
          onClick={onRemove}
          className="rounded-lg p-2 text-[#9b6c62] hover:bg-red-50"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#fafbf8] px-4 py-3">
        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={pending.length > 0 && pending.every((file) => selected.includes(file.id))}
            onChange={() => onAll(pending)}
            className="accent-[#698657]"
          />{" "}
          {pending.length} menunggu aksi
        </label>
        {selected.length > 0 && (
          <div className="flex gap-2">
            <Button $variant="secondary" onClick={() => onAction("ignore")}>
              Abaikan ({selected.length})
            </Button>
            <Button onClick={() => onAction("import")}>
              {selected.some(
                (id) => source.files.find((file) => file.id === id)?.change_type === "modified",
              )
                ? "Re-sync"
                : "Impor"}{" "}
              ({selected.length})
            </Button>
          </div>
        )}
      </div>
      <div className="max-h-80 overflow-auto">
        {source.files.map((file) => (
          <label
            key={file.id}
            className={`flex items-center gap-3 border-t border-[#eff1ec] px-4 py-3 ${file.status === "pending" ? "cursor-pointer bg-[#fffdf7]" : ""}`}
          >
            <input
              type="checkbox"
              disabled={file.status !== "pending"}
              checked={selected.includes(file.id)}
              onChange={() => onToggle(file.id)}
              className="accent-[#698657]"
            />
            <div
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${file.change_type === "modified" && file.status === "pending" ? "bg-[#fff0d8] text-[#a06d1f]" : "bg-[#eff2ec] text-[#708067]"}`}
            >
              {file.change_type === "modified" ? <FileClock size={15} /> : <FileText size={15} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{file.relative_path}</p>
              <p className="mt-1 text-[10px] text-[#8a9087]">
                {file.change_type === "new"
                  ? "File baru"
                  : file.change_type === "modified"
                    ? "Perubahan terdeteksi"
                    : file.change_type === "missing"
                      ? "File tidak ditemukan"
                      : "Sudah sinkron"}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-[9px] font-medium uppercase ${file.status === "pending" ? "bg-[#fff0cf] text-[#91671e]" : file.status === "imported" ? "bg-[#e7f2df] text-[#5e784f]" : file.status === "ignored" ? "bg-[#eeeeea] text-[#777d74]" : "bg-red-50 text-red-600"}`}
            >
              {file.status === "pending"
                ? "Menunggu"
                : file.status === "imported"
                  ? "Diimpor"
                  : file.status === "ignored"
                    ? "Diabaikan"
                    : "Hilang"}
            </span>
          </label>
        ))}
        {!source.files.length && (
          <p className="p-8 text-center text-xs text-[#858b82]">
            Belum ada file Markdown pada folder ini.
          </p>
        )}
      </div>
    </div>
  )
}

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]),
    [active, setActive] = useState<Project | null>(null),
    [creating, setCreating] = useState(false),
    [editing, setEditing] = useState(false),
    [deleting, setDeleting] = useState(false),
    [picker, setPicker] = useState(false)
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [color, setColor] = useState(colors[0]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("")
  const [selected, setSelected] = useState<Record<number, number[]>>({})
  const loadProjects = async (preferredId?: number, selectFirst = false) => {
    const list = await api<Project[]>("/projects")
    setProjects(list)
    const id = preferredId || (!selectFirst && active?.id) || list[0]?.id
    if (id) setActive(await api<Project>(`/projects/${id}`))
    else setActive(null)
  }
  useEffect(() => {
    void loadProjects()
  }, [])
  async function createProject() {
    setBusy(true)
    try {
      const result = await api<{ id: number }>("/projects", {
        method: "POST",
        body: JSON.stringify({ name, description, color }),
      })
      setCreating(false)
      setName("")
      setDescription("")
      await loadProjects(result.id)
    } finally {
      setBusy(false)
    }
  }
  function startEdit() {
    if (!active) return
    setName(active.name)
    setDescription(active.description)
    setColor(active.color)
    setEditing(true)
  }
  async function updateProject() {
    if (!active) return
    setBusy(true)
    try {
      await api(`/projects/${active.id}`, {
        method: "PUT",
        body: JSON.stringify({ name, description, color }),
      })
      setEditing(false)
      await loadProjects(active.id)
    } finally {
      setBusy(false)
    }
  }
  async function deleteProject() {
    if (!active) return
    setBusy(true)
    setMessage("")
    try {
      const result = await api<{ preservedReports: number }>(`/projects/${active.id}`, {
        method: "DELETE",
      })
      setDeleting(false)
      await loadProjects(undefined, true)
      setMessage(`Project dihapus. ${result.preservedReports} laporan tetap tersimpan.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Project gagal dihapus.")
      setDeleting(false)
    } finally {
      setBusy(false)
    }
  }
  async function addSource(folderPath: string) {
    if (!active) return
    setPicker(false)
    setBusy(true)
    setMessage("")
    try {
      const result = await api<{ message: string }>(`/projects/${active.id}/sources`, {
        method: "POST",
        body: JSON.stringify({ folderPath, isWatching: true }),
      })
      setMessage(`Pemindaian selesai: ${result.message}. Pilih file yang ingin diimpor.`)
      await loadProjects(active.id)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menambahkan folder.")
    } finally {
      setBusy(false)
    }
  }
  async function sourceAction(source: ProjectSource, action: "import" | "ignore") {
    const ids = selected[source.id] || []
    if (!ids.length) return
    setBusy(true)
    try {
      await api("/source-files/actions", {
        method: "POST",
        body: JSON.stringify({ fileIds: ids, action }),
      })
      setSelected({ ...selected, [source.id]: [] })
      await loadProjects(active!.id)
    } finally {
      setBusy(false)
    }
  }
  async function sync(source: ProjectSource) {
    setBusy(true)
    try {
      const result = await api<{ message: string }>(`/sources/${source.id}/sync`, {
        method: "POST",
      })
      setMessage(result.message)
      await loadProjects(active!.id)
    } finally {
      setBusy(false)
    }
  }
  async function toggleWatch(source: ProjectSource) {
    await api(`/sources/${source.id}`, {
      method: "PUT",
      body: JSON.stringify({ isWatching: !source.is_watching }),
    })
    await loadProjects(active!.id)
  }
  async function removeSource(source: ProjectSource) {
    if (!confirm("Hapus folder dari daftar? Laporan yang sudah diimpor tetap disimpan.")) return
    await api(`/sources/${source.id}`, { method: "DELETE" })
    await loadProjects(active!.id)
  }
  const pendingTotal = useMemo(
    () =>
      active?.sources?.flatMap((source) => source.files).filter((file) => file.status === "pending")
        .length || 0,
    [active],
  )
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {picker && <FolderPicker onClose={() => setPicker(false)} onSelect={addSource} />}
      {deleting && active && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#20251f]/45 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6">
            <h2 className="font-display text-lg font-medium">Hapus project {active.name}?</h2>
            <p className="mt-2 text-sm leading-6 text-[#747b71]">
              Project, folder sumber, dan metadata sinkronisasinya akan dihapus. Semua laporan yang
              sudah diimpor beserta lampirannya tetap tersimpan dan tidak akan dihapus.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button $variant="secondary" disabled={busy} onClick={() => setDeleting(false)}>
                Batal
              </Button>
              <Button $variant="danger" disabled={busy} onClick={deleteProject}>
                {busy ? "Menghapus…" : "Hapus project"}
              </Button>
            </div>
          </Card>
        </div>
      )}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[.15em] text-[#789168]">
            Workspace
          </p>
          <h1 className="font-display text-3xl font-medium tracking-[-.04em]">Project</h1>
          <p className="mt-2 text-sm text-[#777d74]">
            Kelompokkan laporan dan setujui perubahan Markdown sebelum diimpor.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(false)
            setName("")
            setDescription("")
            setColor(colors[0])
            setCreating(true)
          }}
        >
          <Plus size={16} /> Project baru
        </Button>
      </div>
      <AnimatePresence>
        {(creating || editing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-[#20251f]/45 p-4 backdrop-blur-sm"
          >
            <Card
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className="w-full max-w-lg overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-[#e6e8e2] px-6 py-5">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[.14em] text-[#789168]">
                    Project
                  </p>
                  <h2 className="mt-1 font-display text-lg font-medium">
                    {editing ? "Edit project" : "Project baru"}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Tutup modal"
                  disabled={busy}
                  onClick={() => {
                    setCreating(false)
                    setEditing(false)
                  }}
                  className="rounded-lg p-2 text-[#777e74] transition hover:bg-[#eef0ea]"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4 p-6">
                <Field label="Nama project">
                  <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Deskripsi">
                  <Textarea
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Jelaskan tujuan atau konteks project…"
                  />
                </Field>
                <div>
                  <span className="mb-3 block text-sm font-medium">Warna</span>
                  <div className="flex flex-wrap gap-3">
                    {colors.map((item) => (
                      <button
                        type="button"
                        key={item}
                        aria-label={`Pilih warna ${item}`}
                        onClick={() => setColor(item)}
                        className={`h-8 w-8 rounded-full transition ${color === item ? "ring-2 ring-[#465742] ring-offset-2" : "hover:scale-110"}`}
                        style={{ background: item }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-[#e6e8e2] bg-[#fafbf8] px-6 py-4">
                <Button
                  $variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setCreating(false)
                    setEditing(false)
                  }}
                >
                  Batal
                </Button>
                <Button
                  disabled={!name.trim() || busy}
                  onClick={editing ? updateProject : createProject}
                >
                  {busy ? "Menyimpan…" : editing ? "Simpan perubahan" : "Buat project"}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      {projects.length ? (
        <div className="grid gap-5 xl:grid-cols-[270px_1fr]">
          <div className="space-y-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => loadProjects(project.id)}
                className={`w-full rounded-2xl border p-4 text-left ${active?.id === project.id ? "border-[#cddbc4] bg-white shadow-sm" : "border-transparent hover:bg-white/70"}`}
              >
                <div className="flex gap-3">
                  <span
                    className="mt-1 h-3 w-3 rounded-full"
                    style={{ background: project.color }}
                  />
                  <div>
                    <p className="font-display text-sm font-medium">{project.name}</p>
                    <p className="mt-1 text-xs text-[#858b82]">
                      {project.report_count || 0} laporan · {project.source_count || 0} sumber
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {active && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="space-y-5"
              >
                <Card className="flex flex-wrap items-center gap-4 p-6">
                  <div
                    className="grid h-12 w-12 place-items-center rounded-2xl text-white"
                    style={{ background: active.color }}
                  >
                    <FolderKanban size={21} />
                  </div>
                  <div className="min-w-48 flex-1">
                    <h2 className="font-display text-xl font-medium">{active.name}</h2>
                    <p className="mt-1 text-sm text-[#7b8178]">
                      {active.description || "Belum ada deskripsi."}
                    </p>
                  </div>
                  {pendingTotal > 0 && (
                    <span className="rounded-full bg-[#fff0cf] px-3 py-1.5 text-xs font-medium text-[#8e651e]">
                      {pendingTotal} menunggu aksi
                    </span>
                  )}
                  <div className="flex gap-2">
                    <Button $variant="secondary" onClick={startEdit}>
                      <Pencil size={15} /> Edit
                    </Button>
                    <Button
                      $variant="danger"
                      disabled={projects.length <= 1}
                      onClick={() => setDeleting(true)}
                      title={
                        projects.length <= 1 ? "Minimal satu project harus tersedia" : undefined
                      }
                    >
                      <Trash2 size={15} /> Hapus
                    </Button>
                  </div>
                </Card>
                {message && (
                  <p
                    className={`rounded-xl px-4 py-3 text-xs font-medium ${/gagal|tidak/i.test(message) ? "bg-red-50 text-red-700" : "bg-[#eef4e9] text-[#5d7451]"}`}
                  >
                    {message}
                  </p>
                )}
                <Card className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display font-medium">Folder sumber</h2>
                      <p className="mt-1 text-xs text-[#81877e]">
                        File baru dan berubah tidak diimpor sampai Anda menyetujuinya.
                      </p>
                    </div>
                    <Button onClick={() => setPicker(true)}>
                      <FolderOpen size={16} /> Pilih folder
                    </Button>
                  </div>
                </Card>
                {active.sources?.map((source) => (
                  <SourceFiles
                    key={source.id}
                    source={source}
                    busy={busy}
                    selected={selected[source.id] || []}
                    onToggle={(id) =>
                      setSelected({
                        ...selected,
                        [source.id]: (selected[source.id] || []).includes(id)
                          ? (selected[source.id] || []).filter((item) => item !== id)
                          : [...(selected[source.id] || []), id],
                      })
                    }
                    onAll={(files) =>
                      setSelected({
                        ...selected,
                        [source.id]: files.every((file) =>
                          (selected[source.id] || []).includes(file.id),
                        )
                          ? []
                          : files.map((file) => file.id),
                      })
                    }
                    onAction={(action) => sourceAction(source, action)}
                    onSync={() => sync(source)}
                    onWatch={() => toggleWatch(source)}
                    onRemove={() => removeSource(source)}
                  />
                ))}
                {!active.sources?.length && (
                  <EmptyState
                    icon={<FolderSync size={20} />}
                    title="Belum ada folder"
                    body="Gunakan tombol Pilih folder untuk menambahkan sumber Markdown."
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<FolderKanban size={20} />}
          title="Belum ada project"
          body="Buat project pertama untuk mulai."
        />
      )}
    </motion.div>
  )
}
