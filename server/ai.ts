export type AiSettings = {
  provider?: "openai" | "gemini" | "anthropic" | "openrouter"
  apiKey?: string
  baseUrl?: string
  model?: string
}

export type AiWritingAction =
  "improve" | "expand" | "summarize" | "structure" | "translate" | "continue"

export const writingPrompts: Record<AiWritingAction, string> = {
  improve:
    "Perbaiki tulisan berikut agar lebih profesional, jelas, dan terstruktur. Pertahankan makna aslinya. Tulis dalam Bahasa Indonesia.",
  expand:
    "Kembangkan catatan/poin-poin berikut menjadi laporan harian yang lengkap, detail, dan terstruktur dengan bahasa profesional Indonesia. Tambahkan konteks, detail aktivitas, dan format yang sesuai untuk laporan kerja.",
  summarize:
    "Buat ringkasan eksekutif singkat (2-3 paragraf) dari laporan berikut. Fokus pada pencapaian utama, temuan kunci, dan tindak lanjut. Bahasa Indonesia profesional.",
  structure:
    "Strukturkan konten berikut menjadi format laporan harian standar dengan heading yang jelas (Aktivitas, Hasil, Kendala, Tindak Lanjut). Gunakan Markdown. Bahasa Indonesia.",
  translate:
    "Terjemahkan konten berikut ke Bahasa Indonesia yang natural dan profesional untuk konteks laporan kerja.",
  continue:
    "Lanjutkan penulisan laporan berikut secara natural berdasarkan konteks dan alur yang sudah ada. Pertahankan gaya bahasa dan format yang sama.",
}

export function buildWritingInput(action: AiWritingAction, content: string, context?: string) {
  const system = writingPrompts[action]
  return context
    ? `${system}\n\nKonteks tambahan: ${context}\n\nKonten:\n${content}`
    : `${system}\n\nKonten:\n${content}`
}

async function postJson(
  url: string,
  label: string,
  headers: Record<string, string>,
  body: unknown,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${label} merespons ${response.status}.`)
  return (await response.json()) as unknown
}

// Mitigasi SSRF: baseUrl berasal dari input klien, jadi server tidak boleh
// mem-fetch target internal. Wajib https dan host publik; gateway/proxy
// kustom ber-https tetap diizinkan.
export function assertSafeBaseUrl(baseUrl: string) {
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new Error("Base URL AI tidak valid.")
  }
  if (parsed.protocol !== "https:") throw new Error("Base URL AI wajib menggunakan https.")
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (host === "localhost" || host.endsWith(".internal") || host.endsWith(".local"))
    throw new Error("Base URL AI tidak boleh menunjuk ke host internal.")
  if (isPrivateV4(host)) rejectPrivate()
  if (host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd"))
    rejectPrivate()
  if (/^fe[89ab]/.test(host)) rejectPrivate()
  // IPv4-mapped IPv6 (::ffff:10.0.0.5). URL menormalkan ke hex terkompresi
  // (mis. "::ffff:a00:5"), jadi dekode dua grup terakhir kembali ke IPv4.
  const mappedIndex = host.lastIndexOf("ffff:")
  if (mappedIndex !== -1) {
    const tail = host.slice(mappedIndex + 5)
    if (/^\d+(\.\d+){3}$/.test(tail)) {
      if (isPrivateV4(tail)) rejectPrivate()
    } else {
      const parts = tail.split(":").filter(Boolean)
      if (parts.length >= 2) {
        const hi = parseInt(parts[parts.length - 2], 16)
        const lo = parseInt(parts[parts.length - 1], 16)
        if (isPrivateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)) rejectPrivate()
      }
    }
  }
}
function rejectPrivate(): never {
  throw new Error("Base URL AI tidak boleh menunjuk ke alamat privat.")
}
function isPrivateV4(ip: string) {
  return /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
}

export async function generateAiWriting(
  ai: AiSettings,
  content: string,
  action: AiWritingAction,
  context?: string,
) {
  if (!ai.apiKey || !ai.baseUrl || !ai.model) throw new Error("Konfigurasi AI belum lengkap.")
  assertSafeBaseUrl(ai.baseUrl)
  const input = buildWritingInput(action, content, context)
  const baseUrl = ai.baseUrl.replace(/\/$/, "")
  let data: unknown
  if (ai.provider === "gemini") {
    const url = `${baseUrl}/models/${encodeURIComponent(ai.model)}:generateContent?key=${encodeURIComponent(ai.apiKey)}`
    data = await postJson(url, "Gemini", {}, { contents: [{ parts: [{ text: input }] }] })
    const candidates = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
      .candidates
    return candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || ""
  }
  if (ai.provider === "anthropic") {
    data = await postJson(
      `${baseUrl}/messages`,
      "Claude",
      { "x-api-key": ai.apiKey!, "anthropic-version": "2023-06-01" },
      {
        model: ai.model,
        max_tokens: 2000,
        system: writingPrompts[action],
        messages: [{ role: "user", content: input }],
      },
    )
    const blocks = (data as { content?: { type: string; text?: string }[] }).content
    return (
      blocks
        ?.filter((item) => item.type === "text")
        .map((item) => item.text || "")
        .join("") || ""
    )
  }
  if (ai.provider === "openrouter") {
    data = await postJson(
      `${baseUrl}/chat/completions`,
      "OpenRouter",
      { Authorization: `Bearer ${ai.apiKey}` },
      {
        model: ai.model,
        messages: [
          { role: "system", content: writingPrompts[action] },
          { role: "user", content: input },
        ],
      },
    )
    const choices = (data as { choices?: { message?: { content?: string } }[] }).choices
    return choices?.[0]?.message?.content || ""
  }
  data = await postJson(
    `${baseUrl}/responses`,
    "OpenAI",
    { Authorization: `Bearer ${ai.apiKey}` },
    { model: ai.model, instructions: writingPrompts[action], input },
  )
  const payload = data as {
    output_text?: string
    output?: { content?: { type: string; text?: string }[] }[]
  }
  return (
    payload.output_text ||
    payload.output
      ?.flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text || "")
      .join("") ||
    ""
  )
}
