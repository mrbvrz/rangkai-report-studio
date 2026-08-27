import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, X } from "./heroicons"

const STORAGE_KEY = "rangkai:pwa:dont-show"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPWA() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [visible, setVisible] = useState(false)
  const [dontShowChecked, setDontShowChecked] = useState(false)

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true)

  const isPermanentlyDismissed = (() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1"
    } catch {
      return false
    }
  })()

  const persistIfChecked = () => {
    if (dontShowChecked) {
      try {
        localStorage.setItem(STORAGE_KEY, "1")
      } catch {
        // ignore storage errors (private mode)
      }
    }
  }

  const handleDismiss = () => {
    persistIfChecked()
    setDismissed(true)
  }

  useEffect(() => {
    if (isStandalone || isPermanentlyDismissed) return
    // pick up stashed event if Dashboard mounted after prompt fired
    const stashed = (window as unknown as Record<string, unknown>).__rangkaiDeferredPrompt as
      BeforeInstallPromptEvent | undefined
    if (stashed) setPromptEvent(stashed)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      const ev = e as BeforeInstallPromptEvent
      ;(window as unknown as Record<string, unknown>).__rangkaiDeferredPrompt = ev
      setPromptEvent(ev)
    }
    const onInstalled = () => {
      ;(window as unknown as Record<string, unknown>).__rangkaiDeferredPrompt = undefined
      setPromptEvent(null)
      setVisible(false)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall as EventListener)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [isStandalone, isPermanentlyDismissed])

  useEffect(() => {
    if (!promptEvent || dismissed || isStandalone || isPermanentlyDismissed) return
    const t = setTimeout(() => setVisible(true), 5000)
    return () => clearTimeout(t)
  }, [promptEvent, dismissed, isStandalone, isPermanentlyDismissed])

  if (isStandalone || isPermanentlyDismissed || !promptEvent || dismissed || !visible) return null

  const handleInstall = async () => {
    persistIfChecked()
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === "accepted") {
      setPromptEvent(null)
      setVisible(false)
    } else {
      setDismissed(true)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] grid place-items-center bg-[#1a2216]/40 backdrop-blur-sm p-4"
        onClick={handleDismiss}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: "spring", damping: 24, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[380px] rounded-[28px] border border-[#e3e5de] bg-white p-6 shadow-[0_20px_60px_rgba(38,50,31,0.18)]"
        >
          <button
            aria-label="Tutup"
            onClick={handleDismiss}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-[#8a9087] hover:bg-[#f0f1ec] hover:text-[#30352f]"
          >
            <X size={16} />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#a7d480] to-[#4f7a3c] shadow-[0_8px_24px_rgba(108,143,88,0.35)]">
              <Sparkles size={28} className="text-white" />
            </div>
            <h2 className="font-display mt-4 text-[20px] font-semibold tracking-[-.02em] text-[#1d2a18]">
              Install Rangkai
            </h2>
            <p className="mt-1.5 text-[13px] leading-5 text-[#6d736a]">
              Akses lebih cepat, buka dari home screen, dan tetap bisa dipakai saat offline.
            </p>
          </div>

          <div className="mt-5 space-y-2 rounded-2xl bg-[#f7f7f3] px-4 py-3 text-left">
            <div className="flex items-center gap-2.5 text-[13px] text-[#3a4435]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6c8f58]" />
              Buka instan tanpa buka browser
            </div>
            <div className="flex items-center gap-2.5 text-[13px] text-[#3a4435]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6c8f58]" />
              Tampilan penuh seperti aplikasi native
            </div>
            <div className="flex items-center gap-2.5 text-[13px] text-[#3a4435]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6c8f58]" />
              Tetap ringan — tidak makan memori besar
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={handleInstall}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#6c8f58] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(108,143,88,0.35)] transition hover:bg-[#5a7a4a] active:scale-[0.99]"
            >
              <Sparkles size={16} />
              Install Aplikasi
            </button>
            <button
              onClick={handleDismiss}
              className="w-full rounded-full px-5 py-2 text-[13px] font-medium leading-none text-[#6d736a] hover:bg-[#f0f1ec] hover:text-[#30352f]"
            >
              Nanti saja
            </button>
          </div>

          <label className="mt-3 flex cursor-pointer items-center justify-center gap-1.5 text-[11px] leading-none text-[#6d736a]">
            <input
              type="checkbox"
              checked={dontShowChecked}
              onChange={(e) => setDontShowChecked(e.target.checked)}
              className="h-3 w-3 rounded-[3px] border-[#d3d8d0] bg-white text-[#6c8f58] focus:ring-1 focus:ring-[#6c8f58]"
            />
            Jangan tampilkan lagi
          </label>

          <p className="mt-2 text-center text-[10px] leading-none text-[#a1a7a0]">
            Bisa dihapus kapan saja dari home screen
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
