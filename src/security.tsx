import { AnimatePresence, motion } from "framer-motion"
import { Eye, EyeSlash, KeyRound, LockKeyhole } from "./components/heroicons"
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { Button, Input } from "./components/ui"

const IDLE_MS = 20 * 60 * 1000
const SESSION_KEY = "rangkai.session.key"
const ACTIVITY_KEY = "rangkai.session.activity"

type WrappedKey = { salt: string; iv: string; value: string }
type SecurityRecord = {
  version: 1
  encrypted: boolean
  passphrase: WrappedKey
  recovery: WrappedKey
  pin?: WrappedKey
}
export type Profile = { name: string; email: string; photo: string }
type SecurityContextValue = {
  enabled: boolean
  encrypted: boolean
  locked: boolean
  pinEnabled: boolean
  profile: Profile
  createProtection: (passphrase: string, encrypted: boolean) => Promise<string>
  unlock: (passphrase: string) => Promise<string | null>
  unlockWithPin: (pin: string) => Promise<void>
  recover: (code: string, newPassphrase: string) => Promise<void>
  changePassphrase: (currentPassphrase: string, nextPassphrase: string) => Promise<void>
  setPin: (passphrase: string, pin: string) => Promise<void>
  changePin: (currentPin: string, newPin: string) => Promise<void>
  removePin: (passphrase: string) => Promise<void>
  updateProfile: (profile: Profile) => Promise<void>
  refreshProfile: () => Promise<void>
  lock: () => void
  readAiConfig: <T>() => Promise<Partial<T>>
  saveAiConfig: (value: unknown) => Promise<void>
}

const SecurityContext = createContext<SecurityContextValue | null>(null)
const bytes = (length: number) => crypto.getRandomValues(new Uint8Array(length))
const encode = (value: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(value)))
const decode = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
const normalizeRecovery = (value: string) => value.replace(/[^a-z0-9]/gi, "").toUpperCase()

async function deriveKey(secret: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 310_000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

async function wrapRoot(root: Uint8Array, secret: string): Promise<WrappedKey> {
  const salt = bytes(16),
    iv = bytes(12),
    key = await deriveKey(secret, salt)
  const value = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    root as BufferSource,
  )
  return { salt: encode(salt), iv: encode(iv), value: encode(value) }
}

async function unwrapRoot(wrapped: WrappedKey, secret: string) {
  try {
    const key = await deriveKey(secret, decode(wrapped.salt))
    const value = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(wrapped.iv) },
      key,
      decode(wrapped.value),
    )
    return new Uint8Array(value)
  } catch {
    throw new Error("Passphrase atau recovery code tidak valid.")
  }
}

async function encryptJson(value: unknown, root: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", root as BufferSource, "AES-GCM", false, [
    "encrypt",
  ])
  const iv = bytes(12)
  const payload = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  )
  return JSON.stringify({
    encrypted: true,
    iv: encode(iv),
    value: encode(payload),
  })
}

async function decryptJson<T>(raw: string, root: Uint8Array): Promise<T> {
  const payload = JSON.parse(raw) as {
    encrypted?: boolean
    iv: string
    value: string
  }
  if (!payload.encrypted) return payload as T
  const key = await crypto.subtle.importKey("raw", root as BufferSource, "AES-GCM", false, [
    "decrypt",
  ])
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(payload.iv) },
    key,
    decode(payload.value),
  )
  return JSON.parse(new TextDecoder().decode(clear)) as T
}

async function fetchSecureSettings() {
  const response = await fetch("/api/settings/secure")
  if (!response.ok) throw new Error("Pengaturan tidak dapat dimuat.")
  return response.json() as Promise<{
    security: string | null
    ai: string | null
  }>
}
async function saveSecureSetting(key: "security" | "ai", value: string) {
  const response = await fetch("/api/settings/secure", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  })
  if (!response.ok) throw new Error("Pengaturan tidak dapat disimpan.")
}

function getSessionRoot() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY),
      lastActivity = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0)
    if (!raw || !lastActivity || Date.now() - lastActivity >= IDLE_MS) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return decode(raw)
  } catch {
    return null
  }
}

export function validatePassphrase(value: string) {
  if (value.length < 12) return "Minimal 12 karakter."
  if (!/[A-Z]/.test(value)) return "Tambahkan minimal satu huruf besar."
  if (!/[a-z]/.test(value)) return "Tambahkan minimal satu huruf kecil."
  if (!/[0-9]/.test(value)) return "Tambahkan minimal satu angka."
  if (!/[^A-Za-z0-9]/.test(value)) return "Tambahkan minimal satu simbol."
  return ""
}
export function validatePin(value: string) {
  if (!/^\d{6}$/.test(value)) return "PIN harus 6 digit angka."
  return ""
}

export function SecurityProvider({ children }: { children: ReactNode }) {
  const initialRoot = getSessionRoot()
  const [record, setRecord] = useState<SecurityRecord | null>(null)
  const [rootKey, setRootKey] = useState<Uint8Array | null>(initialRoot)
  const [databaseLocked, setDatabaseLocked] = useState(() => !initialRoot)
  const [isNewDatabase, setIsNewDatabase] = useState<boolean | null>(null)
  const [idleLocked, setIdleLocked] = useState(false)
  const [setupRecoveryCode, setSetupRecoveryCode] = useState("")
  const [pinEnabled, setPinEnabled] = useState(false)
  const [profile, setProfile] = useState<Profile>({ name: "", email: "", photo: "" })
  const timer = useRef<number | undefined>(undefined)
  const locked = databaseLocked || Boolean(record && (!rootKey || idleLocked))

  const refreshProfile = async () => {
    try {
      const res = await fetch("/api/profile")
      if (res.ok) setProfile((await res.json()) as Profile)
    } catch {
      // ignore
    }
  }
  const refreshPinStatus = async () => {
    try {
      const res = await fetch("/api/pin/status")
      if (res.ok) {
        const data = (await res.json()) as { enabled: boolean }
        setPinEnabled(data.enabled)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let active = true
    void fetch("/api/database/status")
      .then((response) => response.json())
      .then((data: { status?: string; isNew?: boolean }) => {
        setDatabaseLocked(data.status !== "unlocked")
        setIsNewDatabase(Boolean(data.isNew))
      })
      .catch(() => {
        setDatabaseLocked(true)
        setIsNewDatabase(false)
      })
    void fetchSecureSettings()
      .then(async (settings) => {
        if (!active) return
        if (settings.security) {
          const remote = JSON.parse(settings.security) as SecurityRecord
          setRecord(remote)
          setPinEnabled(!!remote.pin)
        }
      })
      .catch(() => undefined)
    void refreshProfile()
    void refreshPinStatus()
    return () => {
      active = false
    }
  }, [])

  function rememberSession(root: Uint8Array) {
    sessionStorage.setItem(SESSION_KEY, encode(root))
    sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()))
  }
  function lock() {
    if (record || !databaseLocked) {
      void fetch("/api/database/lock", { method: "POST" })
      sessionStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(ACTIVITY_KEY)
      setIdleLocked(true)
      setRootKey(null)
      setDatabaseLocked(true)
    }
  }
  function armTimer() {
    window.clearTimeout(timer.current)
    if (record && rootKey && !idleLocked) {
      sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()))
      timer.current = window.setTimeout(lock, IDLE_MS)
    }
  }

  useEffect(() => {
    const activity = () => armTimer()
    const events = ["pointerdown", "keydown", "scroll", "touchstart"]
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }))
    armTimer()
    return () => {
      window.clearTimeout(timer.current)
      events.forEach((event) => window.removeEventListener(event, activity))
    }
  }, [record, rootKey, idleLocked])

  async function createProtection(passphrase: string, encrypted: boolean) {
    const issue = validatePassphrase(passphrase)
    if (issue) throw new Error(issue)
    const root = bytes(32)
    const recoveryRaw = Array.from(bytes(20), (part) => part.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
    const recoveryCode = recoveryRaw.match(/.{1,5}/g)!.join("-")
    const next: SecurityRecord = {
      version: 1,
      encrypted,
      passphrase: await wrapRoot(root, passphrase),
      recovery: await wrapRoot(root, recoveryRaw),
    }
    await saveSecureSetting("security", JSON.stringify(next))
    setRecord(next)
    setRootKey(root)
    setIdleLocked(false)
    rememberSession(root)
    return recoveryCode
  }

  async function unlock(passphrase: string) {
    const response = await fetch("/api/database/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase }),
    })
    if (!response.ok) throw new Error("Passphrase database tidak valid.")
    setDatabaseLocked(false)
    const settings = await fetchSecureSettings()
    if (!settings.security) {
      const recoveryCode = await createProtection(passphrase, true)
      setSetupRecoveryCode(recoveryCode)
      return recoveryCode
    }
    const nextRecord = JSON.parse(settings.security) as SecurityRecord
    const root = await unwrapRoot(nextRecord.passphrase, passphrase)
    setRecord(nextRecord)
    setPinEnabled(!!nextRecord.pin)
    setRootKey(root)
    setIdleLocked(false)
    rememberSession(root)
    await refreshProfile()
    return null
  }

  async function unlockWithPin(pin: string) {
    const issue = validatePin(pin)
    if (issue) throw new Error(issue)
    const response = await fetch("/api/pin/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    })
    if (!response.ok)
      throw new Error((await response.json().catch(() => null))?.message || "PIN tidak valid.")
    setDatabaseLocked(false)
    const settings = await fetchSecureSettings()
    if (!settings.security) throw new Error("Data keamanan tidak ditemukan.")
    const nextRecord = JSON.parse(settings.security) as SecurityRecord
    if (!nextRecord.pin) throw new Error("PIN belum diatur.")
    const root = await unwrapRoot(nextRecord.pin, pin)
    setRecord(nextRecord)
    setPinEnabled(true)
    setRootKey(root)
    setIdleLocked(false)
    rememberSession(root)
    await refreshProfile()
  }

  async function recover(code: string, newPassphrase: string) {
    if (!record) return
    const issue = validatePassphrase(newPassphrase)
    if (issue) throw new Error(issue)
    const root = await unwrapRoot(record.recovery, normalizeRecovery(code))
    const next = { ...record, passphrase: await wrapRoot(root, newPassphrase) }
    // keep pin if exists but re-wrap? For now remove pin on recover
    delete next.pin
    try {
      if (pinEnabled)
        await fetch("/api/pin", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passphrase: newPassphrase }),
        }).catch(() => undefined)
    } catch {
      // ignore
    }
    await saveSecureSetting("security", JSON.stringify(next))
    setRecord(next)
    setPinEnabled(false)
    setRootKey(root)
    setIdleLocked(false)
    rememberSession(root)
  }

  async function changePassphrase(currentPassphrase: string, nextPassphrase: string) {
    if (!record || !rootKey) throw new Error("Aplikasi terkunci.")
    const issue = validatePassphrase(nextPassphrase)
    if (issue) throw new Error(issue)
    const next = {
      ...record,
      passphrase: await wrapRoot(rootKey, nextPassphrase),
    }
    delete next.pin
    const response = await fetch("/api/database/passphrase", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassphrase,
        nextPassphrase,
        security: JSON.stringify(next),
      }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string
      } | null
      throw new Error(body?.message || "Passphrase tidak dapat diubah.")
    }
    setRecord(next)
    setPinEnabled(false)
  }

  async function setPin(passphrase: string, pin: string) {
    if (!record || !rootKey) throw new Error("Aplikasi terkunci.")
    const pinIssue = validatePin(pin)
    if (pinIssue) throw new Error(pinIssue)
    // verify passphrase
    await unwrapRoot(record.passphrase, passphrase)
    const pinWrapped = await wrapRoot(rootKey, pin)
    const next = { ...record, pin: pinWrapped }
    // server: store encrypted DB passphrase
    const resp = await fetch("/api/pin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase, pin }),
    })
    if (!resp.ok)
      throw new Error((await resp.json().catch(() => null))?.message || "Gagal mengatur PIN.")
    await saveSecureSetting("security", JSON.stringify(next))
    setRecord(next)
    setPinEnabled(true)
  }

  async function changePin(currentPin: string, newPin: string) {
    if (!record || !rootKey) throw new Error("Aplikasi terkunci.")
    const issue = validatePin(newPin)
    if (issue) throw new Error(issue)
    // verify current pin
    if (!record.pin) throw new Error("PIN belum diatur.")
    await unwrapRoot(record.pin, currentPin)
    const resp = await fetch("/api/pin/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPin, newPin }),
    })
    if (!resp.ok)
      throw new Error((await resp.json().catch(() => null))?.message || "Gagal mengubah PIN.")
    const newWrapped = await wrapRoot(rootKey, newPin)
    const next = { ...record, pin: newWrapped }
    await saveSecureSetting("security", JSON.stringify(next))
    setRecord(next)
  }

  async function removePin(passphrase: string) {
    if (!record || !rootKey) throw new Error("Aplikasi terkunci.")
    await unwrapRoot(record.passphrase, passphrase)
    const resp = await fetch("/api/pin", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase }),
    })
    if (!resp.ok)
      throw new Error((await resp.json().catch(() => null))?.message || "Gagal menghapus PIN.")
    const next = { ...record }
    delete next.pin
    await saveSecureSetting("security", JSON.stringify(next))
    setRecord(next)
    setPinEnabled(false)
  }

  async function updateProfile(next: Profile) {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
    if (!res.ok)
      throw new Error((await res.json().catch(() => null))?.message || "Gagal menyimpan profil.")
    setProfile(next)
  }

  async function readAiConfig<T>() {
    const settings = await fetchSecureSettings()
    const raw = settings.ai
    if (!raw) return {}
    if (record?.encrypted) {
      if (!rootKey) throw new Error("Aplikasi terkunci.")
      return decryptJson<Partial<T>>(raw, rootKey)
    }
    try {
      return JSON.parse(raw) as Partial<T>
    } catch {
      return {}
    }
  }

  async function saveAiConfig(value: unknown) {
    if (record?.encrypted) {
      if (!rootKey) throw new Error("Aplikasi terkunci.")
      await saveSecureSetting("ai", await encryptJson(value, rootKey))
    } else await saveSecureSetting("ai", JSON.stringify(value))
  }

  const value: SecurityContextValue = {
    enabled: Boolean(record),
    encrypted: Boolean(record?.encrypted),
    locked,
    pinEnabled,
    profile,
    createProtection,
    unlock,
    unlockWithPin,
    recover,
    changePassphrase,
    setPin,
    changePin,
    removePin,
    updateProfile,
    refreshProfile,
    lock,
    readAiConfig,
    saveAiConfig,
  }
  return (
    <SecurityContext.Provider value={value}>
      {!locked && !setupRecoveryCode && children}
      <AnimatePresence>
        {(locked || setupRecoveryCode) && (
          <UnlockOverlay
            idle={idleLocked}
            setup={isNewDatabase === true}
            ready={isNewDatabase !== null}
            recoveryCode={setupRecoveryCode}
            onUnlock={unlock}
            onUnlockWithPin={unlockWithPin}
            pinEnabled={pinEnabled}
            profile={profile}
            onRecover={recover}
            onCompleteSetup={() => setSetupRecoveryCode("")}
          />
        )}
      </AnimatePresence>
    </SecurityContext.Provider>
  )
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  onKeyDown,
}: {
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  autoFocus?: boolean
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        className="pr-11"
      />
      <button
        type="button"
        aria-label={visible ? "Sembunyikan passphrase" : "Tampilkan passphrase"}
        onClick={() => setVisible(!visible)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8a9386] transition hover:bg-[#eef2eb] hover:text-[#536d48]"
      >
        {visible ? <EyeSlash size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

export function PinInput({
  value,
  onChange,
  autoFocus,
  onKeyDown,
}: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  const hiddenRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) hiddenRef.current?.focus()
  }, [autoFocus])
  const pushDigit = (d: string) => {
    if (value.length < 6) onChange((value + d).slice(0, 6))
  }
  const popDigit = () => onChange(value.slice(0, -1))
  const handleHiddenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
  }
  return (
    <div className="mx-auto w-full max-w-[280px] space-y-3">
      <div className="grid grid-cols-6 gap-2" onClick={() => hiddenRef.current?.focus()}>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className={`grid aspect-square place-items-center rounded-[10px] border text-center text-[18px] font-medium leading-none transition ${i < value.length ? "border-[#6c8f58] bg-[#eef5e9] text-[#2e4228]" : "border-[#dfe2da] bg-white text-[#8a9188]"}`}
          >
            {i < value.length ? "•" : ""}
          </div>
        ))}
      </div>
      <input
        ref={hiddenRef}
        type="password"
        inputMode="numeric"
        pattern="\d*"
        maxLength={6}
        value={value}
        onChange={handleHiddenChange}
        onKeyDown={onKeyDown}
        className="sr-only"
        aria-label="PIN 6 digit"
        autoComplete="off"
      />
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => pushDigit(d)}
            className="grid aspect-square place-items-center rounded-[12px] border border-[#e5e7e0] bg-white text-[18px] font-medium leading-none text-[#2e332b] shadow-sm transition hover:bg-[#f0f3ec] active:scale-[0.98]"
          >
            {d}
          </button>
        ))}
        <span className="aspect-square" aria-hidden />
        <button
          type="button"
          onClick={() => pushDigit("0")}
          className="grid aspect-square place-items-center rounded-[12px] border border-[#e5e7e0] bg-white text-[18px] font-medium leading-none text-[#2e332b] shadow-sm transition hover:bg-[#f0f3ec] active:scale-[0.98]"
        >
          0
        </button>
        <button
          type="button"
          onClick={popDigit}
          aria-label="Hapus"
          className="grid aspect-square place-items-center rounded-[12px] border border-[#e5e7e0] bg-[#fafbf8] text-[18px] leading-none text-[#6d736a] transition hover:bg-[#eef1eb] active:scale-[0.98]"
        >
          ⌫
        </button>
      </div>
    </div>
  )
}

function UnlockOverlay({
  idle: _idle,
  setup,
  ready,
  recoveryCode,
  onUnlock,
  onUnlockWithPin,
  pinEnabled,
  profile,
  onRecover,
  onCompleteSetup,
}: {
  idle: boolean
  setup: boolean
  ready: boolean
  recoveryCode: string
  onUnlock: (value: string) => Promise<string | null>
  onUnlockWithPin: (pin: string) => Promise<void>
  pinEnabled: boolean
  profile: Profile
  onRecover: (code: string, next: string) => Promise<void>
  onCompleteSetup: () => void
}) {
  const [passphrase, setPassphrase] = useState(""),
    [confirm, setConfirm] = useState(""),
    [recovery, setRecovery] = useState(false),
    [code, setCode] = useState(""),
    [next, setNext] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pin, setPin] = useState(""),
    [mode, setMode] = useState<"pin" | "passphrase">("pin")
  const hasPin = pinEnabled && !setup && !recoveryCode
  const showPin = hasPin && mode === "pin" && !recovery
  useEffect(() => {
    if (hasPin) setMode("pin")
    else setMode("passphrase")
  }, [hasPin])
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])
  async function submit() {
    if (setup) {
      const issue = validatePassphrase(passphrase)
      if (issue) return setError(issue)
      if (passphrase !== confirm) return setError("Konfirmasi passphrase tidak sama.")
    }
    if (showPin) {
      const issue = validatePin(pin)
      if (issue) return setError(issue)
    }
    setBusy(true)
    setError("")
    try {
      if (recovery) await onRecover(code, next)
      else if (showPin) await onUnlockWithPin(pin)
      else await onUnlock(passphrase)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tidak dapat membuka aplikasi.")
    } finally {
      setBusy(false)
    }
  }
  const avatar = profile.photo ? (
    <img
      src={profile.photo}
      alt={profile.name || "Avatar"}
      className="h-full w-full object-cover"
    />
  ) : null
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] grid place-items-center bg-[#1e241e]/45 p-5 backdrop-blur-xl"
    >
      <motion.div
        initial={{ y: 14, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        className="w-full max-w-md rounded-[24px] border border-white/50 bg-[#fbfcf9]/95 p-7 shadow-2xl"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-[#e7f0e1] text-[#536d48]">
          {avatar || <LockKeyhole size={25} />}
        </div>
        {profile.name && !recoveryCode && (
          <p className="mt-3 text-center text-sm font-medium text-[#3a4435]">{profile.name}</p>
        )}
        {profile.email && !recoveryCode && (
          <p className="text-center text-xs text-[#7d837a]">{profile.email}</p>
        )}
        <h2 className="font-display mt-5 text-center text-xl font-medium">
          {recovery
            ? "Pulihkan akses"
            : recoveryCode
              ? "Simpan recovery code"
              : setup
                ? "Buat passphrase workspace"
                : showPin
                  ? "Masukkan PIN"
                  : "Workspace terkunci"}
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-[#777f74]">
          {recoveryCode
            ? "Kode ini hanya ditampilkan sekali. Simpan di tempat yang aman sebelum melanjutkan."
            : recovery
              ? "Masukkan recovery code dan buat passphrase baru."
              : setup
                ? "Amankan data lokal Anda dengan passphrase yang kuat."
                : showPin
                  ? "Masukkan PIN 4-6 digit untuk membuka workspace."
                  : "Masukkan passphrase untuk membuka workspace dan melanjutkan aktivitas."}
        </p>
        <div className="mt-6 space-y-3">
          {recoveryCode ? (
            <>
              <code className="block break-all rounded-xl border border-[#dccf9f] bg-[#fffdf4] p-4 text-center text-sm font-medium leading-7 text-[#69592f]">
                {recoveryCode}
              </code>
              <Button className="w-full" onClick={onCompleteSetup}>
                Lanjut ke aplikasi
              </Button>
            </>
          ) : recovery ? (
            <>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="XXXXX-XXXXX-XXXXX-..."
                autoFocus
              />
              <PasswordInput
                value={next}
                onChange={(event) => setNext(event.target.value)}
                placeholder="Passphrase baru"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit()
                }}
              />
            </>
          ) : (
            <>
              {showPin ? (
                <PinInput
                  value={pin}
                  onChange={setPin}
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submit()
                  }}
                />
              ) : (
                <PasswordInput
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  placeholder={setup ? "Passphrase baru" : "Passphrase"}
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !setup) void submit()
                  }}
                />
              )}
              {setup && (
                <PasswordInput
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Konfirmasi passphrase"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submit()
                  }}
                />
              )}
              {setup && (
                <p className="text-xs leading-5 text-[#7d837a]">
                  Minimal 12 karakter, dengan huruf besar, huruf kecil, angka, dan simbol.
                </p>
              )}
            </>
          )}
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>
          )}
          {!recoveryCode && (
            <Button
              className="w-full"
              disabled={
                !ready ||
                busy ||
                (recovery
                  ? !code || !next
                  : showPin
                    ? pin.length < 6
                    : !passphrase || (setup && !confirm))
              }
              onClick={() => void submit()}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {busy ? (
                  setup ? (
                    "Menyiapkan…"
                  ) : (
                    "Memverifikasi…"
                  )
                ) : recovery ? (
                  <>
                    <KeyRound size={15} /> Reset passphrase
                  </>
                ) : showPin ? (
                  <>
                    <LockKeyhole size={15} /> Buka dengan PIN
                  </>
                ) : (
                  <>
                    <LockKeyhole size={15} /> {setup ? "Simpan passphrase" : "Buka aplikasi"}
                  </>
                )}
              </span>
            </Button>
          )}
          {!setup && !recoveryCode && hasPin && (
            <button
              className="w-full py-0.5 text-center text-[10px] font-medium leading-none tracking-[.02em] text-[#7d8b77] transition hover:text-[#526b47]"
              onClick={() => {
                setMode(mode === "pin" ? "passphrase" : "pin")
                setError("")
              }}
            >
              {mode === "pin" ? "Masuk dengan passphrase" : "Masuk dengan PIN"}
            </button>
          )}
          {!setup && !recoveryCode && !hasPin && (
            <button
              className="w-full py-0.5 text-center text-[10px] font-medium leading-none tracking-[.02em] text-[#7d8b77] transition hover:text-[#526b47]"
              onClick={() => {
                setRecovery(!recovery)
                setError("")
              }}
            >
              {recovery ? "Kembali ke passphrase" : "Lupa passphrase? Gunakan recovery code"}
            </button>
          )}
          {hasPin && recovery && (
            <button
              className="w-full py-0.5 text-center text-[10px] font-medium leading-none tracking-[.02em] text-[#7d8b77] transition hover:text-[#526b47]"
              onClick={() => {
                setRecovery(false)
                setError("")
              }}
            >
              Kembali
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export function useSecurity() {
  const context = useContext(SecurityContext)
  if (!context) throw new Error("useSecurity harus digunakan di dalam SecurityProvider.")
  return context
}
