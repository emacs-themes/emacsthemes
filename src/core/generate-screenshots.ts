import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join, basename, resolve } from "node:path";
import { ThemeSchema, Theme } from "./schema-checker";
import { RECIPES_DIR, MODE_SAMPLES, ModeConfig } from "./constants";

const IMAGES_DIR = "static/imgs";
const TEMP_DIR = ".tmp/theme-gen";
const INIT_TEMPLATE_PATH = "src/elisp/init-template.el";
const MODES_SAMPLES_DIR = "src/elisp/modes";

/**
 * Downloads raw theme files from a list of URLs and saves them to a local directory.
 *
 * @param {string[]} rawUrls - An array of absolute URLs to the raw theme Elisp files.
 * @param {string} themeDir - The local directory path where files should be saved.
 * @returns {Promise<void>} Resolves when all files are successfully downloaded and written.
 * @throws {Error} If any download fails or the response is not OK.
 */
async function downloadThemeFiles(rawUrls: string[], themeDir: string): Promise<void> {
  for (const url of rawUrls) {
    console.log(`  Downloading ${url}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    const filename = basename(url);
    await Bun.write(join(themeDir, filename), await res.arrayBuffer());
  }
}

/**
 * Searches a directory for Emacs Lisp files and attempts to extract the theme's
 * internal name using common Emacs Lisp patterns like (deftheme ...) or (provide-theme ...).
 *
 * @param {string} dir - The directory path to scan for theme files.
 * @returns {Promise<string | null>} The detected theme name symbol as a string, or null if not found.
 */
async function findThemeNameInDir(dir: string): Promise<string | null> {
  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".el")) continue;

      const content = await Bun.file(join(dir, file)).text();
      const match = content.match(/\(deftheme\s+'?([^',)\s][^)\s]*)/);
      if (match) return match[1];

      const matchProvide = content.match(/\(provide-theme\s+'?([^',)\s][^)\s]*)\)/);
      if (matchProvide) return matchProvide[1];
    }
  } catch (e) {
    console.error(`Error scanning for theme name in ${dir}:`, e);
  }
  return null;
}

/**
 * Constructs the content for an Emacs initialization file (init.el) by merging
 * a base template with theme-specific configurations and mode-specific display logic.
 *
 * It supports both standard mode opening (find-file) and specialized instruction files.
 *
 * @param {Theme} theme - The validated theme object from the recipe.
 * @param {string} themeDir - Path to the directory containing the theme's Elisp files.
 * @param {string} themeName - The internal Emacs symbol name for the theme.
 * @param {string} modeName - The name of the Emacs mode to showcase (e.g., 'python-mode').
 * @param {ModeConfig} config - Configuration object specifying the sample file and type.
 * @returns {Promise<string>} The complete, processed init.el content.
 */
async function generateInitEl(
  theme: Theme,
  themeDir: string,
  themeName: string,
  modeName: string,
  config: ModeConfig
): Promise<string> {
  const template = await readFile(INIT_TEMPLATE_PATH, "utf-8");
  const samplePath = join(MODES_SAMPLES_DIR, config.file);

  let modeSpecificLogic = "";
  if (config.isInstructionFile) {
    modeSpecificLogic = await readFile(samplePath, "utf-8");
  } else {
    const absoluteSamplePath = resolve(samplePath);
    const extraLogic = modeName === 'text-mode' ? '(linum-mode 1)' : '';
    modeSpecificLogic = `
(find-file "${absoluteSamplePath}")
(funcall '${modeName})
${extraLogic}
(delete-other-windows)
(log-debug "DEBUG EMACS: Opened ${config.file} in ${modeName}")
    `;
  }

  return template
    .replace(/{{THEME_DIR}}/g, resolve(themeDir))
    .replace(/{{THEME_NAME}}/g, themeName)
    .replace(/{{EXTRA_ELISP}}/g, theme.elisp || "")
    .replace(/{{MODE_SPECIFIC_LOGIC}}/g, modeSpecificLogic);
}

/**
 * Spawns a headless Emacs instance using Xvfb and captures a screenshot of the
 * rendered window using the 'import' utility from ImageMagick.
 *
 * @param {string} initElPath - Path to the init.el file to load into Emacs.
 * @param {string} imagePath - Target path where the generated PNG should be saved.
 * @returns {Promise<boolean>} True if the screenshot was successfully captured and saved, false otherwise.
 */
async function captureScreenshot(initElPath: string, imagePath: string): Promise<boolean> {
  const hasXvfb = (await Bun.spawn(["which", "xvfb-run"]).exited) === 0;

  if (!hasXvfb) {
    console.log("  xvfb-run not found. Skipping screenshot generation.");
    return false;
  }

  const wrapperCmd = `
    set -x
    emacs -Q -l "${initElPath}" &
    EMACS_PID=$!
    sleep 5
    if ! kill -0 $EMACS_PID 2>/dev/null; then
      exit 1
    fi
    import -window root "${resolve(imagePath)}"
    kill $EMACS_PID
  `;

  try {
    const proc = Bun.spawn(["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1280x960x24", "bash", "-c", wrapperCmd], {
      stdout: "ignore",
      stderr: "ignore"
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) return false;
  } catch {
    return false;
  }

  const file = Bun.file(imagePath);
  return (await file.exists()) && (await file.size) > 0;
}

/**
 * Generates a preview image by cropping the top-left corner of the source image.
 *
 * @param {string} sourcePath - Path to the source image.
 * @param {string} destPath - Path to save the preview image.
 * @returns {Promise<boolean>} True if successful.
 */
async function generatePreview(sourcePath: string, destPath: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["convert", sourcePath, "-crop", "320x160+0+0", destPath], {
      stdout: "ignore",
      stderr: "ignore"
    });

    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch (e) {
    console.error(`  Error generating preview for ${sourcePath}:`, e);
    return false;
  }
}

/**
 * Processes a single theme recipe by validating it, downloading its source files,
 * and generating screenshots for all configured Emacs modes.
 *
 * The process follows these steps:
 * 1. Read and validate the recipe JSON against the ThemeSchema.
 * 2. Check if screenshots for this theme already exist in the target directory; if so, skip.
 * 3. Create a temporary directory and download the theme's raw Elisp files.
 * 4. Auto-detect the internal Emacs theme name from the downloaded files.
 * 5. For each mode defined in MODE_SAMPLES, generate a custom init.el and capture a screenshot.
 * 6. Clean up the temporary source files.
 *
 * @param {string} recipePath - The file path to the theme recipe JSON.
 * @returns {Promise<{ status: 'skipped' | 'success' | 'failed', name: string }>}
 * An object containing the operation status and the theme name.
 */
async function processTheme(recipePath: string): Promise<{ status: 'skipped' | 'success' | 'failed', name: string }> {
  const file = Bun.file(recipePath);
  const json = await file.json();
  const parseResult = ThemeSchema.safeParse(json);

  if (!parseResult.success) {
    console.error(`Invalid schema for ${recipePath}`);
    return { status: 'failed', name: basename(recipePath) };
  }

  const theme = parseResult.data;
  const themeImagesDir = join(IMAGES_DIR, theme.id);

  // Skip if theme directory already exists
  try {
    const dirInfo = await Bun.file(themeImagesDir).stat();
    if (dirInfo) {
      console.log(`${theme.name} exists, skipping screenshot`);
      return { status: 'skipped', name: theme.name };
    }
  } catch {
    // Directory does not exist, proceed
  }

  console.log(`Processing theme: ${theme.name} (${theme.id})`);
  await mkdir(themeImagesDir, { recursive: true });

  const themeTempDir = join(TEMP_DIR, theme.id);
  await mkdir(themeTempDir, { recursive: true });

  try {
    await downloadThemeFiles(theme.rawUrls, themeTempDir);
    const detectedName = await findThemeNameInDir(themeTempDir);
    const emacsThemeName = detectedName || theme.name.toLowerCase().replace(/\s+/g, '-');

    for (const [modeName, config] of Object.entries(MODE_SAMPLES)) {
      console.log(`  Generating screenshot for ${modeName}...`);
      const imagePath = join(themeImagesDir, `${modeName}.png`);
      const initElPath = join(themeTempDir, `init-${modeName}.el`);

      const initContent = await generateInitEl(theme, themeTempDir, emacsThemeName, modeName, config);
      await Bun.write(initElPath, initContent);

      const success = await captureScreenshot(initElPath, imagePath);
      if (!success) {
        console.error(`  ❌ Failed to generate screenshot for ${modeName}`);
      } else {
        console.log(`  ✅ Successfully generated screenshot for ${modeName}`);

        if (modeName === 'emacs-lisp-mode') {
          console.log(`  Generating preview for ${theme.name}...`);
          const previewPath = join(themeImagesDir, 'preview.png');
          const previewSuccess = await generatePreview(imagePath, previewPath);
          if (previewSuccess) {
            console.log(`  ✅ Successfully generated preview.png`);
          } else {
            console.error(`  ❌ Failed to generate preview.png`);
          }
        }
      }
    }

    return { status: 'success', name: theme.name };
  } catch (err) {
    console.error(`  Error processing theme ${theme.name}:`, err);
    return { status: 'failed', name: theme.name };
  } finally {
    try {
      await rm(themeTempDir, { recursive: true, force: true });
      console.log(`  Cleaned up ${themeTempDir}`);
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Orchestrates the entire screenshot generation workflow.
 *
 * Performs the following actions:
 * 1. Ensures required output and temporary directories exist.
 * 2. Scans the recipes directory for JSON theme definitions.
 * 3. Processes each theme sequentially to generate screenshots for all supported modes.
 * 4. Outputs a summary of successful, skipped, and failed operations.
 * 5. Exits with a non-zero code if any theme fails to process.
 */
async function main() {
  await mkdir(IMAGES_DIR, { recursive: true });
  await mkdir(TEMP_DIR, { recursive: true });

  const files = await readdir(RECIPES_DIR);
  const recipes = files.filter(f => f.endsWith(".json"));

  console.log(`Found ${recipes.length} recipes.`);

  const results = { skipped: 0, success: 0, failed: 0 };

  for (const recipeFile of recipes) {
    const { status } = await processTheme(join(RECIPES_DIR, recipeFile));
    results[status]++;
  }

  console.log(`\nSummary: Skipped: ${results.skipped}, Success: ${results.success}, Failed: ${results.failed}`);
  if (results.failed > 0) process.exit(1);
}

if (import.meta.main) {
  main().catch(console.error);
}
