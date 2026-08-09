import { motion } from "framer-motion";
import {
  CalendarDays,
  CalendarRange,
  Check,
  Download,
  FileDown,
  FileText,
  Loader2,
  Sparkles,
  WandSparkles,
} from "../components/heroicons";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api, currentMonth } from "../api";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  MonthPicker,
  Select,
} from "../components/ui/index";
import type { MonthlyReport, Project, Template } from "../types";
import { useSecurity } from "../security";

type Generated = MonthlyReport & { templateId?: number; count?: number };

export function Monthly() {
  const security = useSecurity();
  const [month, setMonth] = useState(currentMonth()),
    [templateId, setTemplateId] = useState(""),
    [useAi, setUseAi] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]),
    [projectId, setProjectId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]),
    [history, setHistory] = useState<MonthlyReport[]>([]),
    [selected, setSelected] = useState<Generated | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = () =>
    Promise.all([
      api<Template[]>("/templates").then((items) => {
        setTemplates(items);
        if (!templateId && items[0]) setTemplateId(String(items[0].id));
      }),
      api<MonthlyReport[]>("/monthly").then(setHistory),
      api<Project[]>("/projects").then((items) => {
        setProjects(items);
        if (!projectId && items[0]) setProjectId(String(items[0].id));
      }),
    ]);
  useEffect(() => {
    void load();
  }, []);
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const saved = await security.readAiConfig();
      const data = await api<Generated>("/monthly/generate", {
        method: "POST",
        body: JSON.stringify({
          month,
          templateId: Number(templateId),
          projectId: Number(projectId),
          useAi,
          ai: saved,
        }),
      });
      setSelected(data);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat laporan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#e8f2e2] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[.14em] text-[#648054]">
            <CalendarRange size={13} /> Kompilasi
          </div>
          <h1 className="font-display text-3xl font-medium tracking-[-.05em] md:text-4xl">
            Laporan bulanan
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#747b72]">
            Rangkai catatan harian menjadi satu dokumen yang siap dibaca,
            dibagikan, dan diekspor.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-[#e3e7df] bg-white/70 px-4 py-3 text-xs text-[#737b70]">
          <CalendarDays size={16} className="text-[#789568]" />
          <span>Periode aktif</span>
          <strong className="text-[#3f493b]">{month}</strong>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[350px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-[#e8ebe4] bg-[#fbfcf9] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#dff0d3] text-[#5f7f4e]">
                  <WandSparkles size={20} />
                </div>
                <div>
                  <h2 className="font-display font-medium">Susun laporan</h2>
                  <p className="mt-1 text-xs text-[#858c82]">
                    Pilih sumber dan gaya dokumen
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-6">
              <Field label="Project">
                <Select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  {projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Periode">
                <MonthPicker
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </Field>
              <Field label="Template">
                <Select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  {templates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${useAi ? "border-[#bcd5ae] bg-[#f0f7eb]" : "border-[#e2e5dd] bg-[#fafbf8]"}`}
              >
                <input
                  type="checkbox"
                  checked={useAi}
                  onChange={(e) => setUseAi(e.target.checked)}
                  className="mt-1 accent-[#617e50]"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Sparkles size={14} className="text-[#75945e]" /> Ringkasan
                    dengan AI
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[#82887f]">
                    Buat ringkasan eksekutif dari catatan harian secara
                    otomatis.
                  </span>
                </span>
              </label>
              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
                  {error}
                </p>
              )}
              <Button
                className="w-full !rounded-2xl !py-3"
                onClick={generate}
                disabled={busy || !month || !projectId}
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <WandSparkles size={16} />
                )}{" "}
                {busy ? "Sedang merangkai…" : "Generate laporan"}
              </Button>
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#e8ebe4] px-5 py-4">
              <div>
                <h2 className="font-display text-sm font-medium">
                  Riwayat dokumen
                </h2>
                <p className="mt-1 text-[11px] text-[#858b82]">
                  {history.length} dokumen tersimpan
                </p>
              </div>
              <FileText size={17} className="text-[#91a18a]" />
            </div>
            <div className="max-h-80 overflow-auto">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={`flex w-full items-center gap-3 border-b border-[#eff0eb] px-5 py-3.5 text-left transition last:border-0 hover:bg-[#f7faf5] ${selected?.id === item.id ? "bg-[#eef6e9]" : ""}`}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#edf3e9] text-[#718568]">
                    <CalendarRange size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{item.title}</p>
                    <p className="mt-1 text-[10px] text-[#8b9188]">
                      {item.report_count} laporan ·{" "}
                      {item.created_at.slice(0, 10)}
                    </p>
                  </div>
                  {selected?.id === item.id && (
                    <Check size={15} className="text-[#668456]" />
                  )}
                </button>
              ))}
              {!history.length && (
                <p className="p-6 text-center text-xs text-[#858b82]">
                  Belum ada riwayat dokumen.
                </p>
              )}
            </div>
          </Card>
        </div>
        <div>
          {selected ? (
            <Card className="min-h-[620px] overflow-hidden">
              <div className="flex flex-col justify-between gap-4 border-b border-[#e8ebe4] bg-[#fbfcf9] px-6 py-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[.15em] text-[#809475]">
                    Dokumen siap dibagikan
                  </p>
                  <h2 className="mt-1 font-display text-xl font-medium tracking-[-.03em]">
                    {selected.title}
                  </h2>
                  <p className="mt-1 text-xs text-[#858b82]">
                    {selected.report_count || selected.count || 0} laporan
                    dirangkum dalam dokumen ini
                  </p>
                </div>
                <div className="flex gap-2">
                  <a href={`/api/monthly/${selected.id}/export.md`}>
                    <Button $variant="secondary">
                      <FileDown size={15} /> Markdown
                    </Button>
                  </a>
                  <a href={`/api/monthly/${selected.id}/export.pdf`}>
                    <Button>
                      <Download size={15} /> PDF
                    </Button>
                  </a>
                </div>
              </div>
              <article className="markdown bg-white px-6 py-8 md:px-12 md:py-12">
                <ReactMarkdown>{selected.content}</ReactMarkdown>
              </article>
            </Card>
          ) : (
            <div className="grid min-h-[620px] place-items-center rounded-[18px] border border-dashed border-[#d7dbd2] bg-white/45 p-8 text-center">
              <div>
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-[#e7f2df] text-[#698457]">
                  <WandSparkles size={26} />
                </div>
                <h2 className="font-display text-lg font-medium">
                  Preview laporan bulanan
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#747b72]">
                  Pilih periode dan template, lalu generate untuk melihat
                  dokumen hasil kompilasi di sini.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
