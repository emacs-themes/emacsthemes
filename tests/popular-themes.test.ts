import { describe, expect, test } from "bun:test";
import {
  renderPopularThemeTables,
  resolvePopularPageCopy,
  renderPopularSourceNotice,
  getAvailablePopularSources,
  getMissingPopularSources,
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
    url: "https://github.com/hlissner/emacs-doom-themes",
  },
  { name: "zenburn", downloads: 42 },
];

const githubEntries: GitHubThemeEntry[] = [
  {
    name: "hlissner/emacs-doom-themes",
    stars: 9_876,
    url: "https://github.com/hlissner/emacs-doom-themes",
  },
  {
    name: "bbatsov/zenburn-emacs",
    stars: 3_210,
    url: "https://github.com/bbatsov/zenburn-emacs",
  },
];

const bothResults: PopularThemeSourceResult[] = [
  { source: "melpa", status: "ok", entries: melpaEntries },
  { source: "github", status: "ok", entries: githubEntries },
];

describe("renderPopularThemeTables", () => {
  test("renders exactly two tables in MELPA-then-GitHub order", () => {
    const html = renderPopularThemeTables(bothResults);

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
    const html = renderPopularThemeTables([
      { source: "melpa", status: "ok", entries: melpaEntries },
      { source: "github", status: "failed", error: "boom" },
    ]);

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
      renderPopularThemeTables([
        { source: "melpa", status: "failed", error: "a" },
        { source: "github", status: "failed", error: "b" },
      ]),
    ).toBe("");
  });

  test("ranks start at one and counts use deterministic thousands separators", () => {
    const html = renderPopularThemeTables(bothResults);

    // 2 header rows + 4 body rows.
    expect(html.match(/<tr>/g)).toHaveLength(6);
    expect(html).toContain('<th scope="row">1</th>');
    expect(html).toContain('<th scope="row">2</th>');
    expect(html).toContain("1,234,567");
    expect(html).toContain("9,876");
    expect(html).toContain(">3,210</td>");
    expect(html).toContain(">42</td>");
  });

  test("external links carry target/rel and a screen-reader new-tab notice", () => {
    const html = renderPopularThemeTables(bothResults);

    expect(html).toContain(
      '<a href="https://github.com/hlissner/emacs-doom-themes" target="_blank" rel="noopener noreferrer">doom one<span class="sr-only"> (opens in a new tab)</span></a>',
    );
    expect(html.match(/target="_blank"/g)).toHaveLength(3);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(3);
    expect(html.match(/\(opens in a new tab\)/g)).toHaveLength(3);
  });

  test("escapes names, normalizes URLs, and never links unsafe schemes", () => {
    const evilName = '<script>alert("xss")</script>';
    const evilUrl = 'https://example.com/?a="><img src=x onerror=alert(1)>';
    const html = renderPopularThemeTables([
      {
        source: "melpa",
        status: "ok",
        entries: [
          { name: evilName, downloads: 1, url: "javascript:alert(1)" },
          {
            name: "unsafe data url",
            downloads: 2,
            url: "data:text/html,<script>alert(1)</script>",
          },
          { name: "relative url", downloads: 3, url: "/relative/path" },
          { name: "attr break", downloads: 4, url: evilUrl },
          { name: "plain http", downloads: 5, url: "http://example.com/legacy" },
        ],
      },
    ]);

    // Escaped name rendered as plain text.
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:");
    expect(html).not.toContain('href="/relative');

    // Only the http(s) entries become links; hrefs are normalized and escaped.
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain(`href="${new URL(evilUrl).toString()}"`);
    expect(html).toContain('href="http://example.com/legacy"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
  });

  test("uses scoped column and row headers and accessible captions", () => {
    const html = renderPopularThemeTables(bothResults);

    // 2 tables x (3 col headers + 2 row headers).
    expect(html.match(/scope="col"/g)).toHaveLength(6);
    expect(html.match(/scope="row"/g)).toHaveLength(4);
    expect(html.match(/<caption class="sr-only">/g)).toHaveLength(2);
    expect(html).toContain(
      '<caption class="sr-only">MELPA themes ranked by total download count</caption>',
    );
    expect(html).toContain(
      '<caption class="sr-only">GitHub theme repositories ranked by star count</caption>',
    );
  });

  test("makes the scroll container keyboard-focusable with a region label", () => {
    const html = renderPopularThemeTables(bothResults);

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
    const html = renderPopularThemeTables(bothResults);

    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
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
      .replace(
        '<p class="subhead">{{POPULAR_THEMES_SUBHEAD}}</p>',
        () => (copy.subhead ? `<p class="subhead">${copy.subhead}</p>` : ""),
      )
      .replace("{{POPULAR_THEMES_NOTICE}}", () => renderPopularSourceNotice([]))
      .replace("{{POPULAR_THEMES_TABLES}}", () => renderPopularThemeTables(bothResults))
      .replace("{{GENERATED_DATE}}", () => "October 1, 2025");

    expect(rendered).not.toContain("{{");
    expect(rendered).not.toContain("}}");
    expect(rendered.match(/<table/g)).toHaveLength(2);
  });
});
