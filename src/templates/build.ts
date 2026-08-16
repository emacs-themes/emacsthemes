import { mkdir, readdir, copyFile, rm, readFile, symlink } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { minify, Options as MinifyOptions } from "html-minifier-terser";
import { transform } from "lightningcss";
import { fetchPopularThemes, writePopularThemesLogs, POPULAR_LOGS_DIR } from "./popular/fetcher";
import { assertPathWithinRoot } from "../core/path-utils";
import { escapeHtml } from "../core/html-utils";
import { DISPLAY_LOCALE } from "../core/constants";
import { getPinnedThemeIds } from "../core/pinned-themes.js";
import {
  readScreenshotDates,
  resolveThemeGeneratedDate,
  type ScreenshotDatesMap,
} from "../core/screenshot-dates";
import { applyBaseTemplate } from "./core/page-template";
import {
  renderPopularThemeTables,
  resolvePopularPageCopy,
  renderPopularSourceNotice,
  getAvailablePopularSources,
  getMissingPopularSources,
  toPopularThemeRecipes,
} from "./core/popular-themes";
import { buildThemeCardsGrid } from "./core/theme-card";
import type { PopularThemeSourceResult } from "../core/popular-types";

// Constants
const RECIPES_DIR = "recipes";
const BUILD_DIR = "build";
const TEMPLATES_DIR = "src/templates";
const STATIC_DIR = "static";
const CSS_DIR = join(TEMPLATES_DIR, "css");
const GITHUB_URL = "https://github.com/emacs-themes/emacsthemes";
const BASE_URL = "https://emacsthemes.com";
const TITLE_BRAND_SUFFIX = " - EmacsThemes";
const LOG_PREFIX = "[build]";
const INTER_FONT_PATH = "/static/fonts/inter/InterVariable.woff2";
const INTER_ITALIC_FONT_PATH = "/static/fonts/inter/InterVariable-Italic.woff2";
const BASE_TEMPLATE_OPTIONS = {
  baseUrl: BASE_URL,
  githubUrl: GITHUB_URL,
  titleBrandSuffix: TITLE_BRAND_SUFFIX,
};

function logInfo(message: string) {
  console.log(`${LOG_PREFIX} ${message}`);
}

function logWarn(message: string) {
  console.warn(`${LOG_PREFIX} ${message}`);
}

/**
 * Options for html-minifier-terser.
 */
const MINIFY_OPTIONS: MinifyOptions = {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: false,
  minifyJS: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
};

/**
 * Centralized configuration for file paths used in the build process.
 * Organized by category: templates, CSS, assets, and page output destinations.
 */
const PATHS = {
  templates: {
    base: join(TEMPLATES_DIR, "html/index.html"),
    partials: {
      searchBar: join(TEMPLATES_DIR, "html/partials/search-bar.html"),
      themeCard: join(TEMPLATES_DIR, "html/partials/theme-card.html"),
      themeDetail: join(TEMPLATES_DIR, "html/partials/theme-detail-content.html"),
      latestThemesHeadline: join(TEMPLATES_DIR, "html/partials/latest-themes-headline.html"),
      about: join(TEMPLATES_DIR, "html/partials/about-content.html"),
      popular: join(TEMPLATES_DIR, "html/partials/popular-content.html"),
      error404: join(TEMPLATES_DIR, "html/partials/404-content.html"),
      searchScript: join(TEMPLATES_DIR, "html/partials/search-script.js"),
      themeToggleScript: join(TEMPLATES_DIR, "html/partials/theme-toggle-script.js"),
      posthogScript: join(TEMPLATES_DIR, "html/partials/posthog-script.js"),
    },
  },
  css: {
    main: "static/css/style.css",
    search: "static/css/search.css",
    detail: "static/css/theme-detail.css",
    popular: "static/css/popular.css",
    card: "static/css/card.css",
    error: "static/css/error.css",
  },
  js: {
    themesSearch: "static/js/themes-search.js",
    themeToggle: "static/js/theme-toggle.js",
  },
  assets: {
    src: {
      images: join(STATIC_DIR, "imgs"),
      themes: join(STATIC_DIR, "themes"),
      fonts: join(STATIC_DIR, "fonts"),
      headers: join(STATIC_DIR, "_headers"),
      robots: join(STATIC_DIR, "robots.txt"),
      favicon: join(STATIC_DIR, "favicon.png"),
      emacsWebp: join(STATIC_DIR, "emacs.webp"),
    },
    dest: {
      images: join(BUILD_DIR, STATIC_DIR, "imgs"),
      themes: join(BUILD_DIR, STATIC_DIR, "themes"),
      fonts: join(BUILD_DIR, STATIC_DIR, "fonts"),
      headers: join(BUILD_DIR, "_headers"),
      robots: join(BUILD_DIR, "robots.txt"),
      css: join(BUILD_DIR, STATIC_DIR, "css"),
      js: join(BUILD_DIR, STATIC_DIR, "js"),
      data: join(BUILD_DIR, STATIC_DIR, "data"),
      favicon: join(BUILD_DIR, "favicon.png"),
      emacsWebp: join(BUILD_DIR, "emacs.webp"),
      themesIndex: join(BUILD_DIR, STATIC_DIR, "data", "themes-index.json"),
      themesSearchScript: join(BUILD_DIR, STATIC_DIR, "js", "themes-search.js"),
      themeToggleScript: join(BUILD_DIR, STATIC_DIR, "js", "theme-toggle.js"),
      posthogScript: join(BUILD_DIR, STATIC_DIR, "js", "posthog.js"),
    },
  },
  pages: {
    home: join(BUILD_DIR, "index.html"),
    themesIndex: join(BUILD_DIR, "themes/index.html"),
    themesDir: join(BUILD_DIR, "themes"),
    about: join(BUILD_DIR, "about.html"),
    popular: join(BUILD_DIR, "popular.html"),
    error404: join(BUILD_DIR, "404.html"),
  },
};

interface Theme {
  name: string;
  id: string;
  description: string;
  repoUrl: string;
  rawUrls: string[];
  type: string;
  tags: string[];
  elispBefore?: string;
  elispAfter?: string;
}

interface ThemeWithScreenshotGeneratedDate extends Theme {
  screenshotGeneratedDate: string | null;
}

interface SearchThemeIndexEntry {
  id: string;
  name: string;
  searchable: string;
  screenshotGeneratedDate: string | null;
}

// Data Fetching

/**
 * Retrieves homepage themes based on the explicit pinned theme order in configuration.
 *
 * @returns {Promise<Theme[]>} A promise that resolves to an array of pinned Theme objects.
 * @throws {Error} Throws when any pinned theme recipe does not exist.
 */
async function getPinnedThemes(): Promise<Theme[]> {
  const pinnedThemeIds = await getPinnedThemeIds();

  return await Promise.all(
    pinnedThemeIds.map(async (themeId) => {
      const recipePath = assertPathWithinRoot(RECIPES_DIR, `${themeId}.json`);

      try {
        return (await Bun.file(recipePath).json()) as Theme;
      } catch {
        throw new Error(
          `Pinned theme recipe "${themeId}.json" not found. "${recipePath}" does not exist!`,
        );
      }
    }),
  );
}

/**
 * Retrieves all available themes from the recipes directory.
 *
 * @returns {Promise<Theme[]>} A promise that resolves to an array of all Theme objects.
 */
async function getAllThemes(): Promise<Theme[]> {
  const files = await readdir(RECIPES_DIR);
  return await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (file) => {
        return await Bun.file(join(RECIPES_DIR, file)).json();
      }),
  );
}

// Template Helpers

/**
 * Minifies HTML content.
 *
 * @param {string} html - The HTML string to minify.
 * @returns {Promise<string>} The minified HTML string.
 */
async function minifyHtml(html: string): Promise<string> {
  return await minify(html, MINIFY_OPTIONS);
}

/**
 * Minifies CSS content with lightningcss.
 *
 * @param {string} css - The CSS string to minify.
 * @returns {Promise<string>} The minified CSS string.
 */
async function minifyCss(css: string): Promise<string> {
  const { code } = transform({
    filename: "styles.css",
    code: Buffer.from(css),
    minify: true,
  });
  return Buffer.from(code).toString("utf-8");
}

/**
 * Minifies JS content by wrapping it in a script tag and using html-minifier-terser.
 *
 * @param {string} js - The JS string to minify.
 * @returns {Promise<string>} The minified JS string.
 */
async function minifyJs(js: string): Promise<string> {
  const minified = await minify(`<script>${js}</script>`, { minifyJS: true });
  return minified.replace("<script>", "").replace("</script>", "");
}

/**
 * Adds persisted screenshot generation dates to theme records.
 *
 * @param {Theme[]} themes - Theme records loaded from recipes.
 * @param {ScreenshotDatesMap} screenshotDates - Persisted screenshot dates keyed by theme id.
 * @returns {ThemeWithScreenshotGeneratedDate[]} Theme records enriched with screenshot dates.
 */
function addScreenshotGeneratedDates(
  themes: Theme[],
  screenshotDates: ScreenshotDatesMap,
): ThemeWithScreenshotGeneratedDate[] {
  return themes.map((theme) => ({
    ...theme,
    screenshotGeneratedDate: screenshotDates[theme.id] ?? null,
  }));
}

/**
 * Builds a compact theme search index optimized for client-side filtering and sorting.
 *
 * @param {ThemeWithScreenshotGeneratedDate[]} themes - The collection of themes to index.
 * @returns {SearchThemeIndexEntry[]} A list of normalized searchable records keyed by theme id.
 */
function buildThemeSearchIndex(
  themes: ThemeWithScreenshotGeneratedDate[],
): SearchThemeIndexEntry[] {
  return themes.map((theme) => {
    const searchable = `${theme.name} ${theme.type} ${theme.tags.join(" ")}`.toLowerCase();
    return {
      id: theme.id,
      name: theme.name,
      searchable,
      screenshotGeneratedDate: theme.screenshotGeneratedDate,
    };
  });
}

/**
 * Writes the generated theme search index to a static JSON file.
 *
 * @param {SearchThemeIndexEntry[]} indexEntries - Search index entries for all themes.
 */
async function writeThemeSearchIndex(indexEntries: SearchThemeIndexEntry[]) {
  await mkdir(PATHS.assets.dest.data, { recursive: true });
  await Bun.write(PATHS.assets.dest.themesIndex, JSON.stringify(indexEntries));
}

/**
 * Writes the minified themes search client script to a static file.
 *
 * @param {string} scriptContent - Minified JavaScript for theme search behavior.
 */
async function writeThemesSearchScript(scriptContent: string) {
  await mkdir(PATHS.assets.dest.js, { recursive: true });
  await Bun.write(PATHS.assets.dest.themesSearchScript, scriptContent);
}

/**
 * Writes the minified theme-toggle client script to a static file.
 *
 * @param {string} scriptContent - Minified JavaScript for global theme toggle behavior.
 */
async function writeThemeToggleScript(scriptContent: string) {
  await mkdir(PATHS.assets.dest.js, { recursive: true });
  await Bun.write(PATHS.assets.dest.themeToggleScript, scriptContent);
}

async function writePosthogScript(scriptContent: string) {
  await mkdir(PATHS.assets.dest.js, { recursive: true });
  await Bun.write(PATHS.assets.dest.posthogScript, scriptContent);
}

/**
 * Builds a deferred script tag for generated JavaScript assets.
 *
 * @param {string} src - Public path to the script file.
 * @returns {string} Script tag HTML with deferred loading.
 */
function buildDeferredScriptTag(src: string): string {
  return `<script src="${src}" defer></script>`;
}

/**
 * Builds the common script tags injected on all pages.
 *
 * @param {string} pagePrefix - Relative prefix from the page to the site root.
 * @returns {string} HTML script tag string for globally shared scripts.
 */
function buildCommonScripts(pagePrefix: string): string {
  return buildDeferredScriptTag(`${pagePrefix}${PATHS.js.themeToggle}`);
}

/**
 * Formats a date for display with the site-wide locale.
 *
 * @param {Date} date - The date to format.
 * @returns {string} The formatted display date.
 */
function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

// Page Builders

/**
 * Builds the homepage (index.html), featuring a selection of the latest themes.
 *
 * @param {string} template - The base HTML template.
 * @param {string} cardTemplate - The theme card HTML template.
 * @param {string} latestThemesHeadlineHtml - The headline/subhead HTML partial for latest themes.
 */
async function buildHomepage(
  template: string,
  cardTemplate: string,
  latestThemesHeadlineHtml: string,
) {
  const themes = await getPinnedThemes();
  const content = buildThemeCardsGrid(themes, cardTemplate);

  const html = applyBaseTemplate(
    template,
    {
      title: "An Emacs Themes Gallery",
      description:
        "Browse a curated collection of beautiful Emacs themes. Find your next favorite look for the world's most extensible editor.",
      canonicalPath: "/",
      ogTitle: "Emacs Themes Gallery",
      ogDescription: "Discover and preview the best Emacs themes.",
      ogImage: `${BASE_URL}/emacs.webp`,
      fonts: [INTER_FONT_PATH],
      themesGrid: content,
      latestThemesHeadline: latestThemesHeadlineHtml,
      mainCssPath: `/${PATHS.css.main}`,
      extraCssPaths: [`/${PATHS.css.card}`],
      scripts: buildCommonScripts("/"),
    },
    BASE_TEMPLATE_OPTIONS,
  );

  const minifiedHtml = await minifyHtml(html);
  await Bun.write(PATHS.pages.home, minifiedHtml);
  logInfo("Generated index.html");
}

/**
 * Builds the "All Themes" page, listing every available theme with a search bar.
 *
 * @param {string} template - The base HTML template.
 * @param {string} cardTemplate - The theme card HTML template.
 * @param {string} searchBarHtml - The HTML for the search bar partial.
 * @param {Theme[]} rawThemes - The single build-wide recipe snapshot.
 */
async function buildAllThemesPage(
  template: string,
  cardTemplate: string,
  searchBarHtml: string,
  rawThemes: Theme[],
) {
  const screenshotGeneratedDates = await readScreenshotDates();
  const allThemes = addScreenshotGeneratedDates(rawThemes, screenshotGeneratedDates);
  allThemes.sort((a, b) => a.name.localeCompare(b.name, "en"));

  const updatedSearchBarHtml = searchBarHtml.replace(
    "{{TOTAL_THEMES}}",
    allThemes.length.toLocaleString(),
  );

  const content = buildThemeCardsGrid(allThemes, cardTemplate, "../");

  await writeThemeSearchIndex(buildThemeSearchIndex(allThemes));

  // Bundle the search script via Bun.build so the import of
  // src/templates/core/search-sort.ts is resolved. The placeholder
  // {{THEMES_INDEX_URL}} lives inside a string literal and survives
  // bundling/minification, so we replace it afterwards.
  const buildResult = await Bun.build({
    entrypoints: [PATHS.templates.partials.searchScript],
    target: "browser",
    minify: true,
  });
  let scriptContent = await buildResult.outputs[0].text();
  scriptContent = scriptContent.replaceAll(
    "{{THEMES_INDEX_URL}}",
    "../static/data/themes-index.json",
  );
  await writeThemesSearchScript(scriptContent);
  const scriptHtml = [
    buildCommonScripts("../"),
    `<script type="module" src="../${PATHS.js.themesSearch}"></script>`,
  ].join("\n");

  const html = applyBaseTemplate(
    template,
    {
      title: "Full Emacs Themes Directory",
      description:
        "Explore our complete directory of Emacs themes. Filter by name, type, or tags to find the perfect style for your setup.",
      canonicalPath: "/themes/",
      ogTitle: "Emacs Themes Directory",
      ogDescription: "Search and filter through all available Emacs themes.",
      ogImage: `${BASE_URL}/emacs.webp`,
      fonts: [INTER_FONT_PATH, INTER_ITALIC_FONT_PATH],
      themesGrid: content,
      searchBar: updatedSearchBarHtml,
      mainCssPath: `../${PATHS.css.main}`,
      extraCssPaths: [`../${PATHS.css.search}`, `../${PATHS.css.card}`],
      scripts: scriptHtml,
    },
    BASE_TEMPLATE_OPTIONS,
  );

  const minifiedHtml = await minifyHtml(html);
  await mkdir(PATHS.pages.themesDir, { recursive: true });
  await Bun.write(PATHS.pages.themesIndex, minifiedHtml);
  logInfo("Generated themes/index.html");
}

/**
 * Builds individual detail pages for each theme, including screenshots and metadata.
 *
 * @param {string} template - The base HTML template.
 * @param {string} contentTemplate - The theme detail content HTML template.
 * @param {Theme[]} themes - The single build-wide recipe snapshot.
 */
async function buildThemeDetailPages(template: string, contentTemplate: string, themes: Theme[]) {
  const mainCssPath = `../${PATHS.css.main}`;
  const detailCssPath = `../${PATHS.css.detail}`;
  const commonScripts = buildCommonScripts("../");
  const screenshotDates = await readScreenshotDates();

  for (const theme of themes) {
    const themeImgsDir = assertPathWithinRoot(PATHS.assets.src.images, theme.id);
    let screenshotsHtml = "";

    try {
      const files = await readdir(themeImgsDir);
      const webps = files.filter((f) => f.endsWith(".webp") && f !== "preview.webp");

      screenshotsHtml = webps
        .map((file) => {
          const modeName = file.replace(".webp", "");
          const modeLabel =
            modeName === "fundamental-mode" ? "fundamental-mode/selection" : modeName;
          return `
      <div class="screenshot-item"">
        <h3>${modeLabel}</h3>
        <img src="../static/imgs/${theme.id}/${file}" alt="${theme.name} in ${modeName}" loading="lazy" width="1280" height="960" />
      </div>`;
        })
        .join("\n");
    } catch {
      logWarn(`No screenshots found for theme ${theme.id}`);
    }

    const tagsHtml = theme.tags
      .map(
        (tag) =>
          `<a href="/themes/index.html?q=${encodeURIComponent(tag)}" class="tag-link">${tag}</a>`,
      )
      .join("\n");

    const generatedDateObj = await resolveThemeGeneratedDate(
      theme.id,
      themeImgsDir,
      screenshotDates,
    );

    const generatedDate = formatDisplayDate(generatedDateObj);

    let repoLinkHtml = `<a href="${theme.repoUrl}" target="_blank" rel="noopener noreferrer" class="button">View Source on GitHub</a>`;
    if (theme.repoUrl === "local") {
      repoLinkHtml = "";
    }

    const content = contentTemplate
      .replace(/{{THEME_NAME}}/g, escapeHtml(theme.name))
      .replace(/{{THEME_DESCRIPTION}}/g, escapeHtml(theme.description))
      .replace(
        /<a href="{{THEME_REPO_URL}}" target="_blank" rel="noopener noreferrer" class="button">View Source on GitHub<\/a>/g,
        repoLinkHtml,
      )
      .replace(/{{THEME_REPO_URL}}/g, theme.repoUrl)
      .replace(/{{THEME_TYPE}}/g, theme.type)
      .replace(/{{THEME_TAGS}}/g, tagsHtml)
      .replace(/{{GENERATED_DATE}}/g, generatedDate)
      .replace("{{SCREENSHOTS}}", screenshotsHtml);

    const html = applyBaseTemplate(
      template,
      {
        title: `${theme.name} - Emacs Theme`,
        description: theme.description,
        canonicalPath: `/themes/${theme.id}`,
        ogTitle: `${theme.name} Theme for Emacs`,
        ogDescription: `Preview and details for the ${theme.name} theme.`,
        ogImage: `${BASE_URL}/static/imgs/${theme.id}/preview.webp`,
        fonts: [INTER_FONT_PATH],
        themesGrid: content,
        mainCssPath: mainCssPath,
        extraCssPaths: [detailCssPath],
        scripts: commonScripts,
      },
      BASE_TEMPLATE_OPTIONS,
    );

    const minifiedHtml = await minifyHtml(html);
    const themePagePath = assertPathWithinRoot(PATHS.pages.themesDir, `${theme.id}.html`);
    await Bun.write(themePagePath, minifiedHtml);
    logInfo(`Generated themes/${theme.id}.html`);
  }
}

/**
 * Builds the "About" page.
 *
 * @param {string} template - The base HTML template.
 * @param {string} aboutContentHtml - The HTML content for the about page.
 */
async function buildAboutPage(template: string, aboutContentHtml: string) {
  const html = applyBaseTemplate(
    template,
    {
      title: "About the website",
      description: "Learn more about our curated directory of Emacs themes and how to contribute.",
      canonicalPath: "/about",
      ogTitle: "About Emacs Themes Site",
      ogDescription: "Information about the curated Emacs themes directory.",
      ogImage: `${BASE_URL}/emacs.webp`,
      fonts: [INTER_FONT_PATH],
      themesGrid: aboutContentHtml,
      mainCssPath: `/${PATHS.css.main}`,
      scripts: buildCommonScripts("/"),
    },
    BASE_TEMPLATE_OPTIONS,
  );

  const minifiedHtml = await minifyHtml(html);
  await Bun.write(PATHS.pages.about, minifiedHtml);
  logInfo("Generated about.html");
}

/**
 * Builds the "Popular" page, listing popular themes from MELPA and GitHub.
 *
 * Fetches all popularity sources concurrently with the rest of the build.
 * Fails the build when every source fails, so the always-linked `/popular`
 * page can never silently disappear from a clean build. When only some
 * sources fail, the page is generated with source-aware copy plus an
 * availability notice for the missing sources. Recipe destinations resolve
 * against the same build-wide recipe snapshot as every other page.
 *
 * @param {string} template - The base HTML template.
 * @param {string} contentTemplate - The popular themes content HTML template.
 * @param {Promise<PopularThemeSourceResult[]>} popularThemesPromise - The in-flight popularity fetch.
 * @param {Theme[]} allThemes - The single build-wide recipe snapshot.
 */
async function buildPopularThemesPage(
  template: string,
  contentTemplate: string,
  popularThemesPromise: Promise<PopularThemeSourceResult[]>,
  allThemes: Theme[],
) {
  const results = await popularThemesPromise;
  await writePopularThemesLogs(results, POPULAR_LOGS_DIR);
  const recipes = toPopularThemeRecipes(allThemes);

  const available = getAvailablePopularSources(results);
  const missing = getMissingPopularSources(results);

  if (available.length === 0) {
    throw new Error(
      "Failed to fetch popular themes from all sources; refusing to build a site without popular.html",
    );
  }

  for (const source of missing) {
    logWarn(`${source} popularity source unavailable; generating popular page without it.`);
  }

  const copy = resolvePopularPageCopy(available);
  const notice = renderPopularSourceNotice(missing);
  const generatedDate = formatDisplayDate(new Date());

  const content = contentTemplate
    .replace('<p class="subhead">{{POPULAR_THEMES_SUBHEAD}}</p>', () =>
      copy.subhead ? `<p class="subhead">${copy.subhead}</p>` : "",
    )
    .replace("{{POPULAR_THEMES_NOTICE}}", () => notice)
    .replace("{{POPULAR_THEMES_TABLES}}", () => renderPopularThemeTables(results, recipes))
    .replace("{{GENERATED_DATE}}", () => generatedDate);

  const html = applyBaseTemplate(
    template,
    {
      title: copy.title,
      description: copy.description,
      canonicalPath: "/popular",
      ogTitle: copy.ogTitle,
      ogDescription: copy.ogDescription,
      ogImage: `${BASE_URL}/emacs.webp`,
      fonts: [INTER_FONT_PATH],
      themesGrid: content,
      mainCssPath: `/${PATHS.css.main}`,
      extraCssPaths: [`/${PATHS.css.popular}`],
      scripts: buildCommonScripts("/"),
    },
    BASE_TEMPLATE_OPTIONS,
  );

  const minifiedHtml = await minifyHtml(html);
  await Bun.write(PATHS.pages.popular, minifiedHtml);
  logInfo("Generated popular.html");
}

/**
 * Builds the 404 error page.
 *
 * @param {string} template - The base HTML template.
 * @param {string} error404ContentHtml - The HTML content for the 404 page.
 */
async function build404Page(template: string, error404ContentHtml: string) {
  const html = applyBaseTemplate(
    template,
    {
      title: "404 - Page Not Found",
      description: "The page you are looking for could not be found.",
      canonicalPath: "/404",
      ogTitle: "404 - Page Not Found",
      ogDescription: "The page you are looking for could not be found.",
      ogImage: `${BASE_URL}/emacs.webp`,
      fonts: [INTER_FONT_PATH],
      themesGrid: error404ContentHtml,
      mainCssPath: `/${PATHS.css.main}`,
      extraCssPaths: [`/${PATHS.css.error}`],
      scripts: buildCommonScripts("/"),
    },
    BASE_TEMPLATE_OPTIONS,
  );

  const minifiedHtml = await minifyHtml(html);
  await Bun.write(PATHS.pages.error404, minifiedHtml);
  logInfo("Generated 404.html");
}

// Utility

/**
 * Symlinks a source directory at the destination path.
 *
 * @param {string} src - Source directory path.
 * @param {string} dest - Destination directory path.
 */
async function linkDir(src: string, dest: string) {
  await rm(dest, { recursive: true, force: true });
  await mkdir(dirname(dest), { recursive: true });
  const srcAbsolutePath = resolve(src);
  const destParentAbsolutePath = resolve(dirname(dest));
  const relativeLinkTarget = relative(destParentAbsolutePath, srcAbsolutePath);

  await symlink(relativeLinkTarget, dest, "dir");
  logInfo(`Symlinked ${dest} -> ${relativeLinkTarget}`);
}

/**
 * Recursively copies a source directory to the destination path.
 *
 * @param {string} src - Source directory path.
 * @param {string} dest - Destination directory path.
 */
async function copyDir(src: string, dest: string) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
      continue;
    }

    if (entry.isFile()) {
      await copyFile(srcPath, destPath);
    }
  }

  logInfo(`Copied ${src} -> ${dest}`);
}

/**
 * Minifies and copies CSS files from a directory to a destination.
 *
 * @param {string} src - The source directory path containing CSS files.
 * @param {string} dest - The destination directory path.
 */
async function minifyAndCopyCss(src: string, dest: string) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".css")) {
      const content = await readFile(join(src, entry.name), "utf-8");
      const minified = await minifyCss(content);
      await Bun.write(join(dest, entry.name), minified);
    }
  }
}

/**
 * Main build entry point.
 * orchestrates the cleaning, template loading, page generation, and asset copying.
 */
async function build() {
  logInfo("Starting build...");

  await rm(BUILD_DIR, { recursive: true, force: true });
  await mkdir(BUILD_DIR, { recursive: true });

  // Kick off the popularity fetch and the recipe snapshot immediately so
  // network and disk I/O run in parallel with template reading and static
  // page generation. Every page builder shares this one recipe snapshot,
  // so a recipe change mid-build can never make pages disagree.
  const popularThemesPromise = fetchPopularThemes();
  const allThemesPromise = getAllThemes();

  const [
    baseTemplate,
    cardTemplate,
    searchBarHtml,
    detailContentTemplate,
    latestThemesHeadlineHtml,
    aboutContentHtml,
    popularThemesContentTemplate,
    error404ContentTemplate,
    themeToggleScriptSource,
    posthogScriptSource,
    allThemes,
  ] = await Promise.all([
    Bun.file(PATHS.templates.base).text(),
    Bun.file(PATHS.templates.partials.themeCard).text(),
    Bun.file(PATHS.templates.partials.searchBar).text(),
    Bun.file(PATHS.templates.partials.themeDetail).text(),
    Bun.file(PATHS.templates.partials.latestThemesHeadline).text(),
    Bun.file(PATHS.templates.partials.about).text(),
    Bun.file(PATHS.templates.partials.popular).text(),
    Bun.file(PATHS.templates.partials.error404).text(),
    Bun.file(PATHS.templates.partials.themeToggleScript).text(),
    Bun.file(PATHS.templates.partials.posthogScript).text(),
    allThemesPromise,
  ]);

  const minifiedThemeToggleJs = await minifyJs(themeToggleScriptSource);
  await writeThemeToggleScript(minifiedThemeToggleJs);
  await writePosthogScript(await minifyJs(posthogScriptSource));

  await buildHomepage(baseTemplate, cardTemplate, latestThemesHeadlineHtml);
  await buildAllThemesPage(baseTemplate, cardTemplate, searchBarHtml, allThemes);
  await buildThemeDetailPages(baseTemplate, detailContentTemplate, allThemes);
  await buildAboutPage(baseTemplate, aboutContentHtml);
  await buildPopularThemesPage(
    baseTemplate,
    popularThemesContentTemplate,
    popularThemesPromise,
    allThemes,
  );
  await build404Page(baseTemplate, error404ContentTemplate);

  logInfo("Copying and minifying assets...");
  await Promise.all([
    // `imgs` stays a symlink: it holds ~1GB of screenshots served from R2 in
    // production (`deploy:site` removes `build/static/imgs` before deploying),
    // so copying it would only slow every local/CI build down.
    linkDir(PATHS.assets.src.images, PATHS.assets.dest.images),
    // `themes` ships inside the deploy bundle, so it must be copied: a
    // symlink pointing outside `build/` would break standalone deployments.
    copyDir(PATHS.assets.src.themes, PATHS.assets.dest.themes),
    copyDir(PATHS.assets.src.fonts, PATHS.assets.dest.fonts),
    minifyAndCopyCss(CSS_DIR, PATHS.assets.dest.css),
    copyFile(PATHS.assets.src.headers, PATHS.assets.dest.headers),
    copyFile(PATHS.assets.src.robots, PATHS.assets.dest.robots),
    copyFile(PATHS.assets.src.favicon, PATHS.assets.dest.favicon),
    copyFile(PATHS.assets.src.emacsWebp, PATHS.assets.dest.emacsWebp),
  ]);

  logInfo("Build complete!");
}

if (import.meta.main) {
  build().catch((err) => {
    console.error(`${LOG_PREFIX} Build failed:`, err);
    process.exitCode = 1;
  });
}
