import { useEffect, useState } from "react"
import { Sparkles, X } from "./heroicons"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPWA() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // iOS
      (window.navigator as unknown as { standalone?: boolean }).standalone === true)

  useEffect(() => {
    if (isStandalone) return
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setPromptEvent(null)
    window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall as EventListener)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [isStandalone])

  if (isStandalone || !promptEvent || dismissed) return null

  const handleInstall = async () => {
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === "accepted") setPromptEvent(null)
    else setDismissed(true)
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[#dfe5da] bg-white px-1 py-1 shadow-sm">
      <button
        onClick={handleInstall}
        className="flex items-center gap-1.5 rounded-full bg-[#6c8f58] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#5a7a4a]"
      >
        <Sparkles size={14} />
        Install Aplikasi
      </button>
      <button
        aria-label="Tutup"
        onClick={() => setDismissed(true)}
        className="grid h-7 w-7 place-items-center rounded-full text-[#8a9087] hover:bg-[#f0f1ec] hover:text-[#30352f]"
      >
        <X size={14} />
      </button>
    </div>
  )
}
