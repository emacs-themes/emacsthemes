import { mkdir } from "node:fs/promises";
import { join, basename, resolve } from "node:path";
import { ThemeSchema } from "./schema-checker";

const RECIPES_DIR = "recipies";
const IMAGES_DIR = "static/imgs";
const TEMP_DIR = ".tmp/theme-gen";

/**
 * Retrieves a list of files changed in the last git commit (HEAD).
 * Uses `git diff-tree` to identify added or modified files.
 *
 * @returns {Promise<string[]>} A promise that resolves to an array of file paths.
 */
export async function getChangedFilesFromLastCommit(): Promise<string[]> {
  const proc = Bun.spawn(["git", "diff-tree", "--no-commit-id", "--name-only", "-r", "--diff-filter=AM", "HEAD"], {
    stdout: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  return output.split("\n").map(f => f.trim()).filter(f => f.length > 0);
}

/**
 * Downloads theme files from the provided URLs to the specified directory.
 *
 * @param {string[]} rawUrls - An array of URLs pointing to the raw theme files.
 * @param {string} themeDir - The directory where the files should be saved.
 * @returns {Promise<void>} A promise that resolves when all files are downloaded.
 * @throws {Error} If a download fails.
 */
export async function downloadThemeFiles(rawUrls: string[], themeDir: string): Promise<void> {
  for (const url of rawUrls) {
    console.log(`  Downloading ${url}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    const filename = basename(url);
    await Bun.write(join(themeDir, filename), await res.arrayBuffer());
  }
}

/**
 * Generates the Emacs configuration (init.el) content for loading the theme.
 *
 * @param {string} elisp - The specific Elisp code to load the theme.
 * @param {string} themeDir - The directory containing the theme files.
 * @returns {string} The complete content for the init.el file.
 */
export function generateEmacsConfig(elisp: string, themeDir: string): string {
  return `
    (add-to-list 'load-path "${resolve(themeDir)}")
    (setq inhibit-splash-screen t)
    (setq initial-scratch-message nil)
    (menu-bar-mode -1)
    (tool-bar-mode -1)
    (scroll-bar-mode -1)
    (set-face-attribute 'default nil :height 140)

    ;; Some themes require 'cl or 'cl-lib, ensure they are loaded if needed, though usually automatic.

    (condition-case err
        (progn
          ${elisp}
          (dired "${resolve(themeDir)}"))
      (error (message "Error loading theme: %s" err)))

    (setq default-directory "${resolve(themeDir)}")
    (redisplay t)
  `;
}

/**
 * Captures a screenshot of the Emacs window with the loaded theme.
 * Uses `xvfb-run` to run Emacs in a headless environment and `import` to capture the screen.
 *
 * @param {string} initElPath - The path to the Emacs configuration file.
 * @param {string} imagePath - The path where the screenshot should be saved.
 * @returns {Promise<boolean>} True if the screenshot was successfully generated, false otherwise.
 */
export async function captureScreenshot(initElPath: string, imagePath: string): Promise<boolean> {
  // Check for xvfb-run
  const hasXvfb = (await Bun.spawn(["which", "xvfb-run"]).exited) === 0;

  if (!hasXvfb) {
    console.log("  xvfb-run not found. Skipping screenshot generation (Environment missing).");
    return false;
  }

  console.log(`  Generating screenshot...`);

  // Wrapper script to orchestrate Emacs and Import
  const wrapperCmd = `
    emacs -Q -l "${initElPath}" &
    EMACS_PID=$!

    # Wait for emacs window to appear
    # We simply sleep for now. A better way uses xdotool or xwininfo loop.
    sleep 5

    # Capture the root window (since xvfb-run sets up a dedicated display/server)
    import -window root "${resolve(imagePath)}"

    kill $EMACS_PID
  `;

  try {
    const proc = Bun.spawn(["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1280x960x24", "bash", "-c", wrapperCmd], {
      stdout: "inherit",
      stderr: "inherit"
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      console.error(`  xvfb-run exited with code ${exitCode}`);
      return false;
    }
  } catch (err) {
    console.error(`  Error running subprocess: ${err}`);
    return false;
  }

  if (await Bun.file(imagePath).exists()) {
    const stats = await Bun.file(imagePath).stat();
    if (stats.size > 0) {
      console.log(`  ✅ Generated ${imagePath} (${stats.size} bytes)`);
      return true;
    }
  }

  return false;
}

/**
 * Processes a single theme recipe: validates, downloads, and generates a screenshot.
 *
 * @param {string} recipePath - The path to the recipe JSON file.
 * @returns {Promise<{ status: 'skipped' | 'success' | 'failed', name: string }>} The result of the operation and the theme name.
 */
export async function processRecipe(recipePath: string): Promise<{ status: 'skipped' | 'success' | 'failed'; name: string }> {
  let json;
  try {
    const file = Bun.file(recipePath);
    json = await file.json();
  } catch (e) {
    console.error(`Failed to parse JSON for ${recipePath}:`, e);
    return { status: 'failed', name: basename(recipePath) };
  }

  const parseResult = ThemeSchema.safeParse(json);

  if (!parseResult.success) {
    console.error(`Invalid schema for ${recipePath}`);
    return { status: 'failed', name: basename(recipePath) };
  }

  const theme = parseResult.data;
  const themeName = theme.name;

  // Sanitize name for filename
  const safeName = themeName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const imageFilename = `${safeName}.png`;
  const imagePath = join(IMAGES_DIR, imageFilename);

  if (await Bun.file(imagePath).exists()) {
    const stats = await Bun.file(imagePath).stat();
    if (stats.size > 0) {
      return { status: 'skipped', name: themeName };
    }
  }

  console.log(`Processing ${themeName}...`);

  // Create temp dir for this theme
  const themeDir = join(TEMP_DIR, safeName);
  await mkdir(themeDir, { recursive: true });

  try {
    await downloadThemeFiles(theme.rawUrls, themeDir);
  } catch (err) {
    console.error(`  Error downloading files: ${err}`);
    return { status: 'failed', name: themeName };
  }

  // Create init.el
  const initElPath = join(themeDir, "init.el");
  const initContent = generateEmacsConfig(theme.elisp, themeDir);
  await Bun.write(initElPath, initContent);

  const success = await captureScreenshot(initElPath, imagePath);

  if (success) {
    return { status: 'success', name: themeName };
  } else {
    console.error(`  ❌ Failed to generate image for ${themeName}`);
    return { status: 'failed', name: themeName };
  }
}

/**
 * Main entry point for the screenshot generation script.
 * Scans for changed recipes and triggers processing for each.
 */
export async function main() {
  console.log("Starting screenshot generation...");

  // Ensure directories exist
  await mkdir(IMAGES_DIR, { recursive: true });
  await mkdir(TEMP_DIR, { recursive: true });

  // Get changed files from the last commit
  let files: string[] = [];
  try {
    files = await getChangedFilesFromLastCommit();
  } catch (e) {
    console.error(`Error getting changed files from git: ${e}`);
    process.exit(1);
  }

  const recipes = files
    .filter((f) => f.startsWith(`${RECIPES_DIR}/`))
    .map((f) => basename(f));

  console.log(`Found ${recipes.length} recipes.`);

  const successThemes: string[] = [];
  const failedThemes: string[] = [];
  const skippedThemes: string[] = [];

  for (const recipeFile of recipes) {
    const recipePath = join(RECIPES_DIR, recipeFile);
    try {
      const { status, name } = await processRecipe(recipePath);
      if (status === 'skipped') skippedThemes.push(name);
      else if (status === 'success') successThemes.push(name);
      else failedThemes.push(name);
    } catch (e) {
      console.error(`Failed to process ${recipeFile}:`, e);
      failedThemes.push(recipeFile);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Skipped (${skippedThemes.length}): ${skippedThemes.join(", ") || "None"}`);
  console.log(`  Success (${successThemes.length}): ${successThemes.join(", ") || "None"}`);
  console.log(`  Failed  (${failedThemes.length}):  ${failedThemes.join(", ") || "None"}`);

  if (failedThemes.length > 0) process.exit(1);
}

if (import.meta.main) {
  main().catch(console.error);
}
