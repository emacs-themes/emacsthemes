import { describe, expect, test } from "bun:test";
import {
  renderPopularThemeTables,
  resolvePopularPageCopy,
  renderPopularSourceNotice,
  getAvailablePopularSources,
  getMissingPopularSources,
  toPopularThemeRecipes,
} from "../src/templates/core/popular-themes";
import type {
  GitHubThemeEntry,
  MelpaThemeEntry,
  PopularThemeSourceResult,
} from "../src/core/popular-types";

const melpaEntries: MelpaThemeEntry[] = [
  {
    name: "doom one",
    downloads: 1_234_567,
    sourceUrl: "https://github.com/doomemacs/themes",
  },
  { name: "zenburn", downloads: 42 },
];

const githubEntries: GitHubThemeEntry[] = [
  {
    name: "hlissner/emacs-doom-themes",
    stars: 9_876,
    sourceUrl: "https://github.com/hlissner/emacs-doom-themes",
  },
  {
    name: "bbatsov/zenburn-emacs",
    stars: 3_210,
    sourceUrl: "https://github.com/bbatsov/zenburn-emacs",
  },
];

/** Recipe fixtures mirroring real recipes that the popular entries resolve against. */
const recipeFixtures = [
  { id: "doom-one", name: "Doom One Theme", repoUrl: "https://github.com/doomemacs/themes" },
  { id: "zenburn", name: "Zenburn", repoUrl: "https://github.com/bbatsov/zenburn-emacs" },
  { id: "doom-themes", name: "Doom Themes", repoUrl: "https://github.com/doomemacs/themes" },
];

const bothResults: PopularThemeSourceResult[] = [
  { source: "melpa", status: "ok", entries: melpaEntries },
  { source: "github", status: "ok", entries: githubEntries },
];

describe("renderPopularThemeTables", () => {
  test("renders exactly two tables in MELPA-then-GitHub order", () => {
    const html = renderPopularThemeTables(bothResults, recipeFixtures);

    expect(html.match(/<table/g)).toHaveLength(2);

    const melpaSection = html.indexOf('id="popular-melpa"');
    const githubSection = html.indexOf('id="popular-github"');
    expect(melpaSection).toBeGreaterThan(-1);
    expect(githubSection).toBeGreaterThan(-1);
    expect(melpaSection).toBeLessThan(githubSection);

    const firstTable = html.indexOf("<table");
    expect(firstTable).toBeGreaterThan(melpaSection);
    expect(firstTable).toBeLessThan(githubSection);
  });

  test("renders only the successful sources", () => {
    const html = renderPopularThemeTables(
      [
        { source: "melpa", status: "ok", entries: melpaEntries },
        { source: "github", status: "failed", error: "boom" },
      ],
      recipeFixtures,
    );

    expect(html.match(/<table/g)).toHaveLength(1);
    expect(html).toContain(">MELPA</h3>");
    expect(html).not.toContain(">GitHub</h3>");
    expect(html).toContain(">Theme Name</th>");
    expect(html).toContain(">Downloads</th>");
    expect(html).not.toContain("Repository Name");
    expect(html).not.toContain("boom");
  });

  test("renders an empty string when no source succeeded", () => {
    expect(
      renderPopularThemeTables(
        [
          { source: "melpa", status: "failed", error: "a" },
          { source: "github", status: "failed", error: "b" },
        ],
        recipeFixtures,
      ),
    ).toBe("");
  });

  test("ranks start at one and counts use deterministic thousands separators", () => {
    const html = renderPopularThemeTables(bothResults, recipeFixtures);

    // 2 header rows + 4 body rows.
    expect(html.match(/<tr>/g)).toHaveLength(6);
    expect(html).toContain('<th scope="row">1</th>');
    expect(html).toContain('<th scope="row">2</th>');
    expect(html).toContain("1,234,567");
    expect(html).toContain("9,876");
    expect(html).toContain(">3,210</td>");
    expect(html).toContain(">42</td>");
  });

  test("source links carry target/rel and an accessible new-tab label", () => {
    const html = renderPopularThemeTables(bothResults, recipeFixtures);

    // All three entries with a source URL become icon links; melpa zenburn
    // has no source URL and must not.
    expect(html.match(/target="_blank"/g)).toHaveLength(3);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(3);
    expect(html.match(/class="source-link"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="View source code for doom one (opens in a new tab)"');
    expect(html).toContain("Source code unavailable for zenburn");
  });

  test("escapes names and source URLs and never links unsafe schemes", () => {
    const evilName = '<script>alert("xss")</script>';
    const evilUrl = 'https://example.com/?a="><img src=x onerror=alert(1)>';
    const html = renderPopularThemeTables(
      [
        {
          source: "melpa",
          status: "ok",
          entries: [
            { name: evilName, downloads: 1, sourceUrl: "javascript:alert(1)" },
            {
              name: "unsafe data url",
              downloads: 2,
              sourceUrl: "data:text/html,<script>alert(1)</script>",
            },
            { name: "relative url", downloads: 3, sourceUrl: "/relative/path" },
            { name: "attr break", downloads: 4, sourceUrl: evilUrl },
            { name: "plain http", downloads: 5, sourceUrl: "http://example.com/legacy" },
          ],
        },
      ],
      [],
    );

    // Escaped name rendered as plain text.
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:");
    expect(html).not.toContain('href="/relative');

    // Only the http(s) entries become source links; hrefs are normalized and escaped.
    expect(html.match(/class="source-link"/g)).toHaveLength(2);
    expect(html).toContain(`href="${new URL(evilUrl).toString()}"`);
    expect(html).toContain('href="http://example.com/legacy"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
  });

  test("uses scoped column and row headers and accessible captions", () => {
    const html = renderPopularThemeTables(bothResults, recipeFixtures);

    // 2 tables x (4 col headers + 2 row headers).
    expect(html.match(/scope="col"/g)).toHaveLength(8);
    expect(html.match(/scope="row"/g)).toHaveLength(4);
    expect(html.match(/<caption class="sr-only">/g)).toHaveLength(2);
    expect(html).toContain(
      '<caption class="sr-only">MELPA themes ranked by total download count</caption>',
    );
    expect(html).toContain(
      '<caption class="sr-only">GitHub theme repositories ranked by star count</caption>',
    );
  });

  test("each table has four scoped column headers with a visible Source header", () => {
    const html = renderPopularThemeTables(bothResults, recipeFixtures);

    expect(html.match(/<th scope="col" class="source-cell">Source<\/th>/g)).toHaveLength(2);
    expect(html).toContain('<th scope="col">Rank</th>');
    expect(html).toContain('<th scope="col">Theme Name</th>');
    expect(html).toContain('<th scope="col">Repository Name</th>');
  });

  test("makes the scroll container keyboard-focusable with a region label", () => {
    const html = renderPopularThemeTables(bothResults, recipeFixtures);

    expect(html.match(/tabindex="0"/g)).toHaveLength(2);
    expect(html.match(/role="region"/g)).toHaveLength(2);
    expect(html).toContain(
      '<div class="popular-list" tabindex="0" role="region" aria-label="MELPA themes ranked by total download count">',
    );
    expect(html).toContain(
      '<div class="popular-list" tabindex="0" role="region" aria-label="GitHub theme repositories ranked by star count">',
    );
  });

  test("never emits undefined, null, or unresolved template placeholders", () => {
    const html = renderPopularThemeTables(bothResults, recipeFixtures);

    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
  });
});

describe("internal name destinations", () => {
  test("a unique normalized name match links to its detail page even when its repository covers multiple recipes", () => {
    const recipes = [
      { id: "doom-one", name: "Doom One Theme", repoUrl: "https://github.com/doomemacs/themes" },
      { id: "doom-themes", name: "Doom Themes", repoUrl: "https://github.com/doomemacs/themes" },
    ];
    const html = renderPopularThemeTables(
      [
        {
          source: "melpa",
          status: "ok",
          entries: [
            { name: "doom one", downloads: 1, sourceUrl: "https://github.com/doomemacs/themes" },
          ],
        },
      ],
      recipes,
    );

    expect(html).toContain('<a href="/themes/doom-one">doom one</a>');
  });

  test("links the GitHub Bespoke Themes entry to both variants", async () => {
    const recipes = (await Promise.all(
      ["bespoke", "bespoke-dark"].map((id) =>
        Bun.file(new URL(`../recipes/${id}.json`, import.meta.url)).json(),
      ),
    )) as Array<{ id: string; name: string; repoUrl: string }>;
    const html = renderPopularThemeTables(
      [
        {
          source: "github",
          status: "ok",
          entries: [
            {
              name: "mclear-tools/bespoke-themes",
              stars: 1,
              sourceUrl: "https://github.com/mclear-tools/bespoke-themes",
            },
          ],
        },
      ],
      recipes,
    );

    expect(html).toContain(
      '<a href="/themes/index.html?repo=https%3A%2F%2Fgithub.com%2Fmclear-tools%2Fbespoke-themes">mclear-tools/bespoke-themes</a>',
    );
    expect(html).toContain(
      'class="source-link" href="https://github.com/mclear-tools/bespoke-themes"',
    );
  });

  test("links the GitHub Nord entry to its detail page", async () => {
    const recipe = (await Bun.file(new URL("../recipes/nord.json", import.meta.url)).json()) as {
      id: string;
      name: string;
      repoUrl: string;
    };
    const html = renderPopularThemeTables(
      [
        {
          source: "github",
          status: "ok",
          entries: [
            {
              name: "nordtheme/emacs",
              stars: 1,
              sourceUrl: "https://github.com/nordtheme/emacs",
            },
          ],
        },
      ],
      [recipe],
    );

    expect(html).toContain('<a href="/themes/nord">nordtheme/emacs</a>');
    expect(html).toContain('class="source-link" href="https://github.com/nordtheme/emacs"');
  });

  test("links the MELPA Phoenix Dark Pink entry to the canonical dark-pink recipe", async () => {
    const darkPinkRecipe = (await Bun.file(
      new URL("../recipes/dark-pink.json", import.meta.url),
    ).json()) as { id: string; name: string; repoUrl: string };
    const html = renderPopularThemeTables(
      [
        {
          source: "melpa",
          status: "ok",
          entries: [
            {
              name: "phoenix dark pink theme",
              downloads: 1,
              sourceUrl: "https://git.sr.ht/~mhcat/emacs-phoenix-dark-pink-theme",
            },
          ],
        },
      ],
      [darkPinkRecipe],
    );

    expect(html).toContain('<a href="/themes/dark-pink">phoenix dark pink theme</a>');
    expect(html).not.toContain('href="/themes/phoenix-dark-pink"');
  });

  test("links the MELPA Color Theme Solarized entry to its detail page and source", async () => {
    const recipe = (await Bun.file(
      new URL("../recipes/color-theme-solarized.json", import.meta.url),
    ).json()) as { id: string; name: string; repoUrl: string };
    const html = renderPopularThemeTables(
      [
        {
          source: "melpa",
          status: "ok",
          entries: [
            {
              name: "color theme solarized",
              downloads: 1,
              sourceUrl: "https://github.com/sellout/emacs-color-theme-solarized",
            },
          ],
        },
      ],
      [recipe],
    );

    expect(html).toContain('<a href="/themes/color-theme-solarized">color theme solarized</a>');
    expect(html).toContain(
      'class="source-link" href="https://github.com/sellout/emacs-color-theme-solarized"',
    );
  });

  test("links the MELPA Omtose Phellack Theme entry to all themes from its repository", async () => {
    const [omtoseRecipe, softerRecipe] = (await Promise.all([
      Bun.file(new URL("../recipes/omtose-phellack-theme.json", import.meta.url)).json(),
      Bun.file(new URL("../recipes/omtose-softer.json", import.meta.url)).json(),
    ])) as Array<{ id: string; name: string; repoUrl: string }>;
    const html = renderPopularThemeTables(
      [
        {
          source: "melpa",
          status: "ok",
          entries: [
            {
              name: "omtose phellack theme",
              downloads: 1,
              sourceUrl: "https://github.com/franksn/omtose-phellack-theme",
            },
          ],
        },
      ],
      [omtoseRecipe, softerRecipe],
    );

    expect(html).toContain(
      '<a href="/themes/index.html?repo=https%3A%2F%2Fgithub.com%2Ffranksn%2Fomtose-phellack-theme">omtose phellack theme</a>',
    );
    expect(html).not.toContain('href="/themes/omtose-phellack-theme"');
    expect(html).toContain(
      'class="source-link" href="https://github.com/franksn/omtose-phellack-theme"',
    );
  });

  test("links the MELPA Majapahit and Farmhouse entries to their repository themes and sources", async () => {
    const recipes = (await Promise.all(
      ["majapahit-dark", "majapahit-light", "farmhouse-dark", "farmhouse-light"].map((id) =>
        Bun.file(new URL(`../recipes/${id}.json`, import.meta.url)).json(),
      ),
    )) as Array<{ id: string; name: string; repoUrl: string }>;
    const majapahitSourceUrl = recipes[0].repoUrl;
    const farmhouseSourceUrl = recipes[2].repoUrl;
    const html = renderPopularThemeTables(
      [
        {
          source: "melpa",
          status: "ok",
          entries: [
            { name: "majapahit theme", downloads: 2, sourceUrl: majapahitSourceUrl },
            { name: "farmhouse theme", downloads: 1, sourceUrl: farmhouseSourceUrl },
          ],
        },
      ],
      recipes,
    );

    expect(html).toContain(
      '<a href="/themes/index.html?repo=https%3A%2F%2Fgitlab.com%2Ffranksn%2Fmajapahit-theme%2F-%2Ftree%2Fmaster">majapahit theme</a>',
    );
    expect(html).toContain(
      '<a href="/themes/index.html?repo=https%3A%2F%2Fgithub.com%2Fmattly%2Femacs-farmhouse-theme">farmhouse theme</a>',
    );
    expect(html).toContain(`class="source-link" href="${majapahitSourceUrl}"`);
    expect(html).toContain(`class="source-link" href="${farmhouseSourceUrl}"`);
  });

  test("links the MELPA Eziam entry to its repository themes and source", async () => {
    const recipes = (await Promise.all(
      ["eziam-dark", "eziam-dusk", "eziam-light"].map((id) =>
        Bun.file(new URL(`../recipes/${id}.json`, import.meta.url)).json(),
      ),
    )) as Array<{ id: string; name: string; repoUrl: string }>;
    const sourceUrl = recipes[0].repoUrl;
    const html = renderPopularThemeTables(
      [
        {
          source: "melpa",
          status: "ok",
          entries: [{ name: "eziam theme", downloads: 1, sourceUrl }],
        },
      ],
      recipes,
    );

    expect(html).toContain(
      '<a href="/themes/index.html?repo=https%3A%2F%2Fgithub.com%2Fthblt%2Feziam-theme-emacs">eziam theme</a>',
    );
    expect(html).toContain(`class="source-link" href="${sourceUrl}"`);
  });

  test("an ambiguous name match falls through to repository matching instead of picking the first recipe", () => {
    const recipes = [
      { id: "zen", name: "Zenburn", repoUrl: "https://github.com/owner/zenburn" },
      { id: "zenburn", name: "Zenburn Light", repoUrl: "https://github.com/owner/zenburn-light" },
    ];
    const html = renderPopularThemeTables(
      [
        {
          source: "melpa",
          status: "ok",
          entries: [
            { name: "zenburn", downloads: 1, sourceUrl: "https://github.com/owner/zenburn-light" },
          ],
        },
      ],
      recipes,
    );

    // "zenburn" matches recipe `zen` by name and recipe `zenburn` by id:
    // ambiguity must not select either; the unique repository match wins.
    expect(html).toContain('<a href="/themes/zenburn">zenburn</a>');
    expect(html).not.toContain('href="/themes/zen"');
  });

  test("a unique repository match links to its detail page when the name does not match", () => {
    const recipes = [
      { id: "zenburn", name: "Zenburn", repoUrl: "https://github.com/bbatsov/zenburn-emacs" },
    ];
    const html = renderPopularThemeTables(
      [
        {
          source: "melpa",
          status: "ok",
          entries: [
            {
              name: "some display label",
              downloads: 1,
              sourceUrl: "https://github.com/bbatsov/zenburn-emacs",
            },
          ],
        },
      ],
      recipes,
    );

    expect(html).toContain('<a href="/themes/zenburn">some display label</a>');
  });

  test("multiple repository matches link to the encoded exact repo filter", () => {
    const recipes = [
      { id: "doom-one", name: "Doom One Theme", repoUrl: "https://github.com/doomemacs/themes" },
      { id: "doom-themes", name: "Doom Themes", repoUrl: "https://github.com/doomemacs/themes" },
    ];
    const html = renderPopularThemeTables(
      [
        {
          source: "github",
          status: "ok",
          entries: [
            {
              name: "doomemacs/themes",
              stars: 5,
              sourceUrl: "https://github.com/doomemacs/themes",
            },
          ],
        },
      ],
      recipes,
    );

    expect(html).toContain(
      '<a href="/themes/index.html?repo=https%3A%2F%2Fgithub.com%2Fdoomemacs%2Fthemes">doomemacs/themes</a>',
    );
  });

  test("a unique id match wins over an ambiguous name collision without any repository match", () => {
    const recipes = [
      { id: "zenburn", name: "Zenburn Original", repoUrl: "https://github.com/owner/zenburn" },
      { id: "zen-light", name: "Zenburn", repoUrl: "https://github.com/owner/zen-light" },
    ];
    const html = renderPopularThemeTables(
      [
        {
          source: "melpa",
          status: "ok",
          entries: [{ name: "zenburn", downloads: 1 }],
        },
      ],
      recipes,
    );

    // "zenburn" is ambiguous by name (recipe `zen-light` is literally named
    // Zenburn) but unique as a recipe id — the id match must win instead of
    // being discarded into the ambiguous name bucket.
    expect(html).toContain('<a href="/themes/zenburn">zenburn</a>');
    expect(html).not.toContain('href="/themes/zen-light"');
  });

  test("skips malformed recipes with a warning instead of crashing the build", () => {
    const warn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      const html = renderPopularThemeTables(
        [
          {
            source: "melpa",
            status: "ok",
            entries: [
              { name: "doom one", downloads: 1, sourceUrl: "https://github.com/doomemacs/themes" },
              { name: "broken entry", downloads: 2, sourceUrl: "https://github.com/owner/zenburn" },
            ],
          },
        ],
        [
          {
            id: "doom-one",
            name: "Doom One Theme",
            repoUrl: "https://github.com/doomemacs/themes",
          },
          { name: "Zenburn" } as never,
          null as never,
        ],
      );

      // The valid recipe still resolves; malformed ones are skipped.
      expect(html).toContain('<a href="/themes/doom-one">doom one</a>');
      expect(html).not.toContain('href="/themes/zenburn"');
      expect(html).not.toContain("undefined");
      expect(
        warnings.some((w) => w.some((m) => typeof m === "string" && m.includes("malformed"))),
      ).toBe(true);
    } finally {
      console.warn = warn;
    }
  });

  test("no name or repository match leaves the name as plain text", () => {
    const html = renderPopularThemeTables(
      [
        {
          source: "melpa",
          status: "ok",
          entries: [
            { name: "no match here", downloads: 1, sourceUrl: "https://github.com/unrelated/repo" },
          ],
        },
      ],
      recipeFixtures,
    );

    expect(html).toContain("<td>no match here</td>");
    expect(html).not.toContain('href="/themes/');
  });

  test("internal name links have no new-tab attributes or announcements", () => {
    const html = renderPopularThemeTables(bothResults, recipeFixtures);

    // doom one, melpa zenburn, and bbatsov/zenburn-emacs resolve internally.
    expect(html.match(/<a href="\/themes\//g)).toHaveLength(3);
    expect(html).toContain('<a href="/themes/doom-one">doom one</a>');
    expect(html).not.toContain('<a href="/themes/doom-one" target=');
    expect(html).not.toContain('doom one<span class="sr-only">');
  });
});

describe("source cells", () => {
  test("safe source links appear only in the Source column with icon and security attributes", () => {
    const html = renderPopularThemeTables(bothResults, recipeFixtures);

    expect(html.match(/<td class="source-cell">/g)).toHaveLength(4);
    expect(html.match(/class="source-link"/g)).toHaveLength(3);
    expect(html.match(/class="source-icon"/g)).toHaveLength(3);
    expect(html.match(/aria-hidden="true" focusable="false"/g)).toHaveLength(3);
    expect(html.match(/focusable="false"/g)).toHaveLength(3);
    expect(html).toContain(
      '<td class="source-cell"><a class="source-link" href="https://github.com/doomemacs/themes" target="_blank" rel="noopener noreferrer" title="View source code for doom one" aria-label="View source code for doom one (opens in a new tab)"><svg class="source-icon"',
    );
  });

  test("source links carry a visible-hover title naming the theme", () => {
    const html = renderPopularThemeTables(bothResults, recipeFixtures);

    expect(html.match(/title="View source code for [^"]+"/g)).toHaveLength(3);
    expect(html).toContain('title="View source code for doom one"');
    expect(html).toContain('title="View source code for hlissner/emacs-doom-themes"');
  });

  test("missing or unsafe source URLs render no anchor and an accessible unavailable state", () => {
    const html = renderPopularThemeTables(
      [
        {
          source: "melpa",
          status: "ok",
          entries: [
            { name: "no url", downloads: 1 },
            { name: "bad scheme", downloads: 2, sourceUrl: "javascript:alert(1)" },
            { name: "relative", downloads: 3, sourceUrl: "/relative/path" },
          ],
        },
      ],
      [],
    );

    expect(html.match(/<a /g)).toBeNull();
    expect(html.match(/class="source-unavailable"/g)).toHaveLength(3);
    expect(html).toContain(
      '<span class="source-unavailable"><span aria-hidden="true">—</span><span class="sr-only">Source code unavailable for no url</span></span>',
    );
  });

  test("malicious names and source URLs remain escaped or rejected", () => {
    const evilName = "<img src=x onerror=alert(1)>";
    const evilUrl = 'https://example.com/?" onmouseover="alert(1)';
    const html = renderPopularThemeTables(
      [
        {
          source: "github",
          status: "ok",
          entries: [{ name: evilName, stars: 1, sourceUrl: evilUrl }],
        },
      ],
      [],
    );

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    // The hostile URL is normalized by toSafeUrl and escaped for the attribute.
    expect(html).toContain(`href="${new URL(evilUrl).toString()}"`);
    expect(html).not.toContain('" onmouseover="');
    // The aria-label uses the escaped name.
    expect(html).toContain(
      'aria-label="View source code for &lt;img src=x onerror=alert(1)&gt; (opens in a new tab)"',
    );
  });
});

describe("toPopularThemeRecipes", () => {
  test("narrows full theme records to id, name, and repoUrl", () => {
    const themes = [
      {
        id: "doom-one",
        name: "Doom One Theme",
        description: "desc",
        repoUrl: "https://github.com/doomemacs/themes",
        rawUrls: [],
        type: "dark",
        tags: ["one"],
      },
    ];
    const recipes = toPopularThemeRecipes(themes);

    expect(recipes).toEqual([
      { id: "doom-one", name: "Doom One Theme", repoUrl: "https://github.com/doomemacs/themes" },
    ]);
  });

  test("passes repoUrl through raw so lookups normalize it themselves", () => {
    const recipes = toPopularThemeRecipes([
      { id: "x", name: "X", repoUrl: "local" },
      { id: "y", name: "Y", repoUrl: "https://GitHub.com/Owner/Repo.git" },
    ]);

    expect(recipes[0].repoUrl).toBe("local");
    expect(recipes[1].repoUrl).toBe("https://GitHub.com/Owner/Repo.git");
  });
});

describe("Popular page copy resolution", () => {
  test("advertises both sources when both are available", () => {
    expect(resolvePopularPageCopy(["melpa", "github"])).toEqual({
      title: "Popular Emacs Themes - MELPA and GitHub Rankings",
      description:
        "Discover the most downloaded Emacs themes from MELPA and the most starred Emacs theme repositories on GitHub.",
      ogTitle: "Popular Emacs Themes",
      ogDescription: "MELPA download statistics and GitHub stars for popular Emacs themes.",
    });
  });

  test("advertises only MELPA when GitHub is unavailable", () => {
    expect(resolvePopularPageCopy(["melpa"])).toEqual({
      title: "Popular Emacs Themes - MELPA Rankings",
      description: "Discover the most downloaded Emacs themes from MELPA.",
      ogTitle: "Popular Emacs Themes",
      ogDescription: "MELPA download statistics for popular Emacs themes.",
      subhead: "The most popular Emacs themes, ranked by MELPA download counts.",
    });
  });

  test("advertises only GitHub when MELPA is unavailable", () => {
    expect(resolvePopularPageCopy(["github"])).toEqual({
      title: "Popular Emacs Themes - GitHub Rankings",
      description: "Discover the most starred Emacs theme repositories on GitHub.",
      ogTitle: "Popular Emacs Themes",
      ogDescription: "GitHub stars for popular Emacs themes.",
      subhead: "The most popular Emacs themes, ranked by GitHub stars.",
    });
  });

  test("falls back to the full copy for an empty availability set", () => {
    expect(resolvePopularPageCopy([])).toEqual(resolvePopularPageCopy(["melpa", "github"]));
  });

  test("derives available and missing sources from results", () => {
    const results: PopularThemeSourceResult[] = [
      { source: "melpa", status: "ok", entries: melpaEntries },
      { source: "github", status: "failed", error: "boom" },
    ];
    expect(getAvailablePopularSources(results)).toEqual(["melpa"]);
    expect(getMissingPopularSources(results)).toEqual(["github"]);
  });

  test("renders no notice when every source is available", () => {
    expect(renderPopularSourceNotice([])).toBe("");
  });

  test("renders a notice naming each missing source", () => {
    expect(renderPopularSourceNotice(["melpa"])).toBe(
      '<p class="popular-notice">MELPA rankings are temporarily unavailable.</p>',
    );
    expect(renderPopularSourceNotice(["github"])).toBe(
      '<p class="popular-notice">GitHub rankings are temporarily unavailable.</p>',
    );
    expect(renderPopularSourceNotice(["melpa", "github"])).toBe(
      '<p class="popular-notice">MELPA and GitHub rankings are temporarily unavailable.</p>',
    );
  });
});

describe("popular content partial", () => {
  const partialPath = "src/templates/html/partials/popular-content.html";

  test("keeps one insertion point per placeholder wrapped in the popular-sources container", async () => {
    const partial = await Bun.file(partialPath).text();

    expect(partial.match(/\{\{POPULAR_THEMES_TABLES\}\}/g)).toHaveLength(1);
    expect(partial.match(/\{\{POPULAR_THEMES_SUBHEAD\}\}/g)).toHaveLength(1);
    expect(partial.match(/\{\{POPULAR_THEMES_NOTICE\}\}/g)).toHaveLength(1);
    expect(partial.match(/\{\{GENERATED_DATE\}\}/g)).toHaveLength(1);
    const container = partial.match(/<div class="popular-sources">([\s\S]*?)<\/div>/);
    expect(container).not.toBeNull();
    expect(container![1]).toContain("{{POPULAR_THEMES_TABLES}}");
    expect(container![1]).not.toContain("<table");
  });

  test("makes no static claim about which sources are ranked", async () => {
    const partial = await Bun.file(partialPath).text();

    expect(partial).not.toContain("ranked by MELPA download counts and GitHub stars");
    expect(partial).not.toContain("MELPA and GitHub");
  });

  test("contains no legacy table markup or placeholders", async () => {
    const partial = await Bun.file(partialPath).text();

    expect(partial).not.toContain("{{THEMES_LIST}}");
    expect(partial).not.toContain("<table");
    expect(partial).not.toContain("themes-table");
  });

  test("renders the page content with no remaining placeholders", async () => {
    const partial = await Bun.file(partialPath).text();
    const copy = resolvePopularPageCopy(["melpa"]);
    const rendered = partial
      .replace('<p class="subhead">{{POPULAR_THEMES_SUBHEAD}}</p>', () =>
        copy.subhead ? `<p class="subhead">${copy.subhead}</p>` : "",
      )
      .replace("{{POPULAR_THEMES_NOTICE}}", () => renderPopularSourceNotice([]))
      .replace("{{POPULAR_THEMES_TABLES}}", () =>
        renderPopularThemeTables(bothResults, recipeFixtures),
      )
      .replace("{{GENERATED_DATE}}", () => "October 1, 2025");

    expect(rendered).not.toContain("{{");
    expect(rendered).not.toContain("}}");
    expect(rendered.match(/<table/g)).toHaveLength(2);
  });
});
