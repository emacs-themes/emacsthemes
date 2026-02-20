import { mkdir, readdir, copyFile, rm, stat, readFile, symlink } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { minify, Options as MinifyOptions } from "html-minifier-terser";
import { fetchPopularThemes } from "./fetch-popular-themes";
import { assertPathWithinRoot } from "../core/path-utils";
import { escapeHtml } from "../core/html-utils";

// Constants
const RECIPES_DIR = "recipes";
const BUILD_DIR = "build";
const TEMPLATES_DIR = "src/templates";
const STATIC_DIR = "static";
const CSS_DIR = join(TEMPLATES_DIR, "css");
const GITHUB_URL = "https://github.com/emacs-themes/emacsthemes";
const BASE_URL = "https://emacsthemes.org";
const TITLE_BRAND_SUFFIX = " - Emacs Themes";

/**
 * Options for html-minifier-terser.
 */
const MINIFY_OPTIONS: MinifyOptions = {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  minifyJS: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true
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
      about: join(TEMPLATES_DIR, "html/partials/about-content.html"),
      popular: join(TEMPLATES_DIR, "html/partials/popular-content.html"),
      error404: join(TEMPLATES_DIR, "html/partials/404-content.html"),
      searchScript: join(TEMPLATES_DIR, "html/partials/search-script.html"),
    },
  },
  css: {
    main: "static/css/style.css",
    search: "static/css/search.css",
    detail: "static/css/theme-detail.css",
    card: "static/css/card.css",
    error: "static/css/error.css",
  },
  assets: {
    src: {
      images: join(STATIC_DIR, "imgs"),
      themes: join(STATIC_DIR, "themes"),
      favicon: join(STATIC_DIR, "favicon.ico"),
      emacsPng: join(STATIC_DIR, "emacs.png"),
    },
    dest: {
      images: join(BUILD_DIR, STATIC_DIR, "imgs"),
      themes: join(BUILD_DIR, STATIC_DIR, "themes"),
      css: join(BUILD_DIR, STATIC_DIR, "css"),
      favicon: join(BUILD_DIR, "favicon.ico"),
      emacsPng: join(BUILD_DIR, "emacs.png"),
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

// Data Fetching

/**
 * Retrieves a list of themes sorted by modification time (newest first).
 *
 * @param {number} [limit=9] - The maximum number of themes to return.
 * @returns {Promise<Theme[]>} A promise that resolves to an array of sorted Theme objects.
 */
async function getSortedThemes(limit: number = 9): Promise<Theme[]> {
  const files = await readdir(RECIPES_DIR);
  const themeFiles = files.filter(f => f.endsWith(".json"));

  const themesWithStats = await Promise.all(
    themeFiles.map(async (file) => {
      const filePath = join(RECIPES_DIR, file);
      const content = await Bun.file(filePath).json() as Theme;
      const screenshotsDir = assertPathWithinRoot(PATHS.assets.src.images, content.id);

      try {
        const stats = await stat(screenshotsDir);
        return { ...content, mtime: stats.mtime.getTime() };
      } catch {
        // Skip themes without a screenshots directory
        return null;
      }
    })
  );

  return themesWithStats
    .filter((t): t is (Theme & { mtime: number }) => t !== null)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
}

/**
 * Retrieves all available themes from the recipes directory.
 *
 * @returns {Promise<Theme[]>} A promise that resolves to an array of all Theme objects.
 */
async function getAllThemes(): Promise<Theme[]> {
  const files = await readdir(RECIPES_DIR);
  return await Promise.all(
    files.filter(f => f.endsWith(".json")).map(async (file) => {
      return await Bun.file(join(RECIPES_DIR, file)).json();
    })
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
 * Minifies CSS content by wrapping it in a style tag and using html-minifier-terser.
 *
 * @param {string} css - The CSS string to minify.
 * @returns {Promise<string>} The minified CSS string.
 */
async function minifyCss(css: string): Promise<string> {
  const minified = await minify(`<style>${css}</style>`, { minifyCSS: true });
  return minified.replace("<style>", "").replace("</style>", "");
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
 * Generates the HTML for a single theme card.
 *
 * @param {Theme} theme - The theme object containing details like name, id, description, etc.
 * @param {string} template - The HTML template string for the card.
 * @param {string} [relativeRoot=""] - The relative path to the root directory (used for linking assets).
 * @returns {string} The populated HTML string for the theme card.
 */
function generateThemeCard(theme: Theme, template: string, relativeRoot: string = ""): string {
  const imagePath = `${relativeRoot}${STATIC_DIR}/imgs/${theme.id}/preview.png`;
  return template
    .replace(/{{THEME_NAME}}/g, escapeHtml(theme.name))
    .replace(/{{THEME_ID}}/g, theme.id)
    .replace(/{{THEME_DESCRIPTION}}/g, escapeHtml(theme.description))
    .replace(/{{THEME_REPO_URL}}/g, theme.repoUrl)
    .replace(/{{THEME_LOCAL_URL}}/g, theme.id)
    .replace(/{{THEME_IMAGE_PATH}}/g, imagePath);
}

/**
 * Generates HTML tags for preloading a CSS file, with a fallback for non-JS environments.
 *
 * @param {string} cssPath - The path to the CSS file.
 * @returns {string} The HTML string containing the preload link and noscript fallback.
 */
function getCssPreloadTags(cssPath: string): string {
  return `
    <link rel="preload" href="${cssPath}" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="${cssPath}"></noscript>`;
}

interface PageData {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  themesGrid: string;
  searchBar?: string;
  latestThemesHeadline?: string;
  mainCssPath: string;
  extraCssPaths?: string[];
  scripts?: string;
}

/**
 * Injects page-specific data into the base HTML template (layout).
 *
 * @param {string} template - The base HTML template string.
 * @param {PageData} data - An object containing the content and configuration for the page.
 * @returns {string} The fully rendered HTML page.
 */
function applyBaseTemplate(template: string, data: PageData): string {
  const currentYear = new Date().getFullYear().toString();
  const brandedTitle = `${data.title}${TITLE_BRAND_SUFFIX}`;
  const extraCssPreloads = (data.extraCssPaths || [])
    .map(path => getCssPreloadTags(path))
    .join("\n");

  return template
    .replace("{{TITLE}}", escapeHtml(brandedTitle))
    .replace("{{DESCRIPTION}}", escapeHtml(data.description))
    .replace(/{{OG_TITLE}}/g, escapeHtml(data.ogTitle))
    .replace(/{{OG_DESCRIPTION}}/g, escapeHtml(data.ogDescription))
    .replace(/{{OG_IMAGE}}/g, escapeHtml(data.ogImage))
    .replace("{{THEMES_GRID}}", data.themesGrid)
    .replace("{{SEARCH_BAR}}", data.searchBar || "")
    .replace("{{LATEST_THEMES_HEADLINE}}", data.latestThemesHeadline || "")
    .replace("{{MAIN_CSS_PRELOAD}}", getCssPreloadTags(data.mainCssPath))
    .replace("{{EXTRA_CSS_PRELOAD}}", extraCssPreloads)
    .replace("{{YEAR}}", currentYear)
    .replace("{{SCRIPTS}}", data.scripts || "")
    .replace(/{{GITHUB_URL}}/g, GITHUB_URL);
}

// Page Builders

/**
 * Builds the homepage (index.html), featuring a selection of the latest themes.
 *
 * @param {string} template - The base HTML template.
 * @param {string} cardTemplate - The theme card HTML template.
 */
async function buildHomepage(template: string, cardTemplate: string) {
  const themes = await getSortedThemes(9);
  const themesGrid = `<div class="grid">` + themes.map(t => generateThemeCard(t, cardTemplate)).join("\n") + `</div>`;
  const latestThemesHeadline = `<h2 class="latest-headline">Freshly Baked Themes 🥐</h2><p class="subhead">The newest additions to our gallery. Warning: may cause sudden urge to rewrite your init.el.</p>`;

  const html = applyBaseTemplate(template, {
    title: "An Emacs Themes Gallery",
    description: "Browse a curated collection of beautiful Emacs themes. Find your next favorite look for the world's most extensible editor.",
    ogTitle: "Emacs Themes Gallery",
    ogDescription: "Discover and preview the best Emacs themes.",
    ogImage: `${BASE_URL}/emacs.png`,
    themesGrid,
    latestThemesHeadline,
    mainCssPath: `/${PATHS.css.main}`,
    extraCssPaths: [`/${PATHS.css.card}`]
  });

  const minifiedHtml = await minifyHtml(html);
  await Bun.write(PATHS.pages.home, minifiedHtml);
  console.log("Generated index.html");
}

/**
 * Builds the "All Themes" page, listing every available theme with a search bar.
 *
 * @param {string} template - The base HTML template.
 * @param {string} cardTemplate - The theme card HTML template.
 * @param {string} searchBarHtml - The HTML for the search bar partial.
 * @param {string} searchScriptTemplate - The HTML template for the search script.
 */
async function buildAllThemesPage(template: string, cardTemplate: string, searchBarHtml: string, searchScriptTemplate: string) {
  const allThemes = await getAllThemes();
  allThemes.sort((a, b) => a.name.localeCompare(b.name));

  const updatedSearchBarHtml = searchBarHtml.replace("{{TOTAL_THEMES}}", allThemes.length.toLocaleString());

  const themesGrid = `<div class="grid">` + allThemes.map(t => generateThemeCard(t, cardTemplate, "../")).join("\n") + `</div>`;

  const themesData = allThemes.map(t => ({
    id: t.id,
    name: t.name,
    type: t.type,
    tags: t.tags
  }));

  const scriptWithData = searchScriptTemplate.replace("{{THEMES_DATA}}", JSON.stringify(themesData));
  const scriptContent = scriptWithData.replace("<script>", "").replace("</script>", "");
  const minifiedJs = await minifyJs(scriptContent);
  const scriptHtml = `<script>${minifiedJs}</script>`;

  const html = applyBaseTemplate(template, {
    title: "Full Emacs Themes Directory",
    description: "Explore our complete directory of Emacs themes. Filter by name, type, or tags to find the perfect style for your setup.",
    ogTitle: "Emacs Themes Directory",
    ogDescription: "Search and filter through all available Emacs themes.",
    ogImage: `${BASE_URL}/emacs.png`,
    themesGrid,
    searchBar: updatedSearchBarHtml,
    mainCssPath: `../${PATHS.css.main}`,
    extraCssPaths: [`../${PATHS.css.search}`, `../${PATHS.css.card}`],
    scripts: scriptHtml
  });

  const minifiedHtml = await minifyHtml(html);
  await mkdir(PATHS.pages.themesDir, { recursive: true });
  await Bun.write(PATHS.pages.themesIndex, minifiedHtml);
  console.log("Generated themes/index.html");
}

/**
 * Builds individual detail pages for each theme, including screenshots and metadata.
 *
 * @param {string} template - The base HTML template.
 * @param {string} contentTemplate - The theme detail content HTML template.
 */
async function buildThemeDetailPages(template: string, contentTemplate: string) {
  const themes = await getAllThemes();
  const mainCssPath = `../${PATHS.css.main}`;
  const detailCssPath = `../${PATHS.css.detail}`;

  for (const theme of themes) {
    const themeImgsDir = assertPathWithinRoot(PATHS.assets.src.images, theme.id);
    let screenshotsHtml = "";

    try {
      const files = await readdir(themeImgsDir);
      const pngs = files.filter(f => f.endsWith(".png") && f !== "preview.png");

      screenshotsHtml = pngs.map(file => {
        const modeName = file.replace(".png", "");
        return `
      <div class="screenshot-item">
        <h3>${modeName}</h3>
        <img src="../static/imgs/${theme.id}/${file}" alt="${theme.name} in ${modeName}" loading="lazy" />
      </div>`;
      }).join("\n");
    } catch {
      console.warn(`No screenshots found for theme ${theme.id}`);
    }

    const tagsHtml = theme.tags.map(tag =>
      `<a href="/themes/index.html?q=${encodeURIComponent(tag)}" class="tag-link">${tag}</a>`
    ).join("\n");

    const generatedDateObj = await (async () => {
      try {
        const stats = await stat(themeImgsDir);
        return stats.mtime;
      } catch {
        return new Date();
      }
    })();

    const generatedDate = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(generatedDateObj);

    let repoLinkHtml = `<a href="${theme.repoUrl}" target="_blank" rel="noopener noreferrer" class="button">View Source on GitHub</a>`;
    if (theme.repoUrl === "local") {
      repoLinkHtml = "";
    }

    const content = contentTemplate
      .replace(/{{THEME_NAME}}/g, escapeHtml(theme.name))
      .replace(/{{THEME_DESCRIPTION}}/g, escapeHtml(theme.description))
      .replace(/<a href="{{THEME_REPO_URL}}" target="_blank" rel="noopener noreferrer" class="button">View Source on GitHub<\/a>/g, repoLinkHtml)
      .replace(/{{THEME_REPO_URL}}/g, theme.repoUrl)
      .replace(/{{THEME_TYPE}}/g, theme.type)
      .replace(/{{THEME_TAGS}}/g, tagsHtml)
      .replace(/{{GENERATED_DATE}}/g, generatedDate)
      .replace("{{SCREENSHOTS}}", screenshotsHtml);

    const html = applyBaseTemplate(template, {
      title: `${theme.name} - Emacs Theme`,
      description: theme.description,
      ogTitle: `${theme.name} Theme for Emacs`,
      ogDescription: `Preview and details for the ${theme.name} theme.`,
      ogImage: `${BASE_URL}/static/imgs/${theme.id}/preview.png`,
      themesGrid: content,
      mainCssPath: mainCssPath,
      extraCssPaths: [detailCssPath]
    });

    const minifiedHtml = await minifyHtml(html);
    const themePagePath = assertPathWithinRoot(PATHS.pages.themesDir, `${theme.id}.html`);
    await Bun.write(themePagePath, minifiedHtml);
    console.log(`Generated themes/${theme.id}.html`);
  }
}

/**
 * Builds the "About" page.
 *
 * @param {string} template - The base HTML template.
 * @param {string} aboutContentHtml - The HTML content for the about page.
 */
async function buildAboutPage(template: string, aboutContentHtml: string) {
  const html = applyBaseTemplate(template, {
    title: "About the website",
    description: "Learn more about our curated directory of Emacs themes and how to contribute.",
    ogTitle: "About Emacs Themes Site",
    ogDescription: "Information about the curated Emacs themes directory.",
    ogImage: `${BASE_URL}/emacs.png`,
    themesGrid: aboutContentHtml,
    mainCssPath: `/${PATHS.css.main}`
  });

  const minifiedHtml = await minifyHtml(html);
  await Bun.write(PATHS.pages.about, minifiedHtml);
  console.log("Generated about.html");
}

/**
 * Builds the "Popular" page, listing popular themes from MELPA.
 *
 * @param {string} template - The base HTML template.
 * @param {string} contentTemplate - The popular themes content HTML template.
 */
async function buildPopularThemesPage(template: string, contentTemplate: string) {
  const popularThemes = await fetchPopularThemes();

  if (!popularThemes) {
    console.warn("Skipping popular themes page due to fetch failure.");
    return;
  }

  const themesListHtml = popularThemes.map((theme, index) => {
    const rank = index + 1;
    const nameHtml = theme.url
      ? `<a href="${theme.url}" target="_blank" rel="noopener noreferrer">${theme.name}</a>`
      : theme.name;

    return `
      <tr>
        <td>${rank}</td>
        <td>${nameHtml}</td>
        <td class="text-right">${theme.downloads.toLocaleString()}</td>
      </tr>`;
  }).join("\n");

  const generatedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  const content = contentTemplate
    .replace("{{THEMES_LIST}}", themesListHtml)
    .replace("{{GENERATED_DATE}}", generatedDate);

  const html = applyBaseTemplate(template, {
    title: "Popular Emacs Themes - MELPA Statistics",
    description: "Discover the most downloaded Emacs themes from MELPA. See which looks are trending in the community.",
    ogTitle: "Popular Emacs Themes",
    ogDescription: "MELPA download statistics for top Emacs themes.",
    ogImage: `${BASE_URL}/emacs.png`,
    themesGrid: content,
    mainCssPath: `/${PATHS.css.main}`,
    extraCssPaths: [`/${PATHS.css.detail}`] // Reusing detail CSS for header consistency
  });

  const minifiedHtml = await minifyHtml(html);
  await Bun.write(PATHS.pages.popular, minifiedHtml);
  console.log("Generated popular.html");
}

/**
 * Builds the 404 error page.
 *
 * @param {string} template - The base HTML template.
 * @param {string} error404ContentHtml - The HTML content for the 404 page.
 */
async function build404Page(template: string, error404ContentHtml: string) {
  const html = applyBaseTemplate(template, {
    title: "404 - Page Not Found",
    description: "The page you are looking for could not be found.",
    ogTitle: "404 - Page Not Found",
    ogDescription: "The page you are looking for could not be found.",
    ogImage: `${BASE_URL}/emacs.png`,
    themesGrid: error404ContentHtml,
    mainCssPath: `/${PATHS.css.main}`,
    extraCssPaths: [`/${PATHS.css.error}`]
  });

  const minifiedHtml = await minifyHtml(html);
  await Bun.write(PATHS.pages.error404, minifiedHtml);
  console.log("Generated 404.html");
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
  console.log(`Symlinked ${dest} -> ${relativeLinkTarget}`);
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
  console.log("Starting build...");

  await rm(BUILD_DIR, { recursive: true, force: true });
  await mkdir(BUILD_DIR, { recursive: true });

  const [baseTemplate, cardTemplate, searchBarHtml, detailContentTemplate, aboutContentHtml, popularThemesContentTemplate, error404ContentTemplate, searchScriptTemplate] = await Promise.all([
    Bun.file(PATHS.templates.base).text(),
    Bun.file(PATHS.templates.partials.themeCard).text(),
    Bun.file(PATHS.templates.partials.searchBar).text(),
    Bun.file(PATHS.templates.partials.themeDetail).text(),
    Bun.file(PATHS.templates.partials.about).text(),
    Bun.file(PATHS.templates.partials.popular).text(),
    Bun.file(PATHS.templates.partials.error404).text(),
    Bun.file(PATHS.templates.partials.searchScript).text(),
  ]);

  await buildHomepage(baseTemplate, cardTemplate);
  await buildAllThemesPage(baseTemplate, cardTemplate, searchBarHtml, searchScriptTemplate);
  await buildThemeDetailPages(baseTemplate, detailContentTemplate);
  await buildAboutPage(baseTemplate, aboutContentHtml);
  await buildPopularThemesPage(baseTemplate, popularThemesContentTemplate);
  await build404Page(baseTemplate, error404ContentTemplate);

  console.log("Copying and minifying assets...");
  await Promise.all([
    linkDir(PATHS.assets.src.images, PATHS.assets.dest.images),
    linkDir(PATHS.assets.src.themes, PATHS.assets.dest.themes),
    minifyAndCopyCss(CSS_DIR, PATHS.assets.dest.css),
    copyFile(PATHS.assets.src.favicon, PATHS.assets.dest.favicon),
    copyFile(PATHS.assets.src.emacsPng, PATHS.assets.dest.emacsPng)
  ]);

  console.log("Build complete!");
}

if (import.meta.main) {
  build().catch((err) => {
    console.error("Build failed:", err);
    process.exitCode = 1;
  });
}
