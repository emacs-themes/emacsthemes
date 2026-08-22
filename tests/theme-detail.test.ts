import { describe, expect, test } from "bun:test";
import {
  renderThemeSourceLinks,
  renderThemeSourceLinksSafely,
} from "../src/templates/core/theme-source-links";

type ThemeSourceFixture = {
  id: string;
  repoUrl: string;
  rawUrls: string[];
};

function localTheme(overrides: Partial<ThemeSourceFixture> = {}): ThemeSourceFixture {
  return {
    id: "phoenix-dark-pink",
    repoUrl: "local",
    rawUrls: ["static/themes/phoenix-dark-pink/phoenix-dark-pink-theme.el"],
    ...overrides,
  };
}

describe("theme source links", () => {
  test("renders one new-tab local source link for a single-file theme", () => {
    const html = renderThemeSourceLinks(localTheme());

    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain(
      '<a class="button" href="/static/themes/phoenix-dark-pink/phoenix-dark-pink-theme.el" target="_blank" rel="noopener noreferrer"',
    );
    expect(html).toContain("View Local Source: phoenix-dark-pink-theme.el");
    expect(html).toContain(
      'aria-label="View local source file phoenix-dark-pink-theme.el (opens in a new tab)"',
    );
    expect(html).not.toContain('href="local"');
    expect(html).not.toContain("View Source on GitHub");
  });

  test("renders every local source file in recipe order", () => {
    const html = renderThemeSourceLinks(
      localTheme({
        id: "brutalist",
        rawUrls: [
          "static/themes/brutalist/brutalist-build.el",
          "static/themes/brutalist/brutalist-theme.el",
        ],
      }),
    );

    expect(html.match(/<a /g)).toHaveLength(2);
    const helperIndex = html.indexOf("brutalist-build.el");
    const themeIndex = html.indexOf("brutalist-theme.el");
    expect(helperIndex).toBeGreaterThanOrEqual(0);
    expect(themeIndex).toBeGreaterThan(helperIndex);
    expect(html).toContain("View Local Source: brutalist-build.el");
    expect(html).toContain("View Local Source: brutalist-theme.el");
  });

  test("encodes local URL path segments and escapes filenames", () => {
    const html = renderThemeSourceLinks(
      localTheme({
        id: "safe-theme",
        rawUrls: ['static/themes/safe-theme/file name & "quoted".el'],
      }),
    );

    expect(html).toContain('href="/static/themes/safe-theme/file%20name%20%26%20%22quoted%22.el"');
    expect(html).toContain("View Local Source: file name &amp; &quot;quoted&quot;.el");
    expect(html).toContain(
      'aria-label="View local source file file name &amp; &quot;quoted&quot;.el (opens in a new tab)"',
    );
    expect(html).not.toContain('file name & "quoted".el');
  });

  test.each([
    "phoenix-dark-pink-theme.el",
    "static/themes/phoenix-dark-pink/../other/theme.el",
    "static/themes/phoenix-dark-pink/./theme.el",
    "static\\themes\\phoenix-dark-pink\\theme.el",
    "static/themes/phoenix-dark-pink//theme.el",
  ])("rejects unsafe local source path %s", (sourcePath) => {
    expect(() => renderThemeSourceLinks(localTheme({ rawUrls: [sourcePath] }))).toThrow(
      new RegExp(`phoenix-dark-pink.*${sourcePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
  });

  test("preserves one safe repository link for remote themes", () => {
    const html = renderThemeSourceLinks({
      id: "dark-pink",
      repoUrl: "https://github.com/j0ni/phoenix-dark-pink",
      rawUrls: [
        "https://raw.githubusercontent.com/j0ni/phoenix-dark-pink/refs/heads/master/phoenix-dark-pink-theme.el",
      ],
    });

    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain(
      '<a class="button" href="https://github.com/j0ni/phoenix-dark-pink" target="_blank" rel="noopener noreferrer"',
    );
    expect(html).toContain(">View Source on GitHub</a>");
    expect(html).not.toContain("phoenix-dark-pink-theme.el");
  });

  test.each([
    ["https://github.com/j0ni/phoenix-dark-pink", "View Source on GitHub"],
    ["https://gitlab.com/foo/bar", "View Source on GitLab"],
    ["https://codeberg.org/foo/bar", "View Source on Codeberg"],
    ["https://bitbucket.org/foo/bar", "View Source on Bitbucket"],
    ["https://hg.sr.ht/~slondr/enlightened", "View Source on SourceHut"],
    ["https://framagit.org/foo/bar", "View Source on Framagit"],
    ["https://gist.github.com/foo/bar", "View Source on GitHub Gist"],
    ["https://example.com/repo", "View Source on example.com"],
  ])("labels %s with its repository host", (repoUrl, expectedLabel) => {
    const html = renderThemeSourceLinks({ id: "host-theme", repoUrl, rawUrls: [] });

    expect(html).toContain(`>${expectedLabel}</a>`);
    expect(html).toContain(`href="${repoUrl}"`);
  });

  test("announces the new tab on the remote repository link", () => {
    const html = renderThemeSourceLinks({
      id: "remote-theme",
      repoUrl: "https://github.com/j0ni/phoenix-dark-pink",
      rawUrls: [],
    });

    expect(html).toContain('aria-label="View Source on GitHub (opens in a new tab)"');
  });

  test("renders no links for a local theme with empty rawUrls", () => {
    expect(renderThemeSourceLinks(localTheme({ rawUrls: [] }))).toBe("");
  });

  test("ignores rawUrls and existence checks for remote themes", () => {
    const html = renderThemeSourceLinks(
      {
        id: "remote-theme",
        repoUrl: "https://gitlab.com/foo/bar",
        rawUrls: ["static/themes/remote-theme/nope.el"],
      },
      () => false,
    );

    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain(">View Source on GitLab</a>");
  });

  test.each(["brutalist/brutalist-build.el", "brutalist/brutalist-theme.el"])(
    "omits the missing local source %s when an existence check is provided",
    (missingFile) => {
      const html = renderThemeSourceLinks(
        localTheme({
          id: "brutalist",
          rawUrls: [
            "static/themes/brutalist/brutalist-build.el",
            "static/themes/brutalist/brutalist-theme.el",
          ],
        }),
        (relativePath) => relativePath !== missingFile,
      );

      expect(html.match(/<a /g)).toHaveLength(1);
      expect(html).not.toContain(missingFile);
    },
  );

  test("renders no links when every local source file is missing", () => {
    const html = renderThemeSourceLinks(
      localTheme({
        id: "brutalist",
        rawUrls: ["static/themes/brutalist/brutalist-build.el"],
      }),
      () => false,
    );

    expect(html).toBe("");
  });
});

describe("renderThemeSourceLinksSafely", () => {
  test("reports invalid repository URLs instead of throwing", () => {
    const errors: string[] = [];
    const html = renderThemeSourceLinksSafely(
      {
        id: "unsafe-theme",
        repoUrl: "javascript:alert(1)",
        rawUrls: ["https://example.com/theme.el"],
      },
      undefined,
      (message) => errors.push(message),
    );

    expect(html).toBe("");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("unsafe-theme");
  });

  test("reports unsafe local paths instead of throwing", () => {
    const errors: string[] = [];
    const html = renderThemeSourceLinksSafely(
      localTheme({ rawUrls: ["static/themes/phoenix-dark-pink/../evil.el"] }),
      undefined,
      (message) => errors.push(message),
    );

    expect(html).toBe("");
    expect(errors).toHaveLength(1);
  });

  test("warns about missing local files and renders the present links", () => {
    const errors: string[] = [];
    const html = renderThemeSourceLinksSafely(
      localTheme({
        id: "brutalist",
        rawUrls: [
          "static/themes/brutalist/brutalist-build.el",
          "static/themes/brutalist/brutalist-theme.el",
        ],
      }),
      (relativePath) => relativePath === "brutalist/brutalist-theme.el",
      (message) => errors.push(message),
    );

    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain("brutalist-theme.el");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Missing local source file");
  });

  test("renders all links without an existence check and reports no errors", () => {
    const errors: string[] = [];
    const html = renderThemeSourceLinksSafely(localTheme(), undefined, (message) =>
      errors.push(message),
    );

    expect(html.match(/<a /g)).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test("rejects unsafe repository URLs", () => {
    expect(() =>
      renderThemeSourceLinks({
        id: "unsafe-theme",
        repoUrl: "javascript:alert(1)",
        rawUrls: ["https://example.com/theme.el"],
      }),
    ).toThrow(/repository URL.*unsafe-theme/);
  });

  test("escapes control characters in thrown error messages", () => {
    expect(() =>
      renderThemeSourceLinks(
        localTheme({ rawUrls: ["static\\themes\\phoenix-dark-pink\\evil\u0007.el"] }),
      ),
    ).toThrow(/\\x07/);
  });
});

describe("theme detail partial", () => {
  const partialPath = "src/templates/html/partials/theme-detail-content.html";

  test("uses one stable source-links replacement point", async () => {
    const partial = await Bun.file(partialPath).text();

    expect(partial.match(/{{THEME_SOURCE_LINKS}}/g)).toHaveLength(1);
    expect(partial).not.toContain("{{THEME_REPO_LINK}}");
    expect(partial).not.toContain("{{THEME_REPO_URL}}");
    expect(partial).toContain('class="source-links"');
    expect(partial).toContain('role="group"');
    expect(partial).toContain('aria-label="Theme source links"');
  });
});
