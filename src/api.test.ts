import { afterEach, describe, expect, it, vi } from "vitest"
import { api } from "./api"

afterEach(() => vi.unstubAllGlobals())

describe("api client", () => {
  it("returns parsed JSON for a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    )
    await expect(api<{ ok: boolean }>("/health")).resolves.toEqual({
      ok: true,
    })
  })

  it("surfaces the API error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Data tidak valid." }), {
          status: 400,
        }),
      ),
    )
    await expect(api("/reports")).rejects.toThrow("Data tidak valid.")
  })

  it("retries once when the dev server returns an HTML fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response('<script type="module"></script>', { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ reports: 3 }), { status: 200 })),
    )
    await expect(api<{ reports: number }>("/dashboard-summary")).resolves.toEqual({ reports: 3 })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
