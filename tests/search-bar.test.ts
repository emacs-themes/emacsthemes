import { describe, expect, test } from "bun:test";

describe("search bar partial", () => {
  const partialPath = "src/templates/html/partials/search-bar.html";

  test("keeps one query input, one sort select, and a submit button", async () => {
    const partial = await Bun.file(partialPath).text();

    expect(partial.match(/id="q"/g)).toHaveLength(1);
    expect(partial.match(/id="sort"/g)).toHaveLength(1);
    expect(partial.match(/type="submit"/g)).toHaveLength(1);
    expect(partial.match(/role="search"/g)).toHaveLength(1);
  });

  test("provides a hidden repository-filter chip with an accessible clear button", async () => {
    const partial = await Bun.file(partialPath).text();

    expect(partial.match(/id="repository-filter"/g)).toHaveLength(1);
    expect(partial.match(/id="repository-filter-name"/g)).toHaveLength(1);
    expect(partial.match(/id="repository-filter-clear"/g)).toHaveLength(1);
    // Hidden by default; the search script reveals it when a repo filter is active.
    expect(partial).toMatch(/id="repository-filter"[^>]*hidden/);
    expect(partial).toContain('aria-label="Clear repository filter"');
  });

  test("mentions the repository filter in the screen-reader search hint", async () => {
    const partial = await Bun.file(partialPath).text();

    expect(partial).toContain("search-hint");
    expect(partial).toMatch(/repository filter[^<]*/i);
  });
});
