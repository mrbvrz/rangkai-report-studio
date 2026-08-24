import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWritingInput,
  generateAiWriting,
  writingPrompts,
  type AiSettings,
} from "./ai.js";

const baseConfig: AiSettings = {
  provider: "openai",
  apiKey: "test-key",
  baseUrl: "https://ai.example.com/v1/",
  model: "test-model",
};

function stubFetchResponse(payload: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("writingPrompts", () => {
  it("defines a unique non-empty prompt for every action", () => {
    const actions = Object.keys(writingPrompts);
    expect(actions).toEqual([
      "improve",
      "expand",
      "summarize",
      "structure",
      "translate",
      "continue",
    ]);
    expect(new Set(Object.values(writingPrompts)).size).toBe(actions.length);
    for (const prompt of Object.values(writingPrompts))
      expect(prompt.length).toBeGreaterThan(0);
  });
});

describe("buildWritingInput", () => {
  it("appends the content after the action prompt", () => {
    expect(buildWritingInput("improve", "Isi laporan")).toBe(
      `${writingPrompts.improve}\n\nKonten:\nIsi laporan`,
    );
  });

  it("inserts optional context between the prompt and the content", () => {
    const input = buildWritingInput("expand", "Poin A", "untuk manajemen");
    expect(input).toBe(
      `${writingPrompts.expand}\n\nKonteks tambahan: untuk manajemen\n\nKonten:\nPoin A`,
    );
  });
});

describe("generateAiWriting", () => {
  it("rejects incomplete AI configuration before any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateAiWriting({}, "konten", "improve")).rejects.toThrow(
      "Konfigurasi AI belum lengkap.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses Gemini candidate parts into one string", async () => {
    const fetchMock = stubFetchResponse({
      candidates: [
        {
          content: {
            parts: [{ text: "Bagian satu " }, { text: "bagian dua." }],
          },
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      generateAiWriting({ ...baseConfig, provider: "gemini" }, "konten", "improve"),
    ).resolves.toBe("Bagian satu bagian dua.");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      "https://ai.example.com/v1/models/test-model:generateContent?key=test-key",
    );
  });

  it("keeps only text blocks from Anthropic responses", async () => {
    const fetchMock = stubFetchResponse({
      content: [
        { type: "text", text: "Hasil Claude." },
        { type: "tool_use", text: "dilewati" },
        { type: "text", text: " Baris kedua." },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      generateAiWriting(
        { ...baseConfig, provider: "anthropic" },
        "konten",
        "summarize",
      ),
    ).resolves.toBe("Hasil Claude. Baris kedua.");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      system: string;
      max_tokens: number;
      messages: { role: string }[];
    };
    expect(body.system).toBe(writingPrompts.summarize);
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.messages[0].role).toBe("user");
  });

  it("reads the first choice message from OpenRouter", async () => {
    const fetchMock = stubFetchResponse({
      choices: [{ message: { content: "Hasil OpenRouter." } }],
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      generateAiWriting(
        { ...baseConfig, provider: "openrouter" },
        "konten",
        "translate",
      ),
    ).resolves.toBe("Hasil OpenRouter.");
  });

  it("prefers output_text and falls back to structured output for OpenAI", async () => {
    vi.stubGlobal("fetch", stubFetchResponse({ output_text: "Ringkas." }));
    await expect(
      generateAiWriting(baseConfig, "konten", "structure"),
    ).resolves.toBe("Ringkas.");

    vi.stubGlobal(
      "fetch",
      stubFetchResponse({
        output: [
          { content: [{ type: "output_text", text: "Dari " }] },
          { content: [{ type: "output_text", text: "struktur." }] },
        ],
      }),
    );
    await expect(
      generateAiWriting(baseConfig, "konten", "structure"),
    ).resolves.toBe("Dari struktur.");
  });

  it("returns an empty string when the provider response has no usable text", async () => {
    vi.stubGlobal("fetch", stubFetchResponse({}));
    await expect(
      generateAiWriting(baseConfig, "konten", "continue"),
    ).resolves.toBe("");
  });

  it("surfaces a provider-specific error on HTTP failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: "boom" }), { status: 503 }),
        ),
    );
    await expect(
      generateAiWriting({ ...baseConfig, provider: "gemini" }, "konten", "improve"),
    ).rejects.toThrow("Gemini merespons 503.");
  });

  it("sends the context and raw content in the upstream request body", async () => {
    const fetchMock = stubFetchResponse({ output_text: "ok" });
    vi.stubGlobal("fetch", fetchMock);
    await generateAiWriting(baseConfig, "Isi asli", "improve", "audiens direksi");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { input: string };
    expect(body.input).toContain("Konteks tambahan: audiens direksi");
    expect(body.input).toContain("Isi asli");
  });
});
