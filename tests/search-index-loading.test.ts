import { describe, expect, test } from "bun:test";

const searchScriptPath = "src/templates/html/partials/search-script.js";

describe("theme search index loading", () => {
  test("uses only the content-addressed HTTP cache", async () => {
    const script = await Bun.file(searchScriptPath).text();

    expect(script).not.toContain("sessionStorage");
    expect(script).toContain('window.fetch(themesIndexUrl, { cache: "force-cache" })');
  });
});
