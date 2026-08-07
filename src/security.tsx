import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeSlash, KeyRound, LockKeyhole, ShieldCheck } from './components/heroicons'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Input } from './components/ui'

const IDLE_MS = 20 * 60 * 1000
const SESSION_KEY = 'rangkai.session.key'
const ACTIVITY_KEY = 'rangkai.session.activity'

type WrappedKey = { salt: string; iv: string; value: string }
type SecurityRecord = { version: 1; encrypted: boolean; passphrase: WrappedKey; recovery: WrappedKey }
type SecurityContextValue = {
  enabled: boolean
  encrypted: boolean
  locked: boolean
  createProtection: (passphrase: string, encrypted: boolean) => Promise<string>
  unlock: (passphrase: string) => Promise<void>
  recover: (code: string, newPassphrase: string) => Promise<void>
  lock: () => void
  readAiConfig: <T>() => Promise<Partial<T>>
  saveAiConfig: (value: unknown) => Promise<void>
}

const SecurityContext = createContext<SecurityContextValue | null>(null)
const bytes = (length: number) => crypto.getRandomValues(new Uint8Array(length))
const encode = (value: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(value)))
const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
const normalizeRecovery = (value: string) => value.replace(/[^a-z0-9]/gi, '').toUpperCase()

async function deriveKey(secret: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 310_000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

async function wrapRoot(root: Uint8Array, secret: string): Promise<WrappedKey> {
  const salt = bytes(16), iv = bytes(12), key = await deriveKey(secret, salt)
  const value = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, root as BufferSource)
  return { salt: encode(salt), iv: encode(iv), value: encode(value) }
}

async function unwrapRoot(wrapped: WrappedKey, secret: string) {
  try {
    const key = await deriveKey(secret, decode(wrapped.salt))
    const value = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(wrapped.iv) }, key, decode(wrapped.value))
    return new Uint8Array(value)
  } catch { throw new Error('Passphrase atau recovery code tidak valid.') }
}

async function encryptJson(value: unknown, root: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', root as BufferSource, 'AES-GCM', false, ['encrypt'])
  const iv = bytes(12)
  const payload = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)))
  return JSON.stringify({ encrypted: true, iv: encode(iv), value: encode(payload) })
}

async function decryptJson<T>(raw: string, root: Uint8Array): Promise<T> {
  const payload = JSON.parse(raw) as { encrypted?: boolean; iv: string; value: string }
  if (!payload.encrypted) return payload as T
  const key = await crypto.subtle.importKey('raw', root as BufferSource, 'AES-GCM', false, ['decrypt'])
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(payload.iv) }, key, decode(payload.value))
  return JSON.parse(new TextDecoder().decode(clear)) as T
}

async function fetchSecureSettings() {
  const response = await fetch('/api/settings/secure')
  if (!response.ok) throw new Error('Pengaturan tidak dapat dimuat.')
  return response.json() as Promise<{ security: string | null; ai: string | null }>
}
async function saveSecureSetting(key: 'security' | 'ai', value: string) {
  const response = await fetch('/api/settings/secure', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) })
  if (!response.ok) throw new Error('Pengaturan tidak dapat disimpan.')
}

function getSessionRoot() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY), lastActivity = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0)
    if (!raw || !lastActivity || Date.now() - lastActivity >= IDLE_MS) { sessionStorage.removeItem(SESSION_KEY); return null }
    return decode(raw)
  } catch { return null }
}

export function validatePassphrase(value: string) {
  if (value.length < 12) return 'Minimal 12 karakter.'
  if (!/[A-Z]/.test(value)) return 'Tambahkan minimal satu huruf besar.'
  if (!/[a-z]/.test(value)) return 'Tambahkan minimal satu huruf kecil.'
  if (!/[0-9]/.test(value)) return 'Tambahkan minimal satu angka.'
  if (!/[^A-Za-z0-9]/.test(value)) return 'Tambahkan minimal satu simbol.'
  return ''
}

export function SecurityProvider({ children }: { children: ReactNode }) {
  const initialRoot = getSessionRoot()
  const [record, setRecord] = useState<SecurityRecord | null>(null)
  const [rootKey, setRootKey] = useState<Uint8Array | null>(initialRoot)
  const [databaseLocked, setDatabaseLocked] = useState(() => !initialRoot)
  const [idleLocked, setIdleLocked] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const locked = databaseLocked || Boolean(record && (!rootKey || idleLocked))

  useEffect(() => {
    let active = true
    void fetch('/api/database/status').then((response) => response.json()).then((data: { status?: string }) => setDatabaseLocked(data.status !== 'unlocked')).catch(() => setDatabaseLocked(true))
    void fetchSecureSettings().then(async (settings) => {
      if (!active) return
      if (settings.security) {
        const remote = JSON.parse(settings.security) as SecurityRecord
        setRecord(remote)
      }
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  function rememberSession(root: Uint8Array) { sessionStorage.setItem(SESSION_KEY, encode(root)); sessionStorage.setItem(ACTIVITY_KEY, String(Date.now())) }
  function lock() { if (record || !databaseLocked) { void fetch('/api/database/lock', { method: 'POST' }); sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(ACTIVITY_KEY); setIdleLocked(true); setRootKey(null); setDatabaseLocked(true) } }
  function armTimer() {
    window.clearTimeout(timer.current)
    if (record && rootKey && !idleLocked) { sessionStorage.setItem(ACTIVITY_KEY, String(Date.now())); timer.current = window.setTimeout(lock, IDLE_MS) }
  }

  useEffect(() => {
    const activity = () => armTimer()
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }))
    armTimer()
    return () => { window.clearTimeout(timer.current); events.forEach((event) => window.removeEventListener(event, activity)) }
  }, [record, rootKey, idleLocked])

  async function createProtection(passphrase: string, encrypted: boolean) {
    const issue = validatePassphrase(passphrase); if (issue) throw new Error(issue)
    const root = bytes(32)
    const recoveryRaw = Array.from(bytes(20), (part) => part.toString(16).padStart(2, '0')).join('').toUpperCase()
    const recoveryCode = recoveryRaw.match(/.{1,5}/g)!.join('-')
    const next: SecurityRecord = { version: 1, encrypted, passphrase: await wrapRoot(root, passphrase), recovery: await wrapRoot(root, recoveryRaw) }
    await saveSecureSetting('security', JSON.stringify(next))
    setRecord(next); setRootKey(root); setIdleLocked(false); rememberSession(root)
    return recoveryCode
  }

  async function unlock(passphrase: string) {
    const response = await fetch('/api/database/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase }) })
    if (!response.ok) throw new Error('Passphrase database tidak valid.')
    setDatabaseLocked(false)
    const settings = await fetchSecureSettings()
    if (!settings.security) { await createProtection(passphrase, true); return }
    const nextRecord = JSON.parse(settings.security) as SecurityRecord
    const root = await unwrapRoot(nextRecord.passphrase, passphrase)
    setRecord(nextRecord)
    setRootKey(root); setIdleLocked(false); rememberSession(root)
  }

  async function recover(code: string, newPassphrase: string) {
    if (!record) return
    const issue = validatePassphrase(newPassphrase); if (issue) throw new Error(issue)
    const root = await unwrapRoot(record.recovery, normalizeRecovery(code))
    const next = { ...record, passphrase: await wrapRoot(root, newPassphrase) }
    await saveSecureSetting('security', JSON.stringify(next))
    setRecord(next); setRootKey(root); setIdleLocked(false); rememberSession(root)
  }

  async function readAiConfig<T>() {
    const settings = await fetchSecureSettings()
    const raw = settings.ai; if (!raw) return {}
    if (record?.encrypted) {
      if (!rootKey) throw new Error('Aplikasi terkunci.')
      return decryptJson<Partial<T>>(raw, rootKey)
    }
    try { return JSON.parse(raw) as Partial<T> } catch { return {} }
  }

  async function saveAiConfig(value: unknown) {
    if (record?.encrypted) {
      if (!rootKey) throw new Error('Aplikasi terkunci.')
      await saveSecureSetting('ai', await encryptJson(value, rootKey))
    } else await saveSecureSetting('ai', JSON.stringify(value))
  }

  const value: SecurityContextValue = { enabled: Boolean(record), encrypted: Boolean(record?.encrypted), locked, createProtection, unlock, recover, lock, readAiConfig, saveAiConfig }
  return <SecurityContext.Provider value={value}>{!locked && children}<AnimatePresence>{locked && <UnlockOverlay idle={idleLocked} onUnlock={unlock} onRecover={recover} />}</AnimatePresence></SecurityContext.Provider>
}

function PasswordInput({ value, onChange, placeholder, autoFocus, onKeyDown }: { value: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string; autoFocus?: boolean; onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void }) {
  const [visible, setVisible] = useState(false)
  return <div className="relative"><Input type={visible ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus} onKeyDown={onKeyDown} className="pr-11" /><button type="button" aria-label={visible ? 'Sembunyikan passphrase' : 'Tampilkan passphrase'} onClick={() => setVisible(!visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8a9386] transition hover:bg-[#eef2eb] hover:text-[#536d48]">{visible ? <EyeSlash size={16} /> : <Eye size={16} />}</button></div>
}

function UnlockOverlay({ idle: _idle, onUnlock, onRecover }: { idle: boolean; onUnlock: (value: string) => Promise<void>; onRecover: (code: string, next: string) => Promise<void> }) {
  const [passphrase, setPassphrase] = useState(''), [recovery, setRecovery] = useState(false), [code, setCode] = useState(''), [next, setNext] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])
  async function submit() { setBusy(true); setError(''); try { if (recovery) await onRecover(code, next); else await onUnlock(passphrase) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Tidak dapat membuka aplikasi.') } finally { setBusy(false) } }
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] grid place-items-center bg-[#1e241e]/45 p-5 backdrop-blur-xl"><motion.div initial={{ y: 14, scale: .98 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-md rounded-[24px] border border-white/50 bg-[#fbfcf9]/95 p-7 shadow-2xl"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e7f0e1] text-[#536d48]"><LockKeyhole size={25} /></div><h2 className="font-display mt-5 text-center text-xl font-medium">{recovery ? 'Pulihkan akses' : 'Workspace terkunci'}</h2><p className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-[#777f74]">{recovery ? 'Masukkan recovery code dan buat passphrase baru.' : 'Masukkan passphrase untuk membuka workspace dan melanjutkan aktivitas.'}</p><div className="mt-6 space-y-3">{recovery ? <><Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="XXXXX-XXXXX-XXXXX-..." autoFocus /><PasswordInput value={next} onChange={(event) => setNext(event.target.value)} placeholder="Passphrase baru" onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} /></> : <PasswordInput value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="Passphrase" autoFocus onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} />}{error && <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}<Button className="w-full" disabled={busy || (recovery ? !code || !next : !passphrase)} onClick={() => void submit()}><span className="inline-flex items-center justify-center gap-2">{busy ? 'Memverifikasi…' : recovery ? <><KeyRound size={15} /> Reset passphrase</> : <><LockKeyhole size={15} /> Buka aplikasi</>}</span></Button><button className="w-full text-center text-[8px] font-medium text-[#7d8b77] transition hover:text-[#526b47]" onClick={() => { setRecovery(!recovery); setError('') }}>{recovery ? 'Kembali ke passphrase' : 'Lupa passphrase? Gunakan recovery code'}</button></div></motion.div></motion.div>
}

export function useSecurity() {
  const context = useContext(SecurityContext)
  if (!context) throw new Error('useSecurity harus digunakan di dalam SecurityProvider.')
  return context
}
