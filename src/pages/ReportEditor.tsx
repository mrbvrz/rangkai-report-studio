import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  FileUp,
  ImagePlus,
  Loader2,
  Save,
  Send,
  X,
} from "../components/heroicons";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../api";
import {
  Button,
  Card,
  DatePicker,
  Field,
  Input,
  Select,
  Textarea,
} from "../components/ui/index";
import type { Project, Report } from "../types";

type Values = {
  projectId: string;
  title: string;
  reportDate: string;
  content: string;
  status: "draft" | "published";
  tags: string;
};
export function ReportEditor() {
  const params = useParams({ strict: false }) as { reportId?: string };
  const reportId = params.reportId,
    navigate = useNavigate(),
    fileRef = useRef<HTMLInputElement>(null),
    imageRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(true),
    [attachments, setAttachments] = useState<Report["attachments"]>([]),
    [notice, setNotice] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const form = useForm({
    defaultValues: {
      projectId: "",
      title: "",
      reportDate: new Date().toISOString().slice(0, 10),
      content: "",
      status: "draft",
      tags: "",
    } as Values,
    onSubmit: async ({ value }) => {
      const body = JSON.stringify({
        ...value,
        projectId: Number(value.projectId),
        tags: value.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      if (reportId) await api(`/reports/${reportId}`, { method: "PUT", body });
      else {
        const result = await api<{ id: number }>("/reports", {
          method: "POST",
          body,
        });
        await navigate({
          to: "/reports/$reportId",
          params: { reportId: String(result.id) },
        });
      }
      setNotice("Perubahan berhasil disimpan.");
      window.setTimeout(() => setNotice(""), 2500);
    },
  });
  useEffect(() => {
    api<Project[]>("/projects").then((items) => {
      setProjects(items);
      if (!reportId && items[0])
        form.setFieldValue("projectId", String(items[0].id));
    });
  }, [reportId]);
  useEffect(() => {
    if (!reportId) return;
    api<Report>(`/reports/${reportId}`).then((r) => {
      form.setFieldValue("title", r.title);
      form.setFieldValue("projectId", String(r.project_id));
      form.setFieldValue("reportDate", r.report_date);
      form.setFieldValue("content", r.content);
      form.setFieldValue("status", r.status);
      form.setFieldValue("tags", r.tags.join(", "));
      setAttachments(r.attachments);
    });
  }, [reportId]);
  function importMarkdown(file?: File) {
    if (!file) return;
    file.text().then((content) => {
      form.setFieldValue("content", content);
      if (!form.getFieldValue("title"))
        form.setFieldValue(
          "title",
          file.name.replace(/\.md$/i, "").replace(/[-_]/g, " "),
        );
    });
  }
  async function uploadImages(files?: FileList | null) {
    if (!files?.length || !reportId) return;
    const data = new FormData();
    Array.from(files).forEach((file) => data.append("images", file));
    const response = await fetch(`/api/reports/${reportId}/attachments`, {
      method: "POST",
      body: data,
    });
    if (!response.ok) throw new Error("Gagal mengunggah gambar.");
    setAttachments(await response.json());
  }
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/reports"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#e1e4dc] bg-white"
          >
            <ArrowLeft size={17} />
          </Link>
          <div>
            <p className="text-xs font-medium uppercase tracking-[.14em] text-[#7d9470]">
              {reportId ? "Edit laporan" : "Laporan baru"}
            </p>
            <h1 className="font-display text-xl font-medium">Editor harian</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            $variant="secondary"
            type="button"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp size={16} /> Impor .md
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".md,text/markdown,text/plain"
            hidden
            onChange={(e) => importMarkdown(e.target.files?.[0])}
          />
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                disabled={!canSubmit || isSubmitting}
                onClick={() => form.handleSubmit()}
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}{" "}
                Simpan
              </Button>
            )}
          </form.Subscribe>
        </div>
      </div>
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 rounded-xl bg-[#e7f3de] px-4 py-3 text-sm font-medium text-[#526d43]"
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
      <div className={`grid gap-5 ${preview ? "xl:grid-cols-2" : ""}`}>
        <Card className="p-5 md:p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-5"
          >
            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <form.Field
                name="title"
                validators={{
                  onChange: ({ value }) =>
                    !value.trim() ? "Judul wajib diisi." : undefined,
                }}
              >
                {(field) => (
                  <Field
                    label="Judul laporan"
                    error={field.state.meta.errors[0]}
                  >
                    <Input
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Contoh: Koordinasi program kerja"
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="reportDate">
                {(field) => (
                  <Field label="Tanggal">
                    <DatePicker
                      type="date"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </Field>
                )}
              </form.Field>
            </div>
            <form.Field name="projectId">
              {(field) => (
                <Field label="Project">
                  <Select
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </form.Field>
            <form.Field
              name="content"
              validators={{
                onChange: ({ value }) =>
                  value.trim().length < 5
                    ? "Isi laporan terlalu singkat."
                    : undefined,
              }}
            >
              {(field) => (
                <Field
                  label="Isi laporan"
                  hint="Markdown didukung"
                  error={field.state.meta.errors[0]}
                >
                  <Textarea
                    rows={18}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={
                      "## Aktivitas\n\nTuliskan aktivitas, hasil, dan tindak lanjut…"
                    }
                    className="font-mono !text-[13px] !leading-6"
                  />
                </Field>
              )}
            </form.Field>
            <div className="grid gap-4 md:grid-cols-2">
              <form.Field name="tags">
                {(field) => (
                  <Field label="Label" hint="Pisahkan dengan koma">
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="rapat, operasional"
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="status">
                {(field) => (
                  <Field label="Status">
                    <Select
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(e.target.value as Values["status"])
                      }
                    >
                      <option value="draft">Draf</option>
                      <option value="published">Final</option>
                    </Select>
                  </Field>
                )}
              </form.Field>
            </div>
            <div className="flex items-center justify-between border-t border-[#eceee8] pt-5">
              <button
                type="button"
                onClick={() => setPreview(!preview)}
                className="flex items-center gap-2 text-sm font-medium text-[#627358]"
              >
                <Eye size={16} /> {preview ? "Tutup preview" : "Buka preview"}
              </button>
              <Button type="submit">
                <Send size={15} /> Simpan laporan
              </Button>
            </div>
          </form>
        </Card>
        {preview && (
          <Card
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-[600px] overflow-hidden"
          >
            <div className="flex h-13 items-center justify-between border-b border-[#eceee8] px-5">
              <span className="text-xs font-medium uppercase tracking-[.14em] text-[#8a9087]">
                Preview
              </span>
              <Eye size={15} className="text-[#8a9087]" />
            </div>
            <form.Subscribe selector={(state) => state.values}>
              {(values) => (
                <article className="markdown p-6 md:p-9">
                  <p className="!mb-2 !text-xs !font-medium !uppercase !tracking-[.14em] !text-[#7c9470]">
                    {values.reportDate || "Tanggal laporan"}
                  </p>
                  <h1>{values.title || "Judul laporan"}</h1>
                  <ReactMarkdown>
                    {values.content || "_Mulai menulis untuk melihat preview._"}
                  </ReactMarkdown>
                </article>
              )}
            </form.Subscribe>
          </Card>
        )}
      </div>
      <Card className="mt-5 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-medium">Lampiran gambar</h2>
            <p className="mt-1 text-xs text-[#858b82]">
              JPG, PNG, atau WebP · maksimal 10 MB per gambar
            </p>
          </div>
          <Button
            type="button"
            $variant="secondary"
            disabled={!reportId}
            onClick={() => imageRef.current?.click()}
          >
            <ImagePlus size={16} /> Tambah gambar
          </Button>
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => uploadImages(e.target.files)}
          />
        </div>
        {!reportId && (
          <p className="mt-4 rounded-xl bg-[#fff7e5] px-4 py-3 text-xs font-medium text-[#87671f]">
            Simpan laporan terlebih dahulu sebelum menambahkan lampiran.
          </p>
        )}
        {attachments.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {attachments.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-[#eef0e9]"
              >
                <img
                  src={`/uploads/${item.filename}`}
                  alt={item.original_name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1.5 text-[10px] text-white">
                  {item.original_name}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
