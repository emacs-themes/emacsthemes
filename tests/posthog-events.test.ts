import { describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";

const searchBuildOptions: Parameters<typeof Bun.build>[0] & { write: boolean } = {
  entrypoints: ["src/templates/html/partials/search-script.js"],
  target: "browser",
  write: false,
};

const searchBuild = await Bun.build(searchBuildOptions);

if (!searchBuild.success) throw new Error("Failed to bundle search script");

const searchScript = await searchBuild.outputs[0].text();

const posthogScript = await Bun.file("src/templates/html/partials/posthog-script.js").text();

/**
 * DOM event payload dispatched inside the browser-script doubles.
 */
interface StubDispatchedEvent {
  button?: number;
  preventDefault?(): void;
  target?: unknown;
}

/** Payload held by a dispatched listener call. */
type StubListenerEvent = StubDispatchedEvent & { type: string };

type Listener = (event: StubListenerEvent) => void;

/** PostHog event properties captured by the script doubles. */
interface CapturedProperties {
  search_term?: string;
  query_length?: number;
  result_count?: number;
  has_repository_filter?: boolean;
  invalid_repository_filter?: boolean;
  search_origin?: string;
  sort?: string;
  theme_id?: string | null;
  source_location?: string;
  source_url?: string;
  source_kind?: string;
}

type Capture = [string, CapturedProperties];

/** Methods every stub dispatch target shares. */
interface StubTargetMethods {
  addEventListener(type: string, listener: Listener): void;
  dispatch(type: string, event?: StubDispatchedEvent): void;
  listeners: Map<string, Listener[]>;
}

/** Creates the minimal event target needed by the browser scripts. */
function eventTarget<P>(properties?: P): P & StubTargetMethods {
  const listeners = new Map<string, Listener[]>();
  // SAFETY: stub callers pass fully-typed property bags; the absent default is an empty bag.
  const props = (properties ?? {}) as P;

  return {
    ...props,
    addEventListener(type: string, listener: Listener) {
      const registered = listeners.get(type) ?? [];
      registered.push(listener);
      listeners.set(type, registered);
    },
    dispatch(type: string, event: StubDispatchedEvent = {}) {
      for (const listener of listeners.get(type) ?? []) listener({ type, ...event });
    },
    listeners,
  };
}

/** Creates the no-op class list needed by search result rendering. */
function classList() {
  return { add() {}, remove() {}, toggle() {} };
}

/** Executes the bundled search script against a minimal themes-directory DOM. */
async function runSearch(url = "https://emacsthemes.com/", withPosthog = true) {
  const captures: Capture[] = [];

  const themes = [
    { id: "alpha", name: "Alpha", searchable: "alpha dark theme" },
    { id: "beta", name: "Beta", searchable: "beta light theme" },
  ];

  const cards = themes.map((theme) => ({
    ...eventTarget(),
    classList: classList(),
    getAttribute(name: string) {
      if (name === "data-id") return theme.id;

      if (name === "data-name") return theme.name;

      return null;
    },
  }));

  const input = eventTarget({ value: "", disabled: false });

  const sort = eventTarget({
    value: "name-asc",
    disabled: false,
    options: [
      {
        value: "name-asc",
        label: "Name A–Z",
        getAttribute: (name: string) => (name === "data-key" ? "name" : "asc"),
      },
      {
        value: "name-desc",
        label: "Name Z–A",
        getAttribute: (name: string) => (name === "data-key" ? "name" : "desc"),
      },
    ],
  });

  const form = eventTarget();
  const grid = { classList: classList(), appendChild() {} };

  /** Precise lookup contract for the ids search-script queries. */
  const elements = {
    q: input,
    sort,
    "search-results-headline": { classList: classList(), textContent: "" },
    "no-results-message": { classList: classList(), textContent: "" },
    "repository-filter": { hidden: true },
    "repository-filter-name": { textContent: "" },
    "repository-filter-clear": eventTarget(),
  };

  const document = {
    // SAFETY: ids arrive only from search-script internals; silence the unknown ids.
    getElementById: (id: string) => elements[id as keyof typeof elements] ?? null,
    querySelector: (selector: string) =>
      selector === ".searchbar" ? form : selector === ".grid" ? grid : null,
    querySelectorAll: (selector: string) => (selector === ".card" ? cards : []),
    createDocumentFragment: () => ({ appendChild() {} }),
  };

  const window = eventTarget({
    location: new URL(url),
    fetch: async () => ({
      ok: true,
      json: async () => themes.map((theme) => ({ ...theme, repositoryUrl: null })),
    }),
  });

  Object.assign(window, {
    window,
    document,
    URL,
    URLSearchParams,
    console,
    history: {
      pushState(_state: Record<string, never>, _unused: string, nextUrl: string) {
        window.location = new URL(nextUrl);
      },
      replaceState(_state: Record<string, never>, _unused: string, nextUrl: string) {
        window.location = new URL(nextUrl);
      },
    },
  });

  if (withPosthog) {
    Object.assign(window, {
      posthog: {
        capture: (event: string, properties: CapturedProperties) =>
          captures.push([event, properties]),
      },
    });
  }

  runInNewContext(searchScript, window, { filename: "search-script.js" });

  for (let attempts = 0; attempts < 10 && form.listeners.get("submit") === undefined; attempts++) {
    await Promise.resolve();
  }

  expect(form.listeners.get("submit")).toHaveLength(1);

  return { captures, form, input, sort, window };
}

/** Executes the complete PostHog script with an already-loaded client stub. */
function runPosthog(detailId: string | null = null) {
  const captures: Capture[] = [];
  const initCalls: unknown[][] = [];
  const detail = detailId === null ? null : { dataset: { themeId: detailId } };
  const document = eventTarget({ querySelector: () => detail });

  const posthog = {
    __loaded: true,
    init: (...args: unknown[]) => initCalls.push(args),
    capture: (event: string, properties: CapturedProperties) => captures.push([event, properties]),
  };

  const window = {
    document,
    posthog,
    URL,
    // SAFETY: the vm context requires the mirrored window self-reference.
    window: undefined as unknown,
  };

  window.window = window;
  runInNewContext(posthogScript, window, { filename: "posthog-script.js" });

  return { captures, document, initCalls };
}

/** Creates a delegated source-link event target in detail or popular markup. */
function sourceTarget(href: string, themeId: string | null) {
  const detail = themeId === null ? null : { dataset: { themeId } };

  const link = {
    href,
    closest: (selector: string) => (selector === ".theme-detail[data-theme-id]" ? detail : null),
  };

  return { closest: () => link };
}

describe("search analytics", () => {
  test("records submitted searches and the additional no-results event", async () => {
    const app = await runSearch();
    app.input.value = "dark";
    app.form.dispatch("submit", { preventDefault() {} });

    expect(app.captures).toEqual([
      [
        "theme_search",
        {
          search_term: "dark",
          query_length: 4,
          result_count: 1,
          has_repository_filter: false,
          invalid_repository_filter: false,
          search_origin: "submit",
          sort: "name-asc",
        },
      ],
    ]);

    app.captures.length = 0;
    app.input.value = "missing";
    app.form.dispatch("submit", { preventDefault() {} });
    expect(app.captures.map(([event]) => event)).toEqual([
      "theme_search",
      "theme_search_no_results",
    ]);
    expect(
      app.captures.every(
        ([, properties]) => properties.result_count === 0 && properties.search_term === "missing",
      ),
    ).toBe(true);
  });

  test("does not count blanks, sorting, popstate, or keystrokes", async () => {
    const app = await runSearch();
    app.input.value = "dark";
    app.input.dispatch("input");
    app.input.dispatch("keyup");
    app.sort.value = "name-desc";
    app.sort.dispatch("change");
    app.input.value = "  ";
    app.form.dispatch("submit", { preventDefault() {} });
    app.window.location = new URL("https://emacsthemes.com/?q=dark");
    app.window.dispatch("popstate");

    expect(app.captures).toEqual([]);
  });

  test("records a nonblank query restored from the initial URL", async () => {
    const app = await runSearch("https://emacsthemes.com/?q=dark");

    expect(app.captures).toHaveLength(1);
    expect(app.captures[0][0]).toBe("theme_search");
    expect(app.captures[0][1]).toMatchObject({
      search_term: "dark",
      result_count: 1,
      search_origin: "url",
    });
  });

  test("keeps search working when PostHog is absent", async () => {
    const app = await runSearch("https://emacsthemes.com/", false);
    app.input.value = "dark";

    expect(() => app.form.dispatch("submit", { preventDefault() {} })).not.toThrow();
  });
});

describe("PostHog page and source analytics", () => {
  test("initializes the existing client and records detail views after DOMContentLoaded", () => {
    const app = runPosthog("modus-vivendi");
    expect(app.initCalls).toHaveLength(1);

    app.document.dispatch("DOMContentLoaded");
    expect(app.captures).toEqual([["theme_viewed", { theme_id: "modus-vivendi" }]]);
  });

  test("does not record a directory page view", () => {
    const app = runPosthog();
    app.document.dispatch("DOMContentLoaded");
    expect(app.captures).toEqual([]);
  });

  test("records primary local and middle-button popular source activations only", () => {
    const app = runPosthog();
    let prevented = false;
    app.document.dispatch("click", {
      button: 0,
      target: sourceTarget(
        "https://emacsthemes.com/static/themes/modus/modus-theme.el?download=1#source",
        "modus",
      ),
      preventDefault: () => {
        prevented = true;
      },
    });
    app.document.dispatch("auxclick", {
      button: 1,
      target: sourceTarget("https://github.com/owner/theme?tab=readme#source", null),
      preventDefault: () => {
        prevented = true;
      },
    });
    app.document.dispatch("auxclick", {
      button: 2,
      target: sourceTarget("https://github.com/ignored/right-click", null),
    });
    app.document.dispatch("click", { button: 0, target: { closest: () => null } });

    expect(app.captures).toEqual([
      [
        "theme_source_clicked",
        {
          theme_id: "modus",
          source_location: "theme_detail",
          source_url: "https://emacsthemes.com/static/themes/modus/modus-theme.el",
          source_kind: "local_file",
        },
      ],
      [
        "theme_source_clicked",
        {
          theme_id: null,
          source_location: "popular",
          source_url: "https://github.com/owner/theme",
          source_kind: "repository",
        },
      ],
    ]);
    expect(prevented).toBe(false);
  });
});
