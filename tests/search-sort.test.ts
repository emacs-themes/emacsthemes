import { expect, test, describe } from "bun:test";
import {
  getSortValue,
  buildSearchMap,
  getEntryName,
  getEntryTimestamp,
  compareEntriesByName,
  compareEntriesByDate,
  parseSortConfigFromSelect,
  buildSortComparators,
  filterThemes,
  sortThemes,
  type CardEntry,
  type ThemeIndexRecord,
  type ThemeIndexEntry,
  type SortConfig,
} from "../src/templates/core/search-sort";

/** Minimal element mock for tests that need getAttribute. */
function mockEl(attrs: Record<string, string> = {}): Element {
  const store = { ...attrs };
  return {
    getAttribute(name: string) {
      return store[name] ?? null;
    },
    // sortThemes reorders cards via appendChild — track parent
    parentNode: null as Element | null,
    appendChild(_other: Element) {},
  } as unknown as Element;
}

function makeEntry(id: string, overrides: Partial<CardEntry> = {}): CardEntry {
  return { id, card: mockEl(), ...overrides };
}

function makeIndexEntry(id: string, overrides: Partial<ThemeIndexEntry> = {}): ThemeIndexEntry {
  return {
    id,
    name: `Theme ${id}`,
    searchable: `theme ${id} dark`,
    screenshotGeneratedDate: null,
    ...overrides,
  };
}

function makeIndexRecord(overrides: Partial<ThemeIndexRecord> = {}): ThemeIndexRecord {
  return { name: "", searchable: "", screenshotGeneratedDate: null, ...overrides };
}

// ── getSortValue ──────────────────────────────────────────────────────────

describe("getSortValue", () => {
  const valid = ["name-asc", "name-desc", "date-asc", "date-desc"];
  const defaultVal = "name-asc";

  test("returns the value when it is valid", () => {
    expect(getSortValue("name-desc", valid, defaultVal)).toBe("name-desc");
    expect(getSortValue("date-asc", valid, defaultVal)).toBe("date-asc");
  });

  test("returns the default when value is null", () => {
    expect(getSortValue(null, valid, defaultVal)).toBe(defaultVal);
  });

  test("returns the default when value is not in the valid list", () => {
    expect(getSortValue("invalid-sort", valid, defaultVal)).toBe(defaultVal);
  });

  test("returns the default when value is an empty string", () => {
    expect(getSortValue("", valid, defaultVal)).toBe(defaultVal);
  });
});

// ── buildSearchMap ────────────────────────────────────────────────────────

describe("buildSearchMap", () => {
  test("populates the map from valid entries", () => {
    const map = new Map<string, ThemeIndexRecord>();
    const entries: ThemeIndexEntry[] = [
      makeIndexEntry("theme-a"),
      makeIndexEntry("theme-b", { screenshotGeneratedDate: "2024-01-15" }),
    ];

    buildSearchMap(map, entries);

    expect(map.size).toBe(2);
    expect(map.get("theme-a")?.name).toBe("Theme theme-a");
    expect(map.get("theme-a")?.searchable).toBe("theme theme-a dark");
    expect(map.get("theme-a")?.screenshotGeneratedDate).toBeNull();
    expect(map.get("theme-b")?.screenshotGeneratedDate).toBe("2024-01-15");
  });

  test("skips malformed entries and logs a warning", () => {
    const map = new Map<string, ThemeIndexRecord>();
    const warn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    const entries = [
      makeIndexEntry("valid"),
      { id: 123, searchable: "test" } as unknown as ThemeIndexEntry,
      null as unknown as ThemeIndexEntry,
      makeIndexEntry("also-valid"),
    ];
    buildSearchMap(map, entries);

    expect(map.size).toBe(2);
    expect(map.has("valid")).toBe(true);
    expect(map.has("also-valid")).toBe(true);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(
      warnings.some((w) => w.some((m) => typeof m === "string" && m.includes("malformed"))),
    ).toBe(true);

    console.warn = warn;
  });

  test("clears the map before building", () => {
    const map = new Map<string, ThemeIndexRecord>();
    map.set("stale", makeIndexRecord());

    buildSearchMap(map, [makeIndexEntry("fresh")]);

    expect(map.size).toBe(1);
    expect(map.has("stale")).toBe(false);
    expect(map.has("fresh")).toBe(true);
  });
});

// ── getEntryName ──────────────────────────────────────────────────────────

describe("getEntryName", () => {
  test("returns name from metadata when available", () => {
    const map = new Map([["a", makeIndexRecord({ name: "Alpha" })]]);
    expect(getEntryName(makeEntry("a"), map)).toBe("Alpha");
  });

  test("falls back to data-name attribute when metadata is missing", () => {
    const map = new Map<string, ThemeIndexRecord>();
    const card = mockEl({ "data-name": "Beta" });
    expect(getEntryName({ id: "b", card }, map)).toBe("Beta");
  });

  test("falls back to data-name when metadata name is empty", () => {
    const map = new Map([["c", makeIndexRecord({ name: "" })]]);
    const card = mockEl({ "data-name": "Gamma" });
    expect(getEntryName({ id: "c", card }, map)).toBe("Gamma");
  });

  test("returns empty string when both metadata and attribute are absent", () => {
    const map = new Map<string, ThemeIndexRecord>();
    expect(getEntryName(makeEntry("d"), map)).toBe("");
  });
});

// ── getEntryTimestamp ─────────────────────────────────────────────────────

describe("getEntryTimestamp", () => {
  test("returns timestamp for a valid ISO date string", () => {
    const map = new Map([["a", makeIndexRecord({ screenshotGeneratedDate: "2024-06-15" })]]);
    expect(getEntryTimestamp(makeEntry("a"), map)).toBe(Date.parse("2024-06-15"));
  });

  test("returns null when metadata has no date", () => {
    const map = new Map([["a", makeIndexRecord({ screenshotGeneratedDate: null })]]);
    expect(getEntryTimestamp(makeEntry("a"), map)).toBeNull();
  });

  test("returns null when metadata is missing", () => {
    expect(getEntryTimestamp(makeEntry("x"), new Map())).toBeNull();
  });

  test("returns null for an invalid date string", () => {
    const map = new Map([["a", makeIndexRecord({ screenshotGeneratedDate: "not-a-date" })]]);
    expect(getEntryTimestamp(makeEntry("a"), map)).toBeNull();
  });
});

// ── compareEntriesByName ──────────────────────────────────────────────────

describe("compareEntriesByName", () => {
  const map = new Map<string, ThemeIndexRecord>([
    ["a", makeIndexRecord({ name: "Alpha" })],
    ["b", makeIndexRecord({ name: "Beta" })],
    ["c", makeIndexRecord({ name: "Alpha" })],
  ]);
  const entryA = makeEntry("a");
  const entryB = makeEntry("b");
  const entryC = makeEntry("c");

  test("sorts ascending by name", () => {
    expect(compareEntriesByName(entryA, entryB, "asc", map)).toBeLessThan(0);
    expect(compareEntriesByName(entryB, entryA, "asc", map)).toBeGreaterThan(0);
  });

  test("sorts descending by name", () => {
    expect(compareEntriesByName(entryB, entryA, "desc", map)).toBeLessThan(0);
    expect(compareEntriesByName(entryA, entryB, "desc", map)).toBeGreaterThan(0);
  });

  test("ties broken by id ascending", () => {
    expect(compareEntriesByName(entryA, entryC, "asc", map)).not.toBe(0);
  });
});

// ── compareEntriesByDate ──────────────────────────────────────────────────

describe("compareEntriesByDate", () => {
  const map = new Map<string, ThemeIndexRecord>([
    ["old", makeIndexRecord({ name: "Old", screenshotGeneratedDate: "2023-01-01" })],
    ["new", makeIndexRecord({ name: "New", screenshotGeneratedDate: "2024-06-15" })],
    ["nodate", makeIndexRecord({ name: "No Date", screenshotGeneratedDate: null })],
    ["other", makeIndexRecord({ name: "Other", screenshotGeneratedDate: "2023-01-01" })],
  ]);
  const entryOld = makeEntry("old");
  const entryNew = makeEntry("new");
  const entryNoDate = makeEntry("nodate");
  const entryOther = makeEntry("other");

  test("dated entries sorted ascending", () => {
    expect(compareEntriesByDate(entryOld, entryNew, "asc", map)).toBeLessThan(0);
    expect(compareEntriesByDate(entryNew, entryOld, "asc", map)).toBeGreaterThan(0);
  });

  test("dated entries sorted descending", () => {
    expect(compareEntriesByDate(entryNew, entryOld, "desc", map)).toBeLessThan(0);
    expect(compareEntriesByDate(entryOld, entryNew, "desc", map)).toBeGreaterThan(0);
  });

  test("undated entries are pushed to the end", () => {
    expect(compareEntriesByDate(entryNoDate, entryOld, "asc", map)).toBeGreaterThan(0);
    expect(compareEntriesByDate(entryOld, entryNoDate, "asc", map)).toBeLessThan(0);
  });

  test("two undated entries tie-break by name ascending", () => {
    const map2 = new Map<string, ThemeIndexRecord>([
      ["z", makeIndexRecord({ name: "Zeta" })],
      ["a", makeIndexRecord({ name: "Alpha" })],
    ]);
    expect(compareEntriesByDate(makeEntry("z"), makeEntry("a"), "asc", map2)).toBeGreaterThan(0);
  });

  test("tie on same date breaks by name ascending", () => {
    expect(compareEntriesByDate(entryOld, entryOther, "asc", map)).toBeLessThan(0);
  });
});

// ── parseSortConfigFromSelect ─────────────────────────────────────────────

describe("parseSortConfigFromSelect", () => {
  test("parses options with data-key and data-dir attributes", () => {
    const select = {
      options: [
        {
          value: "name-asc",
          label: "Name A–Z",
          getAttribute: (n: string) => (n === "data-key" ? "name" : "asc"),
        },
        {
          value: "name-desc",
          label: "Name Z–A",
          getAttribute: (n: string) => (n === "data-key" ? "name" : "desc"),
        },
        {
          value: "date-desc",
          label: "Newest first",
          getAttribute: (n: string) => (n === "data-key" ? "date" : "desc"),
        },
        {
          value: "date-asc",
          label: "Oldest first",
          getAttribute: (n: string) => (n === "data-key" ? "date" : "asc"),
        },
      ],
    } as unknown as HTMLSelectElement;

    const configs = parseSortConfigFromSelect(select);

    expect(configs).toHaveLength(4);
    expect(configs[0]).toEqual({ value: "name-asc", label: "Name A–Z", key: "name", dir: "asc" });
    expect(configs[2]).toEqual({
      value: "date-desc",
      label: "Newest first",
      key: "date",
      dir: "desc",
    });
  });

  test("returns empty array for null select", () => {
    expect(parseSortConfigFromSelect(null)).toEqual([]);
  });

  test("defaults dir to asc when data-dir is missing", () => {
    const select = {
      options: [
        {
          value: "name-asc",
          label: "",
          getAttribute: (n: string) => (n === "data-key" ? "name" : null),
        },
      ],
    } as unknown as HTMLSelectElement;

    const configs = parseSortConfigFromSelect(select);
    expect(configs[0].dir).toBe("asc");
  });
});

// ── buildSortComparators ──────────────────────────────────────────────────

describe("buildSortComparators", () => {
  const map = new Map<string, ThemeIndexRecord>([
    ["a", makeIndexRecord({ name: "Alpha", screenshotGeneratedDate: "2024-01-01" })],
    ["b", makeIndexRecord({ name: "Beta", screenshotGeneratedDate: "2024-06-15" })],
  ]);
  const entryA = makeEntry("a");
  const entryB = makeEntry("b");

  const configs: SortConfig[] = [
    { value: "name-asc", label: "Name A–Z", key: "name", dir: "asc" },
    { value: "name-desc", label: "Name Z–A", key: "name", dir: "desc" },
    { value: "date-asc", label: "Oldest first", key: "date", dir: "asc" },
    { value: "date-desc", label: "Newest first", key: "date", dir: "desc" },
  ];

  test("builds a map of value to comparator function", () => {
    const comparators = buildSortComparators(configs, map);
    expect(Object.keys(comparators)).toEqual(["name-asc", "name-desc", "date-asc", "date-desc"]);
    expect(comparators["name-asc"](entryA, entryB)).toBeLessThan(0);
    expect(comparators["name-desc"](entryA, entryB)).toBeGreaterThan(0);
    expect(comparators["date-asc"](entryA, entryB)).toBeLessThan(0);
    expect(comparators["date-desc"](entryA, entryB)).toBeGreaterThan(0);
  });

  test("returns empty object for empty configs", () => {
    expect(buildSortComparators([], map)).toEqual({});
  });
});

// ── filterThemes ──────────────────────────────────────────────────────────

describe("filterThemes", () => {
  test("shows all cards for an empty query", () => {
    const entries = [makeEntry("a"), makeEntry("b"), makeEntry("c")];
    const map = new Map<string, ThemeIndexRecord>();
    const visibility: string[] = [];

    const count = filterThemes(entries, map, "", (e, v) => visibility.push(`${e.id}:${v}`));

    expect(count).toBe(3);
    expect(visibility).toEqual(["a:true", "b:true", "c:true"]);
  });

  test("filters cards matching the query", () => {
    const map = new Map<string, ThemeIndexRecord>([
      ["a", makeIndexRecord({ name: "Alpha", searchable: "alpha dark" })],
      ["b", makeIndexRecord({ name: "Beta", searchable: "beta light" })],
    ]);
    const entries = [makeEntry("a"), makeEntry("b")];
    const visible: string[] = [];

    const count = filterThemes(entries, map, "dark", (e, v) => visible.push(`${e.id}:${v}`));

    expect(count).toBe(1);
    expect(visible).toEqual(["a:true", "b:false"]);
  });

  test("returns 0 when no cards match", () => {
    const map = new Map<string, ThemeIndexRecord>([
      ["a", makeIndexRecord({ name: "Alpha", searchable: "alpha dark" })],
    ]);

    const count = filterThemes([makeEntry("a")], map, "nonexistent", () => {});

    expect(count).toBe(0);
  });

  test("uses empty searchable when metadata is missing", () => {
    const map = new Map<string, ThemeIndexRecord>();
    const visible: string[] = [];

    filterThemes([makeEntry("a")], map, "anything", (e, v) => visible.push(`${e.id}:${v}`));

    expect(visible).toEqual(["a:false"]);
  });

  test("matches case-insensitively against lowercased searchable", () => {
    const map = new Map<string, ThemeIndexRecord>([
      ["a", makeIndexRecord({ name: "Alpha", searchable: "alpha dark theme" })],
      ["b", makeIndexRecord({ name: "Beta", searchable: "beta light theme" })],
    ]);
    const visible: string[] = [];

    filterThemes([makeEntry("a"), makeEntry("b")], map, "dark", (e, v) =>
      visible.push(`${e.id}:${v}`),
    );

    expect(visible).toEqual(["a:true", "b:false"]);
  });
});

// ── sortThemes (w/ minimal DOM mock) ──────────────────────────────────────

function mockDoc() {
  const fragmentChildren: Element[] = [];
  return {
    createDocumentFragment() {
      return {
        appendChild(card: Element) {
          fragmentChildren.push(card);
        },
      } as unknown as DocumentFragment;
    },
    fragmentChildren,
  };
}

describe("sortThemes", () => {
  test("reorders cards into fragment in sorted order", () => {
    const grid = { appendChild(_card: Element) {} } as unknown as Element;
    const doc = mockDoc();

    const cardB = {} as Element;
    const cardA = {} as Element;
    const cardG = {} as Element;
    const entries: CardEntry[] = [
      { id: "b", card: cardB },
      { id: "a", card: cardA },
      { id: "g", card: cardG },
    ];

    const map = new Map<string, ThemeIndexRecord>([
      ["a", makeIndexRecord({ name: "Alpha" })],
      ["b", makeIndexRecord({ name: "Beta" })],
      ["g", makeIndexRecord({ name: "Gamma" })],
    ]);
    const configs: SortConfig[] = [{ value: "name-asc", label: "", key: "name", dir: "asc" }];
    const comparators = buildSortComparators(configs, map);

    sortThemes(grid, entries, comparators, "name-asc", doc);

    expect(doc.fragmentChildren).toEqual([cardA, cardB, cardG]);
  });

  test("does nothing when comparator is not found", () => {
    const doc = mockDoc();
    const grid = { appendChild(_card: Element) {} } as unknown as Element;

    sortThemes(grid, [makeEntry("a")], {}, "nonexistent", doc);

    expect(doc.fragmentChildren).toEqual([]);
  });
});
