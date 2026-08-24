import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true, type: "module" },
      includeAssets: ["icon-192.svg", "icon-512.svg"],
      manifest: {
        name: "Rangkai Report Studio",
        short_name: "Rangkai",
        description: "Workspace laporan harian dan bulanan yang tersimpan lokal.",
        theme_color: "#fbfbf8",
        background_color: "#f7f7f3",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\./i,
            handler: "CacheFirst",
            options: {
              cacheName: "font-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/uploads": "http://localhost:3001",
    },
  },
})
