import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookOpenText,
  CalendarRange,
  FolderKanban,
  FileStack,
  LockKeyhole,
  Menu,
  Settings2,
  Sparkles,
  X,
} from "../components/heroicons";
import { useEffect, useState } from "react";
import { useSecurity } from "../security";
import { Button } from "./ui/index";

const links = [
  { to: "/", label: "Ringkasan", icon: BarChart3 },
  { to: "/projects", label: "Project", icon: FolderKanban },
  { to: "/reports", label: "Laporan Harian", icon: BookOpenText },
  { to: "/monthly", label: "Laporan Bulanan", icon: CalendarRange },
  { to: "/templates", label: "Template", icon: FileStack },
  { to: "/settings", label: "Pengaturan", icon: Settings2 },
];

export function Layout() {
  const security = useSecurity();
  const [open, setOpen] = useState(false);
  const [databaseSize, setDatabaseSize] = useState(0);
  const path = useRouterState({ select: (state) => state.location.pathname });
  const currentLabel =
    links.find((item) => item.to !== "/" && path.startsWith(item.to))?.label ||
    (path === "/" ? "Ringkasan" : "Workspace");
  useEffect(() => {
    void fetch("/api/health")
      .then((response) => response.json())
      .then((data: { size?: number }) => setDatabaseSize(data.size || 0))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "l" &&
        security.enabled &&
        !security.locked
      ) {
        event.preventDefault();
        security.lock();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [security]);
  const readableSize =
    databaseSize < 1024
      ? `${databaseSize} B`
      : databaseSize < 1024 * 1024
        ? `${(databaseSize / 1024).toFixed(1)} KB`
        : `${(databaseSize / (1024 * 1024)).toFixed(1)} MB`;
  const nav = (
    <>
      <div className="flex h-20 items-center gap-3 px-6">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#c8ed9e] text-[#26321f]">
          <Sparkles size={18} />
        </div>
        <div>
          <div className="font-display text-lg font-medium tracking-[-.03em]">
            Rangkai
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[.16em] text-[#92978f]">
            Report Studio
          </div>
        </div>
      </div>
      <nav className="space-y-1 px-3">
        {links.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-[#e8f3de] text-[#314228]" : "text-[#747970] hover:bg-[#f0f1ec] hover:text-[#30352f]"}`}
            >
              {active && (
                <motion.span
                  layoutId="nav"
                  className="absolute left-0 h-5 w-[3px] rounded-r bg-[#6c8f58]"
                />
              )}
              <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4">
        <div className="rounded-2xl bg-[#252a24] p-4 text-white">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Sparkles size={15} className="text-[#c9eea1]" /> AI-ready
          </div>
          <p className="text-xs leading-5 text-[#adb4aa]">
            Hubungkan provider AI untuk menyusun ringkasan otomatis.
          </p>
          <Link
            to="/settings"
            className="mt-3 inline-block text-xs font-medium text-[#c9eea1]"
          >
            Atur sekarang →
          </Link>
        </div>
      </div>
    </>
  );
  return (
    <div className="min-h-screen bg-[#fbfbf8] lg:grid lg:grid-cols-[240px_1fr]">
      <motion.aside
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[#fbfbf8] lg:flex"
      >
        {nav}
      </motion.aside>
      {open && (
        <>
          <button
            aria-label="Tutup menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/25 lg:hidden"
          />
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[#fbfbf8] lg:hidden"
          >
            <button
              className="absolute right-3 top-3 p-2"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
            {nav}
          </motion.aside>
        </>
      )}
      <main className="min-w-0 overflow-hidden rounded-[28px] border border-[#e3e5de] bg-[#f7f7f3] m-3 lg:my-4 lg:ml-0 lg:mr-4 lg:col-start-2">
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="static z-20 flex h-16 items-center justify-between rounded-t-[27px] border-b border-[#e3e5de] bg-[#f7f7f3]/90 px-5 backdrop-blur-xl lg:px-8"
        >
          <button onClick={() => setOpen(true)} className="p-2 lg:hidden">
            <Menu size={21} />
          </button>
          <div className="hidden items-center gap-2 text-xs font-medium text-[#8a9087] lg:flex">
            <span>Workspace</span>
            <span className="text-[#b1b7ad]">/</span>
            <span className="text-[#566052]">{currentLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="group relative flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#83af6c]" />
              <span className="hidden text-xs font-medium text-[#6d736a] sm:inline">
                SQLite tersambung
              </span>
              <div className="pointer-events-none absolute right-0 top-8 z-50 w-64 rounded-xl border border-[#dfe5da] bg-white p-3 text-[11px] leading-5 text-[#66705f] opacity-0 shadow-xl transition group-hover:opacity-100">
                Database: SQLite
                <br />
                File: rangkai.db
                <br />
                Ukuran: {readableSize}
                <br />
                Mode: lokal · Status: tersambung
              </div>
            </div>
            {security.enabled && !security.locked && (
              <Button
                $variant="warning"
                onClick={security.lock}
                title="Kunci workspace"
              >
                <LockKeyhole size={14} />
                <span className="hidden sm:inline">Kunci</span>
              </Button>
            )}
          </div>
        </motion.header>
        <div className="mx-auto mt-0 max-w-[1200px] rounded-b-[27px] bg-[#f7f7f3] p-4 lg:py-6 lg:pl-4 lg:pr-6">
          <motion.div
            key={path}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
