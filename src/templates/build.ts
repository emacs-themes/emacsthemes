import { mkdir, readdir, copyFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";

// Constants
const RECIPES_DIR = "recipes";
const BUILD_DIR = "build";
const TEMPLATES_DIR = "src/templates";
const STATIC_DIR = "static";
const CSS_DIR = join(TEMPLATES_DIR, "css");
const GITHUB_URL = "https://github.com/caisah/emacsthemes";

const PATHS = {
  indexTemplate: join(TEMPLATES_DIR, "html/index.html"),
  searchBarTemplate: join(TEMPLATES_DIR, "html/partials/search-bar.html"),
  themeCardTemplate: join(TEMPLATES_DIR, "html/partials/theme-card.html"),
  themeDetailContentTemplate: join(TEMPLATES_DIR, "html/partials/theme-detail-content.html"),
  aboutTemplate: join(TEMPLATES_DIR, "html/partials/about-content.html"),
  mainCss: "static/css/style.css",
  searchCss: "static/css/search.css",
  detailCss: "static/css/theme-detail.css",
  cardCss: "static/css/card.css",
  imagesSrc: join(STATIC_DIR, "imgs"),
  imagesDest: join(BUILD_DIR, STATIC_DIR, "imgs"),
  cssDest: join(BUILD_DIR, STATIC_DIR, "css"),
  faviconSrc: join(STATIC_DIR, "favicon.ico"),
  faviconDest: join(BUILD_DIR, "favicon.ico"),
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

async function getAllThemes(): Promise<Theme[]> {
  const files = await readdir(RECIPES_DIR);
  return await Promise.all(
    files.filter(f => f.endsWith(".json")).map(async (file) => {
      return await Bun.file(join(RECIPES_DIR, file)).json();
    })
  );
}

// Template Helpers
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
async function buildHomepage(template: string, cardTemplate: string) {
  const themes = await getSortedThemes(9);
  const themesGrid = themes.map(t => generateThemeCard(t, cardTemplate)).join("\n");
  
  const html = applyBaseTemplate(template, {
    themesGrid,
    mainCssPath: PATHS.mainCss,
    extraCssPaths: [PATHS.cardCss]
  });

  await Bun.write(join(BUILD_DIR, "index.html"), html);
  console.log("Generated index.html");
}

async function buildAllThemesPage(template: string, cardTemplate: string, searchBarHtml: string) {
  const allThemes = await getAllThemes();
  allThemes.sort((a, b) => a.name.localeCompare(b.name));

  const themesGrid = allThemes.map(t => generateThemeCard(t, cardTemplate, "../")).join("\n");
  
  const html = applyBaseTemplate(template, {
    themesGrid,
    searchBar: searchBarHtml,
    mainCssPath: `../${PATHS.mainCss}`,
    extraCssPaths: [`../${PATHS.searchCss}`, `../${PATHS.cardCss}`]
  });

  const destDir = join(BUILD_DIR, "themes");
  await mkdir(destDir, { recursive: true });
  await Bun.write(join(destDir, "index.html"), html);
  console.log("Generated themes/index.html");
}

async function buildThemeDetailPages(template: string, contentTemplate: string) {
  const themes = await getAllThemes();
  const mainCssPath = `../${PATHS.mainCss}`;
  const detailCssPath = `../${PATHS.detailCss}`;

  for (const theme of themes) {
    const themeImgsDir = join(PATHS.imagesSrc, theme.id);
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

    await Bun.write(join(BUILD_DIR, `themes/${theme.id}.html`), html);
    console.log(`Generated themes/${theme.id}.html`);
  }
}

async function buildAboutPage(template: string, aboutContentHtml: string) {
  const html = applyBaseTemplate(template, {
    themesGrid: aboutContentHtml,
    mainCssPath: PATHS.mainCss
  });

  await Bun.write(join(BUILD_DIR, "about.html"), html);
  console.log("Generated about.html");
}

// Utility
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

async function build() {
  console.log("Starting build...");

  await rm(BUILD_DIR, { recursive: true, force: true });
  await mkdir(BUILD_DIR, { recursive: true });

  const [baseTemplate, cardTemplate, searchBarHtml, detailContentTemplate, aboutContentHtml] = await Promise.all([
    Bun.file(PATHS.indexTemplate).text(),
    Bun.file(PATHS.themeCardTemplate).text(),
    Bun.file(PATHS.searchBarTemplate).text(),
    Bun.file(PATHS.themeDetailContentTemplate).text(),
    Bun.file(PATHS.aboutTemplate).text(),
  ]);

  await buildHomepage(baseTemplate, cardTemplate);
  await buildAllThemesPage(baseTemplate, cardTemplate, searchBarHtml);
  await buildThemeDetailPages(baseTemplate, detailContentTemplate);
  await buildAboutPage(baseTemplate, aboutContentHtml);

  console.log("Copying assets...");
  await Promise.all([
    copyDir(PATHS.imagesSrc, PATHS.imagesDest),
    copyDir(CSS_DIR, PATHS.cssDest),
    copyFile(PATHS.faviconSrc, PATHS.faviconDest).catch(err => console.warn("Warning copying favicon:", err.message))
  ]);

  console.log("Build complete!");
}

if (import.meta.main) {
  build().catch(console.error);
}