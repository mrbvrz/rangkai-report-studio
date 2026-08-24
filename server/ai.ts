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

export async function generateAiWriting(
  ai: AiSettings,
  content: string,
  action: AiWritingAction,
  context?: string,
) {
  if (!ai.apiKey || !ai.baseUrl || !ai.model) throw new Error("Konfigurasi AI belum lengkap.")
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
