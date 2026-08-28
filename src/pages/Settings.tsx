import { AnimatePresence, motion } from "framer-motion"
import {
  Check,
  DatabaseBackup,
  Download,
  FileUp,
  KeyRound,
  LockKeyhole,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from "../components/heroicons"
import { useEffect, useMemo, useRef, useState } from "react"
import { api } from "../api"
import { Button, Card, Field, Input } from "../components/ui/index"
import { PinInput, useSecurity, validatePassphrase, validatePin } from "../security"

type ProviderId = "openai" | "gemini" | "anthropic" | "openrouter"
type AiConfig = {
  provider: ProviderId
  apiKey: string
  model: string
  baseUrl?: string
}
type Tab = "profile" | "ai" | "security" | "data"
const providers = [
  {
    id: "openai" as const,
    name: "ChatGPT",
    company: "OpenAI",
    color: "#111",
    description: "Gunakan model OpenAI melalui Responses API.",
    baseUrl: "https://api.openai.com/v1",
    modelHint: "Contoh: gpt-5-mini",
  },
  {
    id: "gemini" as const,
    name: "Gemini",
    company: "Google",
    color: "#3976e8",
    description: "Ringkasan melalui Gemini generateContent API.",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelHint: "Contoh: gemini-2.5-flash",
  },
  {
    id: "anthropic" as const,
    name: "Claude",
    company: "Anthropic",
    color: "#c66f45",
    description: "Gunakan Anthropic Messages API.",
    baseUrl: "https://api.anthropic.com/v1",
    modelHint: "Masukkan ID model Claude",
  },
  {
    id: "openrouter" as const,
    name: "OpenRouter",
    company: "Multi-provider",
    color: "#6c5ce7",
    description: "Akses berbagai model melalui satu endpoint.",
    baseUrl: "https://openrouter.ai/api/v1",
    modelHint: "Contoh: openai/gpt-4.1-mini",
  },
]

export function Settings() {
  const security = useSecurity()
  const [tab, setTab] = useState<Tab>("ai"),
    [provider, setProvider] = useState<ProviderId>("openai")
  const active = useMemo(() => providers.find((item) => item.id === provider)!, [provider])
  const [apiKey, setApiKey] = useState(""),
    [model, setModel] = useState(""),
    [baseUrl, setBaseUrl] = useState(active.baseUrl),
    [saved, setSaved] = useState(false)
  useEffect(() => {
    void security.readAiConfig<AiConfig>().then((stored) => {
      if (stored.provider) setProvider(stored.provider)
      if (stored.apiKey) setApiKey(stored.apiKey)
      if (stored.model) setModel(stored.model)
      if (stored.baseUrl) setBaseUrl(stored.baseUrl)
    })
  }, [])
  function chooseProvider(id: ProviderId) {
    const next = providers.find((item) => item.id === id)!
    setProvider(id)
    setBaseUrl(next.baseUrl)
    setModel("")
    setSaved(false)
  }
  async function save() {
    await security.saveAiConfig({ provider, baseUrl, model, apiKey })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }
  const tabs = [
    {
      id: "profile" as const,
      label: "Profil",
      detail: "Foto, nama & email",
      icon: User,
    },
    {
      id: "ai" as const,
      label: "AI",
      detail: "Provider & API key",
      icon: Sparkles,
    },
    {
      id: "security" as const,
      label: "Keamanan",
      detail: "Passphrase, PIN & enkripsi",
      icon: ShieldCheck,
    },
    {
      id: "data" as const,
      label: "Data & Backup",
      detail: "Export, import & reset",
      icon: DatabaseBackup,
    },
  ]
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mb-7">
        <p className="mb-2 text-xs font-medium uppercase tracking-[.15em] text-[#789168]">
          Workspace
        </p>
        <h1 className="font-display text-3xl font-medium tracking-[-.04em]">Pengaturan</h1>
        <p className="mt-2 text-sm text-[#777d74]">
          Kelola preferensi, keamanan, dan data aplikasi.
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="h-fit space-y-2">
          <nav className="space-y-2">
            {tabs.map(({ id, label, detail, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border p-4 text-left transition ${tab === id ? "border-[#cddbc4] bg-white text-[#405437] shadow-sm" : "border-transparent text-[#70776d] hover:bg-white/70"}`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tab === id ? "bg-[#eaf3e3] text-[#5e7b50]" : "bg-[#e8ece5]"}`}
                >
                  <Icon size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-sm font-medium">{label}</span>
                  <small className="mt-0.5 block truncate text-[10px] opacity-65">{detail}</small>
                </span>
              </button>
            ))}
          </nav>
        </aside>
        <motion.section
          layout
          className="transition-all duration-200 min-w-0 rounded-2xl border border-[#e5e7e0] bg-white p-6 lg:p-8"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {tab === "profile" ? (
                <ProfilePanel />
              ) : tab === "ai" ? (
                <AiPanel
                  active={active}
                  provider={provider}
                  apiKey={apiKey}
                  model={model}
                  baseUrl={baseUrl}
                  saved={saved}
                  encrypted={security.encrypted}
                  chooseProvider={chooseProvider}
                  setApiKey={setApiKey}
                  setModel={setModel}
                  setBaseUrl={setBaseUrl}
                  save={save}
                />
              ) : tab === "security" ? (
                <SecurityPanel />
              ) : (
                <DataPanel />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.section>
      </div>
    </motion.div>
  )
}

function ProviderLogo({ id }: { id: ProviderId }) {
  if (id === "openai")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="h-7 w-7 fill-none stroke-white"
        strokeWidth="2.3"
      >
        <path d="M16 5.5a6 6 0 0 1 5.2 3l.7 1.3a6 6 0 0 1 3.4 8.9 6 6 0 0 1-6.3 7.1 6 6 0 0 1-7.6 1.4 6 6 0 0 1-5.2-3l-.7-1.3a6 6 0 0 1-3.4-8.9 6 6 0 0 1 6.3-7.1A6 6 0 0 1 16 5.5Z" />
        <path d="m11.2 11.3 5.1-2.9 4.8 2.8v5.7l-5 2.9-4.9-2.8v-5.7Zm0 5.7-4.9 2.9m9.8-2.9v5.7m0-11.4 4.9-2.9" />
      </svg>
    )
  if (id === "gemini")
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7">
        <path
          fill="#fff"
          d="M16 2c.9 7.4 4.6 11.1 12 12-7.4.9-11.1 4.6-12 12-.9-7.4-4.6-11.1-12-12C11.4 13.1 15.1 9.4 16 2Z"
        />
        <path
          fill="#b7d8ff"
          d="M7 24c.5 2.6 1.8 4 4.5 4.5C8.8 29 7.5 30.2 7 33c-.5-2.8-1.8-4-4.5-4.5C5.2 28 6.5 26.6 7 24Z"
        />
      </svg>
    )
  if (id === "anthropic")
    return (
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 fill-white">
        <path d="M16 3.5 19 12l8.5 3-8.5 3-3 8.5-3-8.5-8.5-3 8.5-3 3-8.5Z" />
        <path d="m25.5 4.5 1.1 3.1 3.1 1.1-3.1 1.1-1.1 3.1-1.1-3.1-3.1-1.1 3.1-1.1 1.1-3.1Z" />
      </svg>
    )
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="h-7 w-7 fill-none stroke-white"
      strokeWidth="3"
    >
      <path d="m6 8 8 8-8 8M18 8l8 8-8 8" />
    </svg>
  )
}

function AiPanel({
  active,
  provider,
  apiKey,
  model,
  baseUrl,
  saved,
  encrypted,
  chooseProvider,
  setApiKey,
  setModel,
  setBaseUrl,
  save,
}: {
  active: (typeof providers)[number]
  provider: ProviderId
  apiKey: string
  model: string
  baseUrl: string
  saved: boolean
  encrypted: boolean
  chooseProvider: (id: ProviderId) => void
  setApiKey: (v: string) => void
  setModel: (v: string) => void
  setBaseUrl: (v: string) => void
  save: () => Promise<void>
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-medium">Provider AI</h2>
        <p className="mt-1 text-xs text-[#858b82]">
          Pilih layanan untuk menyusun ringkasan eksekutif.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {providers.map((item) => (
          <button
            key={item.id}
            onClick={() => chooseProvider(item.id)}
            className={`relative rounded-2xl border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${provider === item.id ? "border-[#8ba17f] ring-3 ring-[#edf4e9]" : "border-[#e3e5df]"}`}
          >
            {provider === item.id && (
              <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-[#638153] text-white">
                <Check size={12} />
              </span>
            )}
            <div
              className="grid h-11 w-11 place-items-center rounded-xl"
              style={{ background: item.color }}
            >
              <ProviderLogo id={item.id} />
            </div>
            <h3 className="font-display mt-4 font-medium">{item.name}</h3>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[.12em] text-[#92978f]">
              {item.company}
            </p>
            <p className="mt-3 text-xs leading-5 text-[#777d74]">{item.description}</p>
          </button>
        ))}
      </div>
      <div className="grid max-w-5xl gap-5 md:grid-cols-[1fr_280px]">
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <div
              className="grid h-11 w-11 place-items-center rounded-xl"
              style={{ background: active.color }}
            >
              <ProviderLogo id={active.id} />
            </div>
            <div>
              <h2 className="font-display font-medium">Konfigurasi {active.name}</h2>
              <p className="text-xs text-[#858b82]">Kredensial untuk {active.company}</p>
            </div>
          </div>
          <div className="space-y-5">
            <Field label="API key">
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </Field>
            <Field label="Model">
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={active.modelHint}
              />
            </Field>
            <Field label="Base URL">
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </Field>
            <Button disabled={!apiKey || !model} onClick={() => void save()}>
              {saved ? <Check size={16} /> : <Save size={16} />}{" "}
              {saved ? "Tersimpan" : "Simpan konfigurasi"}
            </Button>
          </div>
        </Card>
        <Card className="p-5">
          <ShieldCheck size={20} className="text-[#668255]" />
          <h3 className="font-display mt-4 text-sm font-medium">
            {encrypted ? "Terenkripsi lokal" : "Kredensial lokal"}
          </h3>
          <p className="mt-2 text-xs leading-5 text-[#7d837a]">
            {encrypted
              ? "API key dilindungi AES-GCM menggunakan kunci dari passphrase."
              : "Aktifkan enkripsi pada menu Keamanan untuk melindungi API key."}
          </p>
        </Card>
      </div>
    </div>
  )
}

function SecurityPanel() {
  const security = useSecurity(),
    [passphrase, setPassphrase] = useState(""),
    [confirm, setConfirm] = useState(""),
    [currentPassphrase, setCurrentPassphrase] = useState(""),
    [nextPassphrase, setNextPassphrase] = useState(""),
    [nextConfirm, setNextConfirm] = useState(""),
    [encrypt, setEncrypt] = useState(true),
    [error, setError] = useState(""),
    [recoveryCode, setRecoveryCode] = useState(""),
    [busy, setBusy] = useState(false),
    [pinModal, setPinModal] = useState<null | "setup" | "change" | "remove">(null),
    [pinPass, setPinPass] = useState(""),
    [pin, setPin] = useState(""),
    [pinConfirm, setPinConfirm] = useState(""),
    [pinCurrent, setPinCurrent] = useState(""),
    [pinNew, setPinNew] = useState(""),
    [pinNewConfirm, setPinNewConfirm] = useState(""),
    [pinRemovePass, setPinRemovePass] = useState(""),
    [pinError, setPinError] = useState(""),
    [pinBusy, setPinBusy] = useState(false),
    [pinShake, setPinShake] = useState(0),
    [pinToast, setPinToast] = useState("")
  useEffect(() => {
    if (!pinToast) return
    const t = setTimeout(() => setPinToast(""), 2200)
    return () => clearTimeout(t)
  }, [pinToast])
  async function enable() {
    const issue = validatePassphrase(passphrase)
    if (issue) return setError(issue)
    if (passphrase !== confirm) return setError("Konfirmasi passphrase tidak sama.")
    setBusy(true)
    setError("")
    try {
      setRecoveryCode(await security.createProtection(passphrase, encrypt))
      setPassphrase("")
      setConfirm("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal mengaktifkan keamanan.")
    } finally {
      setBusy(false)
    }
  }
  async function changePassphrase() {
    const issue = validatePassphrase(nextPassphrase)
    if (issue) return setError(issue)
    if (nextPassphrase !== nextConfirm) return setError("Konfirmasi passphrase baru tidak sama.")
    setBusy(true)
    setError("")
    try {
      await security.changePassphrase(currentPassphrase, nextPassphrase)
      setCurrentPassphrase("")
      setNextPassphrase("")
      setNextConfirm("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal mengubah passphrase.")
    } finally {
      setBusy(false)
    }
  }
  const resetPinModal = () => {
    setPinPass("")
    setPin("")
    setPinConfirm("")
    setPinCurrent("")
    setPinNew("")
    setPinNewConfirm("")
    setPinRemovePass("")
    setPinError("")
    setPinBusy(false)
    setPinModal(null)
  }
  const handleSetupPin = async () => {
    if (pin !== pinConfirm) {
      setPinShake((k) => k + 1)
      setPinToast("Konfirmasi PIN tidak sama.")
      return
    }
    const issue = validatePin(pin)
    if (issue) {
      setPinShake((k) => k + 1)
      setPinToast(issue)
      return
    }
    setPinBusy(true)
    setPinError("")
    try {
      await security.setPin(pinPass, pin)
      resetPinModal()
    } catch (e) {
      setPinShake((k) => k + 1)
      setPinToast(e instanceof Error ? e.message : "Gagal mengatur PIN.")
    } finally {
      setPinBusy(false)
    }
  }
  const handleChangePin = async () => {
    if (pinNew !== pinNewConfirm) {
      setPinShake((k) => k + 1)
      setPinToast("Konfirmasi PIN baru tidak sama.")
      return
    }
    const issue = validatePin(pinNew)
    if (issue) {
      setPinShake((k) => k + 1)
      setPinToast(issue)
      return
    }
    setPinBusy(true)
    setPinError("")
    try {
      await security.changePin(pinCurrent, pinNew)
      resetPinModal()
    } catch (e) {
      setPinShake((k) => k + 1)
      setPinToast(e instanceof Error ? e.message : "Gagal mengubah PIN.")
    } finally {
      setPinBusy(false)
    }
  }
  const handleRemovePin = async () => {
    setPinBusy(true)
    setPinError("")
    try {
      await security.removePin(pinRemovePass)
      resetPinModal()
    } catch (e) {
      setPinError(e instanceof Error ? e.message : "Gagal menghapus PIN.")
    } finally {
      setPinBusy(false)
    }
  }
  function downloadCode() {
    const url = URL.createObjectURL(
      new Blob([`RANGKAI RECOVERY CODE\n\n${recoveryCode}\n\nSimpan file ini di tempat aman.`], {
        type: "text/plain",
      }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "rangkai-recovery-code.txt"
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="font-display font-medium">Keamanan workspace</h2>
        <p className="mt-1 text-xs text-[#858b82]">
          Atur passphrase, enkripsi, dan penguncian otomatis.
        </p>
      </div>
      <Card className="p-6">
        {security.enabled ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-[#607a53]" />
                <div>
                  <p className="text-sm font-medium">Passphrase aktif</p>
                  <p className="mt-1 text-xs text-[#758071]">
                    {security.encrypted
                      ? "Enkripsi AES-GCM aktif."
                      : "Kunci aplikasi aktif tanpa enkripsi."}{" "}
                    Otomatis terkunci setelah 20 menit.
                  </p>
                </div>
              </div>
              <Button $variant="secondary" onClick={security.lock}>
                <LockKeyhole size={15} /> Kunci sekarang
              </Button>
            </div>
            <div className="border-t border-[#e5e9e1] pt-5">
              <h3 className="text-sm font-medium">Ganti passphrase</h3>
              <p className="mt-1 text-xs text-[#758071]">
                Passphrase baru juga akan digunakan untuk membuka database lokal.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Input
                  type="password"
                  value={currentPassphrase}
                  onChange={(e) => setCurrentPassphrase(e.target.value)}
                  placeholder="Passphrase saat ini"
                />
                <Input
                  type="password"
                  value={nextPassphrase}
                  onChange={(e) => setNextPassphrase(e.target.value)}
                  placeholder="Passphrase baru"
                />
                <Input
                  type="password"
                  value={nextConfirm}
                  onChange={(e) => setNextConfirm(e.target.value)}
                  placeholder="Konfirmasi baru"
                />
              </div>
              {error && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
                  {error}
                </p>
              )}
              <Button
                className="mt-4"
                disabled={busy || !currentPassphrase || !nextPassphrase || !nextConfirm}
                onClick={() => void changePassphrase()}
              >
                <KeyRound size={16} /> {busy ? "Mengubah…" : "Ganti passphrase"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Passphrase"
                error={passphrase ? validatePassphrase(passphrase) : undefined}
              >
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Minimal 12 karakter"
                />
              </Field>
              <Field label="Konfirmasi passphrase">
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#788075]">
              <span>• Huruf besar & kecil</span>
              <span>• Minimal 12 karakter</span>
              <span>• Minimal satu angka</span>
              <span>• Minimal satu simbol</span>
            </div>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-[#e1e5dd] bg-[#fafbf8] p-4">
              <input
                type="checkbox"
                checked={encrypt}
                onChange={(e) => setEncrypt(e.target.checked)}
                className="mt-1 accent-[#647f55]"
              />
              <span>
                <strong className="block text-sm">Enkripsi kredensial lokal</strong>
                <small className="mt-1 block text-[#7b8278]">
                  Gunakan passphrase sebagai kunci AES-GCM.
                </small>
              </span>
            </label>
            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>
            )}
            <Button disabled={busy || !passphrase || !confirm} onClick={() => void enable()}>
              <ShieldCheck size={16} /> {busy ? "Menyiapkan…" : "Aktifkan passphrase"}
            </Button>
          </div>
        )}
      </Card>
      {security.enabled && (
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <KeyRound className="text-[#607a53]" />
              <div>
                <h3 className="font-display text-sm font-medium">PIN 6 digit</h3>
                <p className="mt-1 text-xs leading-5 text-[#7d837a]">
                  {security.pinEnabled
                    ? "PIN aktif — jadi default saat membuka workspace. Tetap bisa masuk dengan passphrase."
                    : "Atur PIN cepat 6 angka sebagai alternatif passphrase."}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${security.pinEnabled ? "bg-[#e6f2df] text-[#4c6843]" : "bg-[#f1f1ed] text-[#8a9188]"}`}
            >
              {security.pinEnabled ? "Aktif" : "Belum diatur"}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {!security.pinEnabled ? (
              <Button onClick={() => setPinModal("setup")}>
                <KeyRound size={15} /> Atur PIN
              </Button>
            ) : (
              <>
                <Button $variant="secondary" onClick={() => setPinModal("change")}>
                  Ganti PIN
                </Button>
                <Button $variant="danger" onClick={() => setPinModal("remove")}>
                  Hapus PIN
                </Button>
              </>
            )}
          </div>
        </Card>
      )}
      {recoveryCode && (
        <Card className="border-[#dccf9f] bg-[#fffdf4] p-6">
          <div className="flex gap-3">
            <KeyRound className="text-[#8a7138]" />
            <div>
              <h3 className="font-display font-medium">Simpan recovery code sekarang</h3>
              <p className="mt-1 text-xs text-[#7c745f]">Kode hanya ditampilkan sekali.</p>
            </div>
          </div>
          <code className="mt-5 block break-all rounded-xl border bg-white p-4 text-sm font-medium leading-7">
            {recoveryCode}
          </code>
          <Button className="mt-4" $variant="secondary" onClick={downloadCode}>
            <Download size={15} /> Download recovery code
          </Button>
        </Card>
      )}
      {pinModal && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-[#1a2216]/40 p-4 backdrop-blur-sm"
          onClick={resetPinModal}
        >
          <AnimatePresence>
            {pinToast && (
              <motion.div
                initial={{ opacity: 0, y: -8, x: "-50%" }}
                animate={{ opacity: 1, y: 0, x: "-50%" }}
                exit={{ opacity: 0, y: -8, x: "-50%" }}
                className="fixed top-6 left-1/2 z-[130] rounded-full bg-[#2e332b] px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
              >
                {pinToast}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-[24px] border border-[#e5e7e0] bg-white p-6 shadow-[0_20px_60px_rgba(38,50,31,0.18)]"
          >
            <h3 className="font-display text-[17px] font-semibold text-[#1d2a18]">
              {pinModal === "setup"
                ? "Atur PIN 6 digit"
                : pinModal === "change"
                  ? "Ganti PIN"
                  : "Hapus PIN"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#7d837a]">
              {pinModal === "setup"
                ? "Masukkan passphrase untuk verifikasi, lalu buat PIN 6 angka."
                : pinModal === "change"
                  ? "Masukkan PIN lama dan PIN baru 6 angka."
                  : "Masukkan passphrase untuk menghapus PIN."}
            </p>
            <div className="mt-5 space-y-4">
              {pinModal === "setup" && (
                <>
                  <Field label="Passphrase">
                    <Input
                      type="password"
                      value={pinPass}
                      onChange={(e) => setPinPass(e.target.value)}
                      placeholder="Passphrase"
                    />
                  </Field>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-[#383d36]">PIN baru</p>
                    <PinInput value={pin} onChange={setPin} shakeKey={pinShake} />
                  </div>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-[#383d36]">Konfirmasi PIN</p>
                    <PinInput value={pinConfirm} onChange={setPinConfirm} shakeKey={pinShake} />
                  </div>
                </>
              )}
              {pinModal === "change" && (
                <>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-[#383d36]">PIN saat ini</p>
                    <PinInput value={pinCurrent} onChange={setPinCurrent} shakeKey={pinShake} />
                  </div>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-[#383d36]">PIN baru</p>
                    <PinInput value={pinNew} onChange={setPinNew} shakeKey={pinShake} />
                  </div>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-[#383d36]">
                      Konfirmasi PIN baru
                    </p>
                    <PinInput
                      value={pinNewConfirm}
                      onChange={setPinNewConfirm}
                      shakeKey={pinShake}
                    />
                  </div>
                </>
              )}
              {pinModal === "remove" && (
                <Field label="Passphrase">
                  <Input
                    type="password"
                    value={pinRemovePass}
                    onChange={(e) => setPinRemovePass(e.target.value)}
                    placeholder="Passphrase"
                  />
                </Field>
              )}
              {pinError && (
                <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
                  {pinError}
                </p>
              )}
              <div className="flex gap-2">
                <Button $variant="secondary" onClick={resetPinModal} className="flex-1">
                  Batal
                </Button>
                {pinModal === "setup" && (
                  <Button
                    onClick={() => void handleSetupPin()}
                    disabled={pinBusy || !pinPass || pin.length !== 6 || pinConfirm.length !== 6}
                    className="flex-1"
                  >
                    {pinBusy ? "Menyimpan…" : "Simpan PIN"}
                  </Button>
                )}
                {pinModal === "change" && (
                  <Button
                    onClick={() => void handleChangePin()}
                    disabled={
                      pinBusy ||
                      pinCurrent.length !== 6 ||
                      pinNew.length !== 6 ||
                      pinNewConfirm.length !== 6
                    }
                    className="flex-1"
                  >
                    {pinBusy ? "Menyimpan…" : "Ganti PIN"}
                  </Button>
                )}
                {pinModal === "remove" && (
                  <Button
                    $variant="danger"
                    onClick={() => void handleRemovePin()}
                    disabled={pinBusy || !pinRemovePass}
                    className="flex-1"
                  >
                    {pinBusy ? "Menghapus…" : "Hapus PIN"}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

function ProfilePanel() {
  const security = useSecurity()
  const [name, setName] = useState(security.profile.name)
  const [email, setEmail] = useState(security.profile.email)
  const [photo, setPhoto] = useState(security.profile.photo)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setName(security.profile.name)
    setEmail(security.profile.email)
    setPhoto(security.profile.photo)
  }, [security.profile])
  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 600_000) return setError("Foto maksimal 600KB.")
    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result || ""))
    reader.readAsDataURL(file)
  }
  const save = async () => {
    setError("")
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return setError("Format email tidak valid.")
    setSaving(true)
    try {
      await security.updateProfile({ name: name.trim(), email: email.trim(), photo })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan profil.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="font-display font-medium">Profil</h2>
        <p className="mt-1 text-xs text-[#858b82]">
          Foto dan identitas untuk avatar di modal kunci.
        </p>
      </div>
      <Card className="p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-3">
            <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border border-[#e5e7e0] bg-[#eef5e9] text-[#5a7a4a]">
              {photo ? (
                <img src={photo} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <User size={32} />
              )}
            </div>
            <Button $variant="secondary" onClick={() => fileRef.current?.click()}>
              <FileUp size={14} /> Ganti foto
            </Button>
            <input ref={fileRef} hidden type="file" accept="image/*" onChange={onPhoto} />
            {photo && (
              <button
                onClick={() => setPhoto("")}
                className="text-[11px] text-[#8a9188] hover:text-[#5a6b56]"
              >
                Hapus foto
              </button>
            )}
          </div>
          <div className="flex-1 space-y-4">
            <Field label="Nama">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap"
              />
            </Field>
            <Field label="Email">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@contoh.com"
              />
            </Field>
            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>
            )}
            <Button onClick={() => void save()} disabled={saving}>
              {saved ? <Check size={16} /> : <Save size={16} />}{" "}
              {saving ? "Menyimpan…" : saved ? "Tersimpan" : "Simpan profil"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

function DataPanel() {
  const inputRef = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [confirmAction, setConfirmAction] = useState<"reports" | "all" | "restore" | null>(null),
    [pendingFile, setPendingFile] = useState<File | null>(null)
  async function exportBackup() {
    const passphrase = window.prompt("Masukkan passphrase untuk mengenkripsi backup.")
    if (!passphrase) return
    setBusy("export")
    try {
      const response = await fetch("/api/settings/backup/encrypted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      })
      if (!response.ok)
        throw new Error(
          ((await response.json()) as { message?: string }).message || "Backup gagal dibuat.",
        )
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement("a")
      link.href = url
      link.download = `rangkai-backup-${new Date().toISOString().slice(0, 10)}.encrypted.json`
      link.click()
      URL.revokeObjectURL(url)
      setMessage("Backup terenkripsi berhasil dibuat.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Backup gagal dibuat.")
    } finally {
      setBusy("")
    }
  }
  async function restore() {
    if (!pendingFile) return
    const passphrase = window.prompt("Masukkan passphrase backup.")
    if (!passphrase) return
    setBusy("restore")
    setMessage("")
    try {
      const form = new FormData()
      form.append("backup", pendingFile)
      form.append("passphrase", passphrase)
      const response = await fetch("/api/settings/restore", {
        method: "POST",
        body: form,
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message)
      setMessage("Backup berhasil dipulihkan. Memuat ulang aplikasi…")
      window.setTimeout(() => location.reload(), 900)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Restore gagal.")
    } finally {
      setBusy("")
      setConfirmAction(null)
    }
  }
  async function remove(scope: "reports" | "all") {
    setBusy(scope)
    setMessage("")
    try {
      await api(`/settings/data/${scope}`, { method: "DELETE" })
      setMessage(
        scope === "all" ? "Workspace berhasil direset." : "Semua laporan berhasil dihapus.",
      )
      setConfirmAction(null)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Penghapusan gagal.")
    } finally {
      setBusy("")
    }
  }
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="font-display font-medium">Data & Backup</h2>
        <p className="mt-1 text-xs text-[#858b82]">
          Pindahkan, pulihkan, atau bersihkan data workspace.
        </p>
      </div>
      <Card className="p-6">
        <div className="flex gap-3">
          <DatabaseBackup className="text-[#607a53]" />
          <div>
            <h3 className="font-display font-medium">Backup workspace</h3>
            <p className="mt-1 text-xs leading-5 text-[#7d837a]">
              Export mencakup project, laporan, template, sumber sinkronisasi, dan file lampiran.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button disabled={busy === "export"} onClick={() => void exportBackup()}>
            <Download size={15} /> {busy === "export" ? "Mengenkripsi…" : "Export backup"}
          </Button>
          <Button $variant="secondary" onClick={() => inputRef.current?.click()}>
            <FileUp size={15} /> Import backup
          </Button>
          <input
            ref={inputRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                setPendingFile(file)
                setConfirmAction("restore")
              }
            }}
          />
        </div>
      </Card>
      <Card className="border-[#eadbd7] p-6">
        <div className="flex gap-3">
          <Trash2 className="text-[#a65341]" />
          <div>
            <h3 className="font-display font-medium">Zona berbahaya</h3>
            <p className="mt-1 text-xs leading-5 text-[#7d837a]">
              Tindakan berikut tidak dapat dibatalkan tanpa file backup.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button $variant="danger" onClick={() => setConfirmAction("reports")}>
            Hapus seluruh laporan
          </Button>
          <Button $variant="danger" onClick={() => setConfirmAction("all")}>
            Reset seluruh data
          </Button>
        </div>
      </Card>
      {message && (
        <p
          className={`rounded-xl p-3 text-xs font-medium ${/gagal|tidak/i.test(message) ? "bg-red-50 text-red-700" : "bg-[#eef5e9] text-[#557049]"}`}
        >
          {message}
        </p>
      )}
      {confirmAction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#20251f]/35 p-5 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6">
            <h3 className="font-display text-lg font-medium">
              {confirmAction === "restore"
                ? "Pulihkan backup?"
                : confirmAction === "all"
                  ? "Reset seluruh data?"
                  : "Hapus seluruh laporan?"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#747b71]">
              {confirmAction === "restore"
                ? `Data saat ini akan diganti dengan ${pendingFile?.name}.`
                : confirmAction === "all"
                  ? "Semua project, laporan, template, sumber, dan lampiran akan dihapus."
                  : "Laporan harian, laporan bulanan, sumber sinkronisasi, dan lampiran akan dihapus."}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                $variant="secondary"
                onClick={() => {
                  setConfirmAction(null)
                  setPendingFile(null)
                }}
              >
                Batal
              </Button>
              <Button
                $variant="danger"
                disabled={Boolean(busy)}
                onClick={() =>
                  confirmAction === "restore" ? void restore() : void remove(confirmAction)
                }
              >
                {busy ? "Memproses…" : "Ya, lanjutkan"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
