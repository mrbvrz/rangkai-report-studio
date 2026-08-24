export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`/api${url}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    })
    const text = await response.text()
    let body: Record<string, unknown> | T
    try {
      body = JSON.parse(text) as Record<string, unknown> | T
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 150))
        continue
      }
      throw new Error("Server lokal belum siap. Muat ulang halaman dan coba lagi.")
    }
    if (!response.ok)
      throw new Error(String((body as Record<string, unknown>).message || "Terjadi kesalahan."))
    return body as T
  }
  throw new Error("Server lokal belum siap.")
}

export const displayDate = (date: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`))
export const currentMonth = () => new Date().toISOString().slice(0, 7)
