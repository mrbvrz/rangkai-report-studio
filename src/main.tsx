import React from "react"
import ReactDOM from "react-dom/client"
import Lenis from "lenis"
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  RouterProvider,
} from "@tanstack/react-router"
import { Layout } from "./components/Layout"
import { InstallPWA } from "./components/InstallPWA"
import "./styles.css"
import { SecurityProvider } from "./security"
import { registerSW } from "virtual:pwa-register"

registerSW({ immediate: true })

function SmoothScroll({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      syncTouch: false,
    })
    let frame = 0
    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)
    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
    }
  }, [])
  return <>{children}</>
}

const rootRoute = createRootRoute({ component: Layout })
const reportEditor = lazyRouteComponent(() => import("./pages/ReportEditor"), "ReportEditor")
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(() => import("./pages/Dashboard"), "Dashboard"),
})
const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports",
  component: lazyRouteComponent(() => import("./pages/Reports"), "Reports"),
})
const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects",
  component: lazyRouteComponent(() => import("./pages/Projects"), "Projects"),
})
const newReportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports/new",
  component: reportEditor,
})
const editReportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports/$reportId",
  component: reportEditor,
})
const monthlyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/monthly",
  component: lazyRouteComponent(() => import("./pages/Monthly"), "Monthly"),
})
const templatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/templates",
  component: lazyRouteComponent(() => import("./pages/Templates"), "Templates"),
})
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: lazyRouteComponent(() => import("./pages/Settings"), "Settings"),
})
const routeTree = rootRoute.addChildren([
  indexRoute,
  projectsRoute,
  reportsRoute,
  newReportRoute,
  editReportRoute,
  monthlyRoute,
  templatesRoute,
  settingsRoute,
])
const router = createRouter({ routeTree })
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SmoothScroll>
      <SecurityProvider>
        <RouterProvider router={router} />
      </SecurityProvider>
      <InstallPWA />
    </SmoothScroll>
  </React.StrictMode>,
)
