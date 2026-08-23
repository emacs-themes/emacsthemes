import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  fetchPopularThemes,
  writePopularThemesLogs,
  POPULAR_THEMES_LIMIT,
} from "../src/templates/fetch-popular-themes";
import type {
  GitHubThemeEntry,
  MelpaThemeEntry,
  PopularThemeSourceResult,
} from "../src/templates/fetch-popular-themes";

const originalFetch = globalThis.fetch;
const originalToken = process.env.GITHUB_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) {
    delete process.env.GITHUB_TOKEN;
  } else {
    process.env.GITHUB_TOKEN = originalToken;
  }
});

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function mockFetch(handler: FetchHandler) {
  globalThis.fetch = handler as typeof fetch;
}

/** Routes requests by URL: GitHub URLs to the GitHub handler, everything else to MELPA. */
function combinedHandler(melpa: FetchHandler, github: FetchHandler): FetchHandler {
  return (url, init) => {
    if (url.includes("api.github.com")) {
      return github(url, init);
    }
    return melpa(url, init);
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function rawResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "application/json" } });
}

function melpaHandler(
  counts: Record<string, number>,
  recipes: Record<string, unknown> = {},
): FetchHandler {
  return (url) => {
    if (url.includes("melpa.org/recipes.json")) {
      return jsonResponse(recipes);
    }
    if (url.includes("melpa.org/download_counts.json")) {
      return jsonResponse(counts);
    }
    throw new Error(`Unexpected MELPA URL: ${url}`);
  };
}

function githubHandler(items: unknown, overrides: Record<string, unknown> = {}): FetchHandler {
  return (url) => {
    if (!url.includes("api.github.com/search/repositories")) {
      throw new Error(`Unexpected GitHub URL: ${url}`);
    }
    return jsonResponse({
      total_count: Array.isArray(items) ? items.length : 0,
      incomplete_results: false,
      items,
      ...overrides,
    });
  };
}

const defaultGitHubItems = [
  {
    full_name: "owner/theme",
    html_url: "https://github.com/owner/theme",
    stargazers_count: 10,
  },
];

const okMelpa = () => melpaHandler({ "ok-theme": 1 });

/** Returns the MELPA entries, asserting the source succeeded. */
function melpaOk(results: PopularThemeSourceResult[]): MelpaThemeEntry[] {
  const result = results.find(
    (r): r is Extract<PopularThemeSourceResult, { source: "melpa"; status: "ok" }> =>
      r.source === "melpa" && r.status === "ok",
  );
  if (!result) {
    expect(results.find((r) => r.source === "melpa")?.status).toBe("ok");
    return [];
  }
  return result.entries;
}

/** Returns the GitHub entries, asserting the source succeeded. */
function githubOk(results: PopularThemeSourceResult[]): GitHubThemeEntry[] {
  const result = results.find(
    (r): r is Extract<PopularThemeSourceResult, { source: "github"; status: "ok" }> =>
      r.source === "github" && r.status === "ok",
  );
  if (!result) {
    expect(results.find((r) => r.source === "github")?.status).toBe("ok");
    return [];
  }
  return result.entries;
}

/** Returns the GitHub error message, asserting the source failed. */
function githubFailed(results: PopularThemeSourceResult[]): string {
  const result = results.find(
    (r): r is Extract<PopularThemeSourceResult, { source: "github"; status: "failed" }> =>
      r.source === "github" && r.status === "failed",
  );
  if (!result) {
    expect(results.find((r) => r.source === "github")?.status).toBe("failed");
    return "";
  }
  return result.error;
}

describe("MELPA selection and limit", () => {
  test(`keeps ${POPULAR_THEMES_LIMIT} valid entries sorted by downloads with name tie-breaking`, async () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 115; i++) {
      counts[`theme-${String(i).padStart(3, "0")}-theme`] = i;
    }
    counts["aaa-theme"] = 900_000;
    counts["bbb-theme"] = 900_000;
    counts["zzz-theme"] = 1_000_000;
    counts["github-theme"] = 90_000;
    counts["direct-url-theme"] = 80_000;
    counts["sourcehut-theme"] = 70_000;
    counts["codeberg-theme"] = 69_000;
    counts["savannah-theme"] = 68_000;
    counts["bitbucket-theme"] = 67_000;
    counts["unknown-fetcher-theme"] = 66_000;
    counts["doom-themes"] = 65_000;
    counts["no-repo-theme"] = 60_000;
    counts["empty-meta-theme"] = 50_000;
    counts["missing-recipe-theme"] = 40_000;
    // Must all be excluded:
    counts["helm-themes"] = 999_999;
    counts["color-theme"] = 999_998;
    counts["/evil-theme"] = 999_997;
    counts["doom"] = 999_996;
    counts["broken-theme"] = -5;
    counts["company-theme-selector"] = 999_995;
    counts["awesome-thematic"] = 999_994;

    const recipes = {
      "github-theme": { fetcher: "github", repo: "owner/repo" },
      "direct-url-theme": { url: "https://gitlab.com/owner/repo.git" },
      "sourcehut-theme": { fetcher: "sourcehut", repo: "owner/repo" },
      "codeberg-theme": { fetcher: "codeberg", repo: "owner/repo" },
      "savannah-theme": { fetcher: "savannah", repo: "owner/repo" },
      "bitbucket-theme": { fetcher: "bitbucket", repo: "owner/repo" },
      "unknown-fetcher-theme": { fetcher: "gitdub", repo: "owner/repo" },
      "no-repo-theme": { fetcher: "github" },
      "empty-meta-theme": {},
    };

    mockFetch(combinedHandler(melpaHandler(counts, recipes), githubHandler(defaultGitHubItems)));

    const results = await fetchPopularThemes();
    const melpa = melpaOk(results);
    expect(melpa).toHaveLength(POPULAR_THEMES_LIMIT);

    // Downloads strictly descending across the whole list.
    for (let i = 1; i < melpa.length; i++) {
      expect(melpa[i - 1].downloads).toBeGreaterThanOrEqual(melpa[i].downloads);
    }

    // Top entry and equal-download tie broken by package name ascending.
    expect(melpa[0]).toEqual({ name: "zzz theme", downloads: 1_000_000, sourceUrl: undefined });
    expect(melpa[1].name).toBe("aaa theme");
    expect(melpa[2].name).toBe("bbb theme");
    expect(melpa[1].downloads).toBe(900_000);
    expect(melpa[2].downloads).toBe(900_000);

    // Ignored, slash-prefixed, non-theme, -thematic, and negative-count packages are excluded.
    const names = melpa.map((entry) => entry.name);
    for (const excluded of [
      "helm themes",
      "color theme",
      "/evil theme",
      "doom",
      "broken theme",
      "company theme selector",
      "awesome thematic",
    ]) {
      expect(names).not.toContain(excluded);
    }

    // Plural "-themes" packages are real themes and must be kept.
    expect(names).toContain("doom themes");

    // Display-name formatting replaces hyphens with spaces.
    expect(melpa.find((entry) => entry.downloads === 90_000)?.name).toBe("github theme");
    // The 100th entry is the lowest kept count (29) among the numbered packages.
    expect(melpa[POPULAR_THEMES_LIMIT - 1]).toEqual({
      name: "theme 029 theme",
      downloads: 29,
      sourceUrl: undefined,
    });

    // Recipe URL composition with an explicit fetcher domain map.
    expect(melpa.find((entry) => entry.name === "github theme")?.sourceUrl).toBe(
      "https://github.com/owner/repo",
    );
    expect(melpa.find((entry) => entry.name === "direct url theme")?.sourceUrl).toBe(
      "https://gitlab.com/owner/repo",
    );
    expect(melpa.find((entry) => entry.name === "sourcehut theme")?.sourceUrl).toBe(
      "https://git.sr.ht/~owner/repo",
    );
    expect(melpa.find((entry) => entry.name === "codeberg theme")?.sourceUrl).toBe(
      "https://codeberg.org/owner/repo",
    );
    expect(melpa.find((entry) => entry.name === "savannah theme")?.sourceUrl).toBe(
      "https://savannah.gnu.org/owner/repo",
    );
    expect(melpa.find((entry) => entry.name === "bitbucket theme")?.sourceUrl).toBe(
      "https://bitbucket.org/owner/repo",
    );
    expect(
      melpa.find((entry) => entry.name === "unknown fetcher theme")?.sourceUrl,
    ).toBeUndefined();
    expect(melpa.find((entry) => entry.name === "no repo theme")?.sourceUrl).toBeUndefined();
    expect(melpa.find((entry) => entry.name === "empty meta theme")?.sourceUrl).toBeUndefined();
    expect(melpa.find((entry) => entry.name === "missing recipe theme")?.sourceUrl).toBeUndefined();
  });

  test("adds source URLs for archived themes missing from MELPA recipes", async () => {
    mockFetch(
      combinedHandler(
        melpaHandler({
          "color-theme-solarized": 6,
          "darkburn-theme": 5,
          "eziam-theme": 4,
          "farmhouse-theme": 3,
          "majapahit-theme": 2,
          "omtose-phellack-theme": 1,
        }),
        githubHandler(defaultGitHubItems),
      ),
    );

    expect(melpaOk(await fetchPopularThemes())).toEqual([
      {
        name: "color theme solarized",
        downloads: 6,
        sourceUrl: "https://github.com/sellout/emacs-color-theme-solarized",
      },
      {
        name: "darkburn theme",
        downloads: 5,
        sourceUrl: "https://github.com/gorauskas/darkburn-theme",
      },
      {
        name: "eziam theme",
        downloads: 4,
        sourceUrl: "https://github.com/thblt/eziam-theme-emacs",
      },
      {
        name: "farmhouse theme",
        downloads: 3,
        sourceUrl: "https://github.com/mattly/emacs-farmhouse-theme",
      },
      {
        name: "majapahit theme",
        downloads: 2,
        sourceUrl: "https://gitlab.com/franksn/majapahit-theme/-/tree/master?ref_type=heads",
      },
      {
        name: "omtose phellack theme",
        downloads: 1,
        sourceUrl: "https://github.com/franksn/omtose-phellack-theme",
      },
    ]);
  });

  test("ignores non-finite download counts", async () => {
    const countsBody = '{"huge-theme": 1e999, "ok-theme": 10}';
    mockFetch(
      combinedHandler(
        (url) => (url.includes("download_counts") ? rawResponse(countsBody) : jsonResponse({})),
        githubHandler(defaultGitHubItems),
      ),
    );

    const results = await fetchPopularThemes();
    expect(melpaOk(results)).toEqual([{ name: "ok theme", downloads: 10, sourceUrl: undefined }]);
  });

  test("ties between huge equal counts break deterministically by name", async () => {
    mockFetch(
      combinedHandler(
        melpaHandler({ "huge-b-theme": 1e308, "huge-a-theme": 1e308 }),
        githubHandler(defaultGitHubItems),
      ),
    );

    const results = await fetchPopularThemes();
    expect(melpaOk(results).map((entry) => entry.name)).toEqual(["huge a theme", "huge b theme"]);
  });
});

describe("GitHub request construction", () => {
  test("uses the fixed query, parameters, required headers, and rejects redirects", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    mockFetch((url, init) => {
      if (url.includes("api.github.com/search/repositories")) {
        capturedUrl = url;
        capturedInit = init;
        return jsonResponse({
          total_count: 1,
          incomplete_results: false,
          items: defaultGitHubItems,
        });
      }
      return jsonResponse({ "ok-theme": 1 });
    });

    const results = await fetchPopularThemes();
    expect(githubOk(results)).toBeDefined();

    const parsed = new URL(capturedUrl);
    expect(parsed.origin).toBe("https://api.github.com");
    expect(parsed.pathname).toBe("/search/repositories");
    expect(parsed.searchParams.get("q")).toBe(
      'theme OR "color scheme" OR "colour scheme" OR colorscheme OR colourscheme in:name,description language:"Emacs Lisp" is:public',
    );
    expect(parsed.searchParams.get("sort")).toBe("stars");
    expect(parsed.searchParams.get("order")).toBe("desc");
    expect(parsed.searchParams.get("per_page")).toBe(String(POPULAR_THEMES_LIMIT));
    expect(parsed.searchParams.get("page")).toBe("1");

    const headers = capturedInit?.headers as Record<string, string> | undefined;
    expect(headers).toBeDefined();
    expect(headers?.Accept).toBe("application/vnd.github+json");
    expect(headers?.["X-GitHub-Api-Version"]).toBe("2022-11-28");
    expect(headers?.["User-Agent"]).toBe("emacs-themes/emacsthemes");
    // The token-bearing request must never follow cross-origin redirects.
    expect(capturedInit?.redirect).toBe("error");
  });
});

describe("GitHub authentication", () => {
  function captureGitHubRequest(): { init: () => RequestInit | undefined } {
    const captured: { init: () => RequestInit | undefined } = { init: () => undefined };
    let capturedInit: RequestInit | undefined;
    captured.init = () => capturedInit;
    mockFetch((url, init) => {
      if (url.includes("api.github.com/search/repositories")) {
        capturedInit = init;
        return jsonResponse({
          total_count: 1,
          incomplete_results: false,
          items: defaultGitHubItems,
        });
      }
      return jsonResponse({ "ok-theme": 1 });
    });
    return captured;
  }

  test("sends a trimmed Authorization header when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "  ghp_test-secret-token\n";
    const captured = captureGitHubRequest();

    await fetchPopularThemes();

    const headers = captured.init()?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe("Bearer ghp_test-secret-token");
  });

  test("omits the Authorization header without GITHUB_TOKEN", async () => {
    delete process.env.GITHUB_TOKEN;
    const captured = captureGitHubRequest();

    await fetchPopularThemes();

    const headers = captured.init()?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBeUndefined();
  });

  test("omits the Authorization header when GITHUB_TOKEN is blank or whitespace", async () => {
    process.env.GITHUB_TOKEN = "   ";
    const captured = captureGitHubRequest();

    await fetchPopularThemes();

    const headers = captured.init()?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBeUndefined();
  });
});

describe("GitHub mapping and ordering", () => {
  test("maps fields, sorts by stars with name tie-breaking, and caps at the limit", async () => {
    const items: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 120; i++) {
      const padded = String(i).padStart(3, "0");
      items.push({
        full_name: `owner/repo-${padded}`,
        html_url: `https://github.com/owner/repo-${padded}`,
        stargazers_count: i,
      });
    }
    items.push({
      full_name: "aaa/theme",
      html_url: "https://github.com/aaa/theme",
      stargazers_count: 500,
    });
    items.push({
      full_name: "bbb/theme",
      html_url: "https://github.com/bbb/theme",
      stargazers_count: 500,
    });
    items.push({
      full_name: "zzz/theme",
      html_url: "https://github.com/zzz/theme",
      stargazers_count: 1000,
    });

    mockFetch(combinedHandler(okMelpa(), githubHandler(items)));

    const github = githubOk(await fetchPopularThemes());
    expect(github).toHaveLength(POPULAR_THEMES_LIMIT);

    expect(github[0]).toEqual({
      name: "zzz/theme",
      stars: 1000,
      sourceUrl: "https://github.com/zzz/theme",
    });
    expect(github[1].name).toBe("aaa/theme");
    expect(github[2].name).toBe("bbb/theme");
    expect(github[1].stars).toBe(500);
    expect(github[2].stars).toBe(500);

    for (let i = 1; i < github.length; i++) {
      expect(github[i - 1].stars).toBeGreaterThanOrEqual(github[i].stars);
    }

    // The cap keeps counts 119 down to 23 plus the three top entries.
    expect(github[POPULAR_THEMES_LIMIT - 1]).toEqual({
      name: "owner/repo-023",
      stars: 23,
      sourceUrl: "https://github.com/owner/repo-023",
    });
  });

  test("excludes known non-theme repositories from the ranking", async () => {
    const items = [
      { full_name: "real/theme", html_url: "https://github.com/real/theme", stargazers_count: 500 },
      {
        full_name: "TheBB/spaceline",
        html_url: "https://github.com/TheBB/spaceline",
        stargazers_count: 4000,
      },
      {
        full_name: "hadronzoo/theme-changer",
        html_url: "https://github.com/hadronzoo/theme-changer",
        stargazers_count: 3000,
      },
      {
        full_name: "jcaw/theme-magic",
        html_url: "https://github.com/jcaw/theme-magic",
        stargazers_count: 2000,
      },
    ];

    mockFetch(combinedHandler(okMelpa(), githubHandler(items)));

    const github = githubOk(await fetchPopularThemes());
    const names = github.map((entry) => entry.name);
    expect(names).toEqual(["real/theme"]);
  });
});

describe("GitHub partial-result policy", () => {
  test("accepts incomplete search results with a warning", async () => {
    mockFetch(
      combinedHandler(okMelpa(), githubHandler(defaultGitHubItems, { incomplete_results: true })),
    );

    const results = await fetchPopularThemes();
    const github = results.find((r) => r.source === "github");
    expect(github?.status).toBe("ok");
    if (github?.status === "ok") {
      expect(github.entries).toHaveLength(1);
      expect(github.warning).toContain("incomplete");
    }
  });

  test("drops malformed items with a warning while keeping valid items", async () => {
    const items = [
      { full_name: "good/theme", html_url: "https://github.com/good/theme", stargazers_count: 5 },
      { full_name: "", html_url: "https://github.com/x", stargazers_count: 1 },
      { full_name: "no-url", stargazers_count: 1 },
    ];

    mockFetch(combinedHandler(okMelpa(), githubHandler(items)));

    const results = await fetchPopularThemes();
    const github = results.find((r) => r.source === "github");
    expect(github?.status).toBe("ok");
    if (github?.status === "ok") {
      expect(github.entries.map((e) => e.name)).toEqual(["good/theme"]);
      expect(github.warning).toContain("malformed");
    }
  });
});

describe("GitHub source failures", () => {
  const failureCases: Array<[string, FetchHandler]> = [
    ["missing items", () => jsonResponse({ total_count: 0, incomplete_results: false })],
    ["non-array items", githubHandler("not-an-array")],
    ["empty items", githubHandler([])],
    [
      "only malformed items",
      githubHandler([{ full_name: "", html_url: "https://x", stargazers_count: 1 }]),
    ],
    [
      "negative stars",
      githubHandler([{ full_name: "a/b", html_url: "https://x", stargazers_count: -1 }]),
    ],
    [
      "non-numeric stars",
      githubHandler([{ full_name: "a/b", html_url: "https://x", stargazers_count: "12" }]),
    ],
    [
      "infinite stars",
      () =>
        rawResponse(
          '{"total_count":1,"incomplete_results":false,"items":[{"full_name":"a/b","html_url":"https://x","stargazers_count":1e999}]}',
        ),
    ],
    ["invalid JSON", () => rawResponse("not json")],
    ["persistent 5xx status", () => new Response("nope", { status: 500 })],
  ];

  test.each(failureCases)("treats %s as a GitHub source failure", async (_label, github) => {
    mockFetch(combinedHandler(okMelpa(), github));

    const results = await fetchPopularThemes();

    expect(melpaOk(results)).toBeDefined();
    expect(results.find((r) => r.source === "github")?.status).toBe("failed");
  });
});

describe("Fetch resilience", () => {
  test("retries transient 5xx responses and succeeds", async () => {
    let attempts = 0;
    const github: FetchHandler = (url) => {
      if (!url.includes("api.github.com")) throw new Error(`Unexpected URL: ${url}`);
      attempts++;
      if (attempts < 3) {
        return new Response("boom", { status: 503 });
      }
      return jsonResponse({
        total_count: 1,
        incomplete_results: false,
        items: defaultGitHubItems,
      });
    };

    mockFetch(combinedHandler(okMelpa(), github));

    const results = await fetchPopularThemes();
    expect(attempts).toBe(3);
    expect(results.find((r) => r.source === "github")?.status).toBe("ok");
  });

  test("retries transient network failures and succeeds", async () => {
    let attempts = 0;
    const github: FetchHandler = (url) => {
      if (!url.includes("api.github.com")) throw new Error(`Unexpected URL: ${url}`);
      attempts++;
      if (attempts < 3) {
        throw new TypeError("fetch failed");
      }
      return jsonResponse({
        total_count: 1,
        incomplete_results: false,
        items: defaultGitHubItems,
      });
    };

    mockFetch(combinedHandler(okMelpa(), github));

    const results = await fetchPopularThemes();
    expect(attempts).toBe(3);
    expect(results.find((r) => r.source === "github")?.status).toBe("ok");
  });

  test("gives up after bounded retries on persistent 5xx responses", async () => {
    let attempts = 0;
    const github: FetchHandler = (url) => {
      if (!url.includes("api.github.com")) throw new Error(`Unexpected URL: ${url}`);
      attempts++;
      return new Response("boom", { status: 502 });
    };

    mockFetch(combinedHandler(okMelpa(), github));

    const results = await fetchPopularThemes();
    expect(attempts).toBe(3);
    const error = githubFailed(results);
    expect(error).toContain("502");
  });

  test("does not retry non-retryable statuses", async () => {
    let attempts = 0;
    const github: FetchHandler = (url) => {
      if (!url.includes("api.github.com")) throw new Error(`Unexpected URL: ${url}`);
      attempts++;
      return new Response("bad request", { status: 400 });
    };

    mockFetch(combinedHandler(okMelpa(), github));

    const results = await fetchPopularThemes();
    expect(attempts).toBe(1);
    expect(results.find((r) => r.source === "github")?.status).toBe("failed");
  });

  test("rejects responses over the payload size limit", async () => {
    const hugeBody = "x".repeat(10 * 1024 * 1024 + 1);
    const github: FetchHandler = (url) => {
      if (!url.includes("api.github.com")) throw new Error(`Unexpected URL: ${url}`);
      return rawResponse(hugeBody);
    };

    mockFetch(combinedHandler(okMelpa(), github));

    const results = await fetchPopularThemes();
    expect(githubFailed(results)).toContain("byte limit");
  });

  test("includes a truncated body snippet for non-2xx responses without leaking the token", async () => {
    process.env.GITHUB_TOKEN = "ghp_super-secret-value";
    mockFetch(
      combinedHandler(okMelpa(), (url) => {
        if (!url.includes("api.github.com")) throw new Error(`Unexpected URL: ${url}`);
        return new Response(
          '{"message":"API rate limit exceeded","documentation_url":"https://docs.github.com"}',
          { status: 403 },
        );
      }),
    );

    const results = await fetchPopularThemes();
    const error = githubFailed(results);
    expect(error).toContain("403");
    expect(error).toContain("API rate limit exceeded");
    expect(error).not.toContain("ghp_super-secret-value");
  });
});

describe("Independent source behavior", () => {
  test("returns both sources when both succeed", async () => {
    mockFetch(combinedHandler(okMelpa(), githubHandler(defaultGitHubItems)));

    const results = await fetchPopularThemes();

    expect(melpaOk(results)).toEqual([{ name: "ok theme", downloads: 1, sourceUrl: undefined }]);
    expect(githubOk(results)).toEqual([
      {
        name: "owner/theme",
        stars: 10,
        sourceUrl: "https://github.com/owner/theme",
      },
    ]);
  });

  test("returns only melpa when GitHub fails", async () => {
    mockFetch(combinedHandler(okMelpa(), () => new Response("nope", { status: 500 })));

    const results = await fetchPopularThemes();

    expect(melpaOk(results)).toBeDefined();
    expect(results.find((r) => r.source === "github")?.status).toBe("failed");
  });

  test("returns only github when MELPA fails", async () => {
    mockFetch(
      combinedHandler(
        () => new Response("nope", { status: 500 }),
        githubHandler(defaultGitHubItems),
      ),
    );

    const results = await fetchPopularThemes();

    expect(results.find((r) => r.source === "melpa")?.status).toBe("failed");
    expect(githubOk(results)).toBeDefined();
  });

  test("reports both sources as failed when both fail", async () => {
    mockFetch(
      combinedHandler(
        () => new Response("nope", { status: 500 }),
        () => new Response("nope", { status: 500 }),
      ),
    );

    const results = await fetchPopularThemes();

    expect(results.map((r) => r.source)).toEqual(["melpa", "github"]);
    expect(results.every((r) => r.status === "failed")).toBe(true);
  });
});

describe("Popular themes logging", () => {
  test("exports the shared limit constant", () => {
    expect(POPULAR_THEMES_LIMIT).toBe(100);
  });

  test("writes success and error lines to the given log directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "popular-logs-"));
    try {
      await writePopularThemesLogs(
        [
          {
            source: "melpa",
            status: "ok",
            entries: [{ name: "a theme", downloads: 1 }],
          },
          {
            source: "github",
            status: "failed",
            error: "Request failed with status 403 for https://api.github.com/search/repositories",
          },
        ],
        dir,
      );

      const melpaLog = await Bun.file(join(dir, "melpa-main.log")).text();
      expect(melpaLog).toContain("Fetched 1 popular themes successfully");
      expect(melpaLog).not.toContain("undefined");

      const githubLog = await Bun.file(join(dir, "github-error.log")).text();
      expect(githubLog).toContain("403");
      expect(githubLog).toContain("api.github.com");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("writes warnings to the main log and never writes the token", async () => {
    const dir = await mkdtemp(join(tmpdir(), "popular-logs-"));
    try {
      process.env.GITHUB_TOKEN = "ghp_super-secret-value";
      await writePopularThemesLogs(
        [
          {
            source: "github",
            status: "ok",
            entries: [
              { name: "owner/theme", stars: 10, sourceUrl: "https://github.com/owner/theme" },
            ],
            warning: "GitHub search results are incomplete",
          },
        ],
        dir,
      );

      const githubLog = await Bun.file(join(dir, "github-main.log")).text();
      expect(githubLog).toContain("Fetched 1 popular GitHub repositories successfully");
      expect(githubLog).toContain("incomplete");
      expect(githubLog).not.toContain("ghp_super-secret-value");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
