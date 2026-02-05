import { mkdir, readdir, copyFile, rm, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { minify, Options as MinifyOptions } from "html-minifier-terser";

// Constants
const RECIPES_DIR = "recipes";
const BUILD_DIR = "build";
const TEMPLATES_DIR = "src/templates";
const STATIC_DIR = "static";
const CSS_DIR = join(TEMPLATES_DIR, "css");
const GITHUB_URL = "https://github.com/caisah/emacsthemes";

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
    },
  },
  css: {
    main: "static/css/style.css",
    search: "static/css/search.css",
    detail: "static/css/theme-detail.css",
    card: "static/css/card.css",
  },
  assets: {
    src: {
      images: join(STATIC_DIR, "imgs"),
      favicon: join(STATIC_DIR, "favicon.ico"),
    },
    dest: {
      images: join(BUILD_DIR, STATIC_DIR, "imgs"),
      css: join(BUILD_DIR, STATIC_DIR, "css"),
      favicon: join(BUILD_DIR, "favicon.ico"),
    },
  },
  pages: {
    home: join(BUILD_DIR, "index.html"),
    themesIndex: join(BUILD_DIR, "themes/index.html"),
    themesDir: join(BUILD_DIR, "themes"),
    about: join(BUILD_DIR, "about.html"),
  },
};

interface Theme {
  name: string;
  id: string;
  description: string;
  repoUrl: string;
  type: string;
  tags: string[];
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
      const stats = await stat(filePath);
      const content = await Bun.file(filePath).json();
      return { ...content, mtime: stats.mtime.getTime() };
    })
  );

  return themesWithStats.sort((a, b) => b.mtime - a.mtime).slice(0, limit);
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
    .replace(/{{THEME_NAME}}/g, theme.name)
    .replace(/{{THEME_ID}}/g, theme.id)
    .replace(/{{THEME_DESCRIPTION}}/g, theme.description)
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
  themesGrid: string;
  searchBar?: string;
  mainCssPath: string;
  extraCssPaths?: string[];
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
  const extraCssPreloads = (data.extraCssPaths || [])
    .map(path => getCssPreloadTags(path))
    .join("\n");
  
  return template
    .replace("{{THEMES_GRID}}", data.themesGrid)
    .replace("{{SEARCH_BAR}}", data.searchBar || "")
    .replace("{{MAIN_CSS_PRELOAD}}", getCssPreloadTags(data.mainCssPath))
    .replace("{{EXTRA_CSS_PRELOAD}}", extraCssPreloads)
    .replace("{{YEAR}}", currentYear)
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
  const themesGrid = themes.map(t => generateThemeCard(t, cardTemplate)).join("\n");
  
  const html = applyBaseTemplate(template, {
    themesGrid,
    mainCssPath: PATHS.css.main,
    extraCssPaths: [PATHS.css.card]
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
 */
async function buildAllThemesPage(template: string, cardTemplate: string, searchBarHtml: string) {
  const allThemes = await getAllThemes();
  allThemes.sort((a, b) => a.name.localeCompare(b.name));

  const themesGrid = allThemes.map(t => generateThemeCard(t, cardTemplate, "../")).join("\n");
  
  const html = applyBaseTemplate(template, {
    themesGrid,
    searchBar: searchBarHtml,
    mainCssPath: `../${PATHS.css.main}`,
    extraCssPaths: [`../${PATHS.css.search}`, `../${PATHS.css.card}`]
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
    const themeImgsDir = join(PATHS.assets.src.images, theme.id);
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

    const content = contentTemplate
      .replace(/{{THEME_NAME}}/g, theme.name)
      .replace(/{{THEME_DESCRIPTION}}/g, theme.description)
      .replace(/{{THEME_REPO_URL}}/g, theme.repoUrl)
      .replace(/{{THEME_TYPE}}/g, theme.type)
      .replace(/{{THEME_TAGS}}/g, tagsHtml)
      .replace("{{SCREENSHOTS}}", screenshotsHtml);

    const html = applyBaseTemplate(template, {
      themesGrid: content,
      mainCssPath: mainCssPath,
      extraCssPaths: [detailCssPath]
    });

    const minifiedHtml = await minifyHtml(html);
    await Bun.write(join(PATHS.pages.themesDir, `${theme.id}.html`), minifiedHtml);
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
    themesGrid: aboutContentHtml,
    mainCssPath: PATHS.css.main
  });

  const minifiedHtml = await minifyHtml(html);
  await Bun.write(PATHS.pages.about, minifiedHtml);
  console.log("Generated about.html");
}

// Utility

/**
 * Recursively copies a directory and its contents to a destination.
 *
 * @param {string} src - The source directory path.
 * @param {string} dest - The destination directory path.
 */
async function copyDir(src: string, dest: string) {
  try {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      if (entry.isDirectory()) await copyDir(srcPath, destPath);
      else await copyFile(srcPath, destPath);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Warning copying ${src} to ${dest}:`, message);
  }
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

  const [baseTemplate, cardTemplate, searchBarHtml, detailContentTemplate, aboutContentHtml] = await Promise.all([
    Bun.file(PATHS.templates.base).text(),
    Bun.file(PATHS.templates.partials.themeCard).text(),
    Bun.file(PATHS.templates.partials.searchBar).text(),
    Bun.file(PATHS.templates.partials.themeDetail).text(),
    Bun.file(PATHS.templates.partials.about).text(),
  ]);

  await buildHomepage(baseTemplate, cardTemplate);
  await buildAllThemesPage(baseTemplate, cardTemplate, searchBarHtml);
  await buildThemeDetailPages(baseTemplate, detailContentTemplate);
  await buildAboutPage(baseTemplate, aboutContentHtml);

  console.log("Copying and minifying assets...");
  await Promise.all([
    copyDir(PATHS.assets.src.images, PATHS.assets.dest.images),
    minifyAndCopyCss(CSS_DIR, PATHS.assets.dest.css),
    copyFile(PATHS.assets.src.favicon, PATHS.assets.dest.favicon).catch(err => console.warn("Warning copying favicon:", err.message))
  ]);

  console.log("Build complete!");
}

if (import.meta.main) {
  build().catch(console.error);
}