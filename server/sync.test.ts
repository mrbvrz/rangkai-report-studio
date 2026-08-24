import path from "node:path"
import { describe, expect, it } from "vitest"
import { parseMarkdown } from "./sync.js"

describe("Markdown sync parser", () => {
  it("reads frontmatter and strips it from report content", () => {
    const result = parseMarkdown(path.resolve("fixtures/sync-demo/2026-08-07-daily-report.md"))
    expect(result.title).toBe("Sinkronisasi progres modul")
    expect(result.reportDate).toBe("2026-08-07")
    expect(result.tags).toEqual(["sync", "development"])
    expect(result.content).toContain("## Aktivitas")
    expect(result.content).not.toContain("title:")
  })
})
