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

  // 2. Get Data
  const themes = await getSortedThemes();
  console.log(`Found ${themes.length} themes.`);

  // 3. Prepare HTML
  const templatePath = join(TEMPLATES_DIR, "html/index.html");
  let html = await Bun.file(templatePath).text();

  const themesGridHtml = themes.map(generateThemeCard).join("\n");

  // Inject CSS Link
  const cssLink = `<link rel="stylesheet" href="static/css/style.css">`;

  html = html
    .replace("{{THEMES_GRID}}", themesGridHtml)
    .replace("{{CSS_INJECTION}}", cssLink);

  // 4. Write HTML
  await Bun.write(join(BUILD_DIR, "index.html"), html);
  console.log("Generated index.html");

  // 5. Copy Assets
  console.log("Copying assets...");
  await copyDir(STATIC_IMGS_SRC, STATIC_IMGS_DEST);
  await copyDir(CSS_SRC, CSS_DEST);

  console.log("Build complete!");
}

if (import.meta.main) {
  build().catch(console.error);
}
