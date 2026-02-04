import { mkdir, readdir, copyFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const RECIPIES_DIR = "recipies";
const BUILD_DIR = "build";
const TEMPLATES_DIR = "src/templates";
const STATIC_IMGS_SRC = "static/imgs";
const STATIC_IMGS_DEST = join(BUILD_DIR, "static/imgs");
const CSS_SRC = join(TEMPLATES_DIR, "css");
const CSS_DEST = join(BUILD_DIR, "static/css");

interface Theme {
  name: string;
  id: string;
  description: string;
  repoUrl: string;
  // Add other fields if needed for the template
}

async function getSortedThemes(): Promise<Theme[]> {
  const files = await readdir(RECIPIES_DIR);
  const themeFiles = files.filter(f => f.endsWith(".json"));

  const themesWithStats = await Promise.all(
    themeFiles.map(async (file) => {
      const filePath = join(RECIPIES_DIR, file);
      const stats = await stat(filePath);
      const content = await Bun.file(filePath).json();
      return {
        ...content,
        mtime: stats.mtime.getTime()
      };
    })
  );

  // Sort by newest (descending mtime) and take top 9
  return themesWithStats
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 9);
}

async function getAllThemes(): Promise<Theme[]> {
  const files = await readdir(RECIPIES_DIR);
  const themeFiles = files.filter(f => f.endsWith(".json"));

  return await Promise.all(
    themeFiles.map(async (file) => {
      const filePath = join(RECIPIES_DIR, file);
      return await Bun.file(filePath).json();
    })
  );
}

function generateThemeCard(theme: Theme): string {
  // Assuming the structure from the original HTML
  // Image path: static/imgs/<theme-id>/preview.png
  const imagePath = `static/imgs/${theme.id}/preview.png`;

  return `
        <article class="card">
          <img src="${imagePath}" alt="Preview of ${theme.name} theme" loading="lazy" />
          <div class="content">
            <h2>${theme.name}</h2>
            <p>${theme.description}</p>
            <a href="${theme.repoUrl}" target="_blank" rel="noopener noreferrer" aria-label="View ${theme.name} theme details">View details</a>
          </div>
        </article>`;
}

const SEARCH_BAR_HTML = `
      <form class="searchbar" role="search" aria-label="Search themes">
        <label for="q">Search</label>
        <input id="q" name="q" type="search" placeholder="Try: nord, gruvbox, light…" />
        <button type="submit">Search</button>
        <p class="sr-only" id="search-hint">Type a theme name or keyword and press Enter.</p>
      </form>`;

async function buildAllThemesPage(template: string, year: string, cssLink: string) {
  const allThemes = await getAllThemes();
  allThemes.sort((a, b) => a.name.localeCompare(b.name));

  const themesGridHtml = allThemes.map(generateThemeCard).join("\n");

  const extraCss = `<link rel="stylesheet" href="../static/css/search.css">`;

  const html = template
    .replace("{{THEMES_GRID}}", themesGridHtml)
    .replace("{{MAIN_CSS}}", cssLink)
    .replace("{{EXTRA_CSS}}", extraCss)
    .replace("{{YEAR}}", year)
    .replace("{{SEARCH_BAR}}", SEARCH_BAR_HTML);

  const destDir = join(BUILD_DIR, "themes");
  await mkdir(destDir, { recursive: true });
  await Bun.write(join(destDir, "index.html"), html);
  console.log("Generated themes/index.html");
}

async function buildHomepage(template: string, year: string, cssLink: string) {
  const themes = await getSortedThemes();
  const themesGridHtml = themes.map(generateThemeCard).join("\n");
  const html = template
    .replace("{{THEMES_GRID}}", themesGridHtml)
    .replace("{{MAIN_CSS}}", cssLink)
    .replace("{{EXTRA_CSS}}", "")
    .replace("{{YEAR}}", year)
    .replace("{{SEARCH_BAR}}", "");

  await Bun.write(join(BUILD_DIR, "index.html"), html);
  console.log("Generated index.html");
}

async function copyDir(src: string, dest: string) {
  try {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  } catch (err) {
    // It's possible the source dir doesn't exist (e.g. no images yet), just warn
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Warning copying ${src} to ${dest}:`, message);
  }
}

async function build() {
  console.log("Starting build...");

  // 1. Clean and Create Build Dir
  await rm(BUILD_DIR, { recursive: true, force: true });
  await mkdir(BUILD_DIR, { recursive: true });
  await mkdir(STATIC_IMGS_DEST, { recursive: true });
  await mkdir(CSS_DEST, { recursive: true });

  // 2. Prepare Shared Data
  const templatePath = join(TEMPLATES_DIR, "html/index.html");
  const template = await Bun.file(templatePath).text();
  const currentYear = new Date().getFullYear().toString();
  const cssLink = `<link rel="stylesheet" href="static/css/style.css">`;
  const themesCssLink = `<link rel="stylesheet" href="../static/css/style.css">`;

  // 3. Build Pages
  await buildHomepage(template, currentYear, cssLink);
  await buildAllThemesPage(template, currentYear, themesCssLink);

  // 4. Copy Assets
  console.log("Copying assets...");
  await copyDir(STATIC_IMGS_SRC, STATIC_IMGS_DEST);
  await copyDir(CSS_SRC, CSS_DEST);

  console.log("Build complete!");
}

if (import.meta.main) {
  build().catch(console.error);
}
