import { mkdir, readdir, readFile, rm, copyFile } from "node:fs/promises";
import { join, basename, resolve } from "node:path";
import { Theme, validateRecipeStrict } from "./schema-checker";
import { RECIPES_DIR, MODE_SAMPLES, ModeConfig } from "./constants";
import { assertPathWithinRoot } from "./path-utils";

const IMAGES_DIR = "static/imgs";
const TEMP_DIR = ".tmp/theme-gen";
const INIT_TEMPLATE_PATH = "src/elisp/init-template.el";
const MODES_SAMPLES_DIR = "src/elisp/modes";
const LOCAL_THEMES_DIR = "static/themes";

/**
 * Represents the parsed command-line arguments for the screenshot generation script.
 */
interface Arguments {
  /**
   * The ID of a specific theme to process (e.g., 'zenburn').
   * If null, all recipes in the recipes directory will be processed.
   */
  targetThemeId: string | null;

  /**
   * Whether to force the generation of screenshots even if they already exist
   * in the output directory.
   */
  force: boolean;
}

/**
 * Parses command-line arguments to extract theme filtering and force flags.
 *
 * @returns {Arguments} An object containing the parsed arguments.
 */
function parseCliArgs(): Arguments {
  let targetThemeId: string | null = null;
  let force = false;

  for (let i = 0; i < Bun.argv.length; i++) {
    const arg = Bun.argv[i];
    if (arg === "--file") {
      targetThemeId = Bun.argv[i + 1] || null;
      i++; // Skip next arg
    } else if (arg.startsWith("--file=")) {
      targetThemeId = arg.split("=")[1] || null;
    } else if (arg === "--force") {
      force = true;
    }
  }

  return { targetThemeId, force };
}

/**
 * Recursively copies a directory and its contents to a destination.
 *
 * @param {string} src - The source directory path.
 * @param {string} dest - The destination directory path.
 */
async function copyDir(src: string, dest: string) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(srcPath, destPath);
    else await copyFile(srcPath, destPath);
  }
}

/**
 * Checks whether a recipe raw URL points to a local bundled theme file.
 *
 * @param {string} rawUrl - A recipe raw URL value.
 * @returns {boolean} True when the value points to `static/themes/...`.
 */
function isLocalThemePath(rawUrl: string): boolean {
  return rawUrl.startsWith(`${LOCAL_THEMES_DIR}/`);
}

/**
 * Resolves and validates a local theme source path against the `static/themes` boundary.
 *
 * @param {string} source - Local recipe source path.
 * @returns {string} Absolute, validated path to the local theme file.
 * @throws {Error} If the path escapes the `static/themes` directory.
 */
function resolveValidatedLocalThemePath(source: string): string {
  // Strip the prefix if it exists to avoid double-joining in assertPathWithinRoot
  const relativePath = source.startsWith(`${LOCAL_THEMES_DIR}/`)
    ? source.slice(LOCAL_THEMES_DIR.length + 1)
    : source;
  return assertPathWithinRoot(LOCAL_THEMES_DIR, relativePath);
}

/**
 * Copies a local theme file from `static/themes` into the temporary theme directory.
 *
 * @param {string} source - Local recipe source path.
 * @param {string} themeDir - Temporary destination directory for this theme.
 * @returns {Promise<string>} The filename of the copied file.
 * @throws {Error} If the source file does not exist.
 */
async function copyLocalThemeFile(source: string, themeDir: string): Promise<string> {
  const absoluteSourcePath = resolveValidatedLocalThemePath(source);
  const localFile = Bun.file(absoluteSourcePath);

  if (!(await localFile.exists())) {
    throw new Error(`Local theme file not found: ${source}`);
  }

  console.log(`  Copying local theme file ${source}...`);
  const filename = basename(source);
  await Bun.write(join(themeDir, filename), await localFile.arrayBuffer());
  return filename;
}

/**
 * Downloads a remote theme file into the temporary theme directory.
 *
 * @param {string} source - Absolute HTTP(S) URL to the theme file.
 * @param {string} themeDir - Temporary destination directory for this theme.
 * @returns {Promise<string>} The filename of the downloaded file.
 * @throws {Error} If the HTTP request fails.
 */
async function downloadRemoteThemeFile(source: string, themeDir: string): Promise<string> {
  console.log(`  Downloading ${source}...`);
  const res = await fetch(source);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${source}: ${res.statusText}`);
  }

  // Strip query parameters and fragments to get a clean filename
  const urlObj = new URL(source);
  const filename = basename(urlObj.pathname);

  await Bun.write(join(themeDir, filename), await res.arrayBuffer());
  return filename;
}

/**
 * Materializes a single recipe source into the temporary theme directory.
 *
 * @param {string} source - Recipe source value, either local or remote.
 * @param {string} themeDir - Temporary destination directory for this theme.
 * @returns {Promise<string>} The filename of the materialized file.
 */
async function materializeThemeSource(source: string, themeDir: string): Promise<string> {
  if (isLocalThemePath(source)) {
    return await copyLocalThemeFile(source, themeDir);
  }

  return await downloadRemoteThemeFile(source, themeDir);
}

/**
 * Downloads raw theme files from recipe sources and saves them to a local directory.
 *
 * Supports both absolute HTTP(S) URLs and local `static/themes/...` paths.
 *
 * @param {string[]} rawUrls - An array of recipe raw URLs or local theme paths.
 * @param {string} themeDir - The local directory path where files should be saved.
 * @returns {Promise<string[]>} Resolves with the list of filenames downloaded.
 * @throws {Error} If any source cannot be fetched/read or violates the local path boundary.
 */
async function downloadThemeFiles(rawUrls: string[], themeDir: string): Promise<string[]> {
  const files: string[] = [];
  for (const source of rawUrls) {
    const filename = await materializeThemeSource(source, themeDir);
    files.push(filename);
  }
  return files;
}

/**
 * Prepares files for a theme that is stored locally within the project.
 *
 * It identifies the correct source folder under `static/themes`, copies its
 * entire content to the temporary processing directory, and returns the
 * basenames of the files that should be loaded.
 *
 * @param {Theme} theme - The theme object containing the 'local' repository URL.
 * @param {string} themeTempDir - The temporary working directory for this theme.
 * @returns {Promise<string[]>} A list of filenames (basenames) to be loaded by Emacs.
 */
async function prepareLocalThemeFiles(theme: Theme, themeTempDir: string): Promise<string[]> {
  const firstRawUrl = theme.rawUrls[0];
  const match = firstRawUrl.match(/^static\/themes\/([^/]+)\//);
  const folderName = match ? match[1] : theme.id;
  const localThemeDir = assertPathWithinRoot(LOCAL_THEMES_DIR, folderName);

  console.log(`  Copying local theme directory from ${localThemeDir}...`);
  await copyDir(localThemeDir, themeTempDir);

  // For local themes, we use the rawUrls list to determine what specific files to load
  return theme.rawUrls.map((url) => basename(url));
}

/**
 * Orchestrates the preparation of theme files based on their source (local or remote).
 *
 * This is a high-level dispatcher that ensures the temporary processing directory
 * is populated with the necessary Elisp files before screenshot generation begins.
 *
 * @param {Theme} theme - The validated theme object from the recipe.
 * @param {string} themeTempDir - The temporary directory where files should be placed.
 * @returns {Promise<string[]>} A list of filenames that should be loaded in Emacs.
 */
async function prepareThemeFiles(theme: Theme, themeTempDir: string): Promise<string[]> {
  if (theme.repoUrl === "local") {
    return await prepareLocalThemeFiles(theme, themeTempDir);
  }
  return await downloadThemeFiles(theme.rawUrls, themeTempDir);
}

/**
 * Searches a directory (or a specific list of files) for Emacs Lisp files and attempts
 * to extract the theme's internal name using common Emacs Lisp patterns.
 *
 * @param {string} dir - The directory path to scan for theme files.
 * @param {string[]} [filesToSearch] - Optional list of specific filenames to scan.
 * @returns {Promise<string | null>} The detected theme name symbol as a string, or null if not found.
 */
async function findThemeNameInDir(dir: string, filesToSearch?: string[]): Promise<string | null> {
  try {
    const files = filesToSearch || await readdir(dir);
    // Sort files to prioritize those that end with -theme.el
    const sortedFiles = [...files].sort((a, b) => {
      const aIsTheme = a.endsWith("-theme.el");
      const bIsTheme = b.endsWith("-theme.el");
      if (aIsTheme && !bIsTheme) return -1;
      if (!aIsTheme && bIsTheme) return 1;
      return a.localeCompare(b);
    });

    for (const file of sortedFiles) {
      if (!file.endsWith(".el")) continue;

      const content = await Bun.file(join(dir, file)).text();
      // Look for (deftheme theme-name ...)
      const match = content.match(/\(deftheme\s+'?([^',)\s][^)\s]*)/);
      if (match) return match[1];

      // Look for (provide-theme 'theme-name)
      const matchProvide = content.match(/\(provide-theme\s+'?([^',)\s][^)\s]*)\)/);
      if (matchProvide) {
        const name = matchProvide[1];
        // Skip generic variable names often found in templates or helper functions
        if (name === "name" || name === "theme-name" || name === "theme" || name === "symbol") continue;
        return name;
      }
    }
  } catch (e) {
    console.error(`Error scanning for theme name in ${dir}:`, e);
  }
  return null;
}

/**
 * Generates the mode-specific Emacs Lisp logic for the initialization file.
 *
 * It handles both instruction files (complex scripts) and standard file opening
 * for basic modes. For instruction files, it replaces the `{{SAMPLE_PATH}}` placeholder
 * with an absolute path to the target sample file.
 *
 * @param {string} modeName - The name of the Emacs mode.
 * @param {ModeConfig} config - The configuration for the mode.
 * @returns {Promise<string>} The generated Elisp logic.
 */
async function getModeSpecificLogic(modeName: string, config: ModeConfig): Promise<string> {
  const samplePath = join(MODES_SAMPLES_DIR, config.file);

  if (config.isInstructionFile) {
    let logic = await readFile(samplePath, "utf-8");
    if (config.sampleFile) {
      const absoluteSamplePath = resolve(join(MODES_SAMPLES_DIR, config.sampleFile));
      logic = logic.replace(/{{SAMPLE_PATH}}/g, absoluteSamplePath);
    }
    return logic;
  }

  const absoluteSamplePath = resolve(samplePath);
  const extraLogic = modeName === "text-mode" ? "(display-line-numbers-mode 1)" : "";

  return `
(find-file "${absoluteSamplePath}")
(funcall '${modeName})
${extraLogic}
(delete-other-windows)
(log-debug "Opened ${config.file} in ${modeName}")
    `;
}

/**
 * Generates the Elisp code required to load theme files into Emacs.
 *
 * Each file is loaded using `load-file` and wrapped in a `condition-case` to
 * ensure that errors in individual files don't prevent the entire theme from loading.
 *
 * @param {string} themeDir - The directory containing the theme files.
 * @param {string[]} filesToLoad - The list of filenames to load.
 * @returns {string} The generated Elisp code.
 */
function getLoadFilesElisp(themeDir: string, filesToLoad: string[]): string {
  return filesToLoad
    .filter((f) => f.endsWith(".el"))
    .map(
      (f) => `
(condition-case err
    (load-file "${resolve(join(themeDir, f))}")
  (error (log-debug "Failed to load ${f}: %s" err)))`
    )
    .join("\n");
}

/**
 * Constructs the content for an Emacs initialization file (init.el) by merging
 * a base template with theme-specific configurations and mode-specific display logic.
 *
 * @param {Theme} theme - The validated theme object from the recipe.
 * @param {string} themeDir - Path to the directory containing the theme's Elisp files.
 * @param {string[]} filesToLoad - List of files to explicitly load.
 * @param {string} themeName - The internal Emacs symbol name for the theme.
 * @param {string} modeName - The name of the Emacs mode to showcase (e.g., 'python-mode').
 * @param {ModeConfig} config - Configuration object specifying the sample file and type.
 * @param {string} readyFilePath - Path to the 'ready' file that Emacs will create.
 * @returns {Promise<string>} The complete, processed init.el content.
 */
async function generateInitEl(
  theme: Theme,
  themeDir: string,
  filesToLoad: string[],
  themeName: string,
  modeName: string,
  config: ModeConfig,
  readyFilePath: string
): Promise<string> {
  const template = await readFile(INIT_TEMPLATE_PATH, "utf-8");
  const modeSpecificLogic = await getModeSpecificLogic(modeName, config);
  const loadFilesElisp = getLoadFilesElisp(themeDir, filesToLoad);

  return template
    .replace(/{{THEME_DIR}}/g, resolve(themeDir))
    .replace(/{{LOAD_THEME_FILES}}/g, loadFilesElisp)
    .replace(/{{THEME_FILES}}/g, filesToLoad.filter((f) => f.endsWith(".el")).join(" "))
    .replace(/{{THEME_NAME}}/g, themeName)
    .replace(/{{ELISP_BEFORE}}/g, theme.elispBefore || "")
    .replace(/{{ELISP_AFTER}}/g, theme.elispAfter || "")
    .replace(/{{READY_FILE}}/g, resolve(readyFilePath))
    .replace(/{{MODE_SPECIFIC_LOGIC}}/g, modeSpecificLogic);
}

/**
 * Checks if the 'xvfb-run' utility is available on the system.
 *
 * @returns {Promise<boolean>} True if xvfb-run is found.
 */
async function checkXvfbAvailability(): Promise<boolean> {
  const result = await Bun.spawn(["which", "xvfb-run"]).exited;
  if (result !== 0) {
    console.log("  xvfb-run not found. Skipping screenshot generation.");
    return false;
  }
  return true;
}

/**
 * Generates the shell script used to orchestrate Emacs rendering and capture.
 *
 * The script:
 * 1. Starts Emacs in the background.
 * 2. Waits for Emacs to signal readiness by creating a 'ready' file.
 * 3. Uses ImageMagick's `import` tool to capture the root window.
 * 4. Cleans up by killing the Emacs process.
 *
 * @param {string} initElPath - Path to the initialization file.
 * @param {string} imagePath - Target path for the PNG screenshot.
 * @param {string} readyFilePath - Path to the readiness signal file.
 * @returns {string} The constructed bash script.
 */
function getCaptureShellScript(initElPath: string, imagePath: string, readyFilePath: string): string {
  return `
    emacs -Q -l "${initElPath}" &
    EMACS_PID=$!

    # Wait for the ready signal from Emacs or timeout after 60 seconds
    for i in {1..60}; do
      [ -f "${resolve(readyFilePath)}" ] && break
      sleep 1
    done

    if [ ! -f "${resolve(readyFilePath)}" ]; then
      echo "  ❌ Emacs failed to signal readiness within timeout"
      kill $EMACS_PID 2>/dev/null
      exit 1
    fi

    # Small additional buffer for rendering to settle
    sleep 2
    import -window root "${resolve(imagePath)}" 2>/dev/null
    kill $EMACS_PID 2>/dev/null
  `;
}

/**
 * Spawns a headless Emacs instance using Xvfb and captures a screenshot of the
 * rendered window using the 'import' utility from ImageMagick.
 *
 * @param {string} initElPath - Path to the init.el file to load into Emacs.
 * @param {string} imagePath - Target path where the generated PNG should be saved.
 * @param {string} readyFilePath - Path to the 'ready' file that Emacs will create.
 * @returns {Promise<boolean>} True if the screenshot was successfully captured and saved, false otherwise.
 */
async function captureScreenshot(initElPath: string, imagePath: string, readyFilePath: string): Promise<boolean> {
  if (!(await checkXvfbAvailability())) {
    return false;
  }

  const wrapperCmd = getCaptureShellScript(initElPath, imagePath, readyFilePath);

  try {
    const proc = Bun.spawn(["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1280x960x24", "bash", "-c", wrapperCmd], {
      stdout: "inherit",
      stderr: "inherit",
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
 * Reads and validates a theme recipe JSON file.
 *
 * @param {string} recipePath - Path to the recipe file.
 * @returns {Promise<Theme | null>} The validated theme object, or null if invalid.
 */
async function validateRecipe(recipePath: string): Promise<Theme | null> {
  try {
    const file = Bun.file(recipePath);
    const json = await file.json();
    const result = validateRecipeStrict(json);

    if (!result.success) {
      console.error(`❌ Validation failed for ${recipePath}:`);
      result.errors.forEach((err) => console.error(err));
      return null;
    }
    return result.data;
  } catch (err) {
    console.error(`Error reading recipe ${recipePath}:`, err);
    return null;
  }
}

/**
 * Determines if screenshot generation for a theme should be skipped.
 *
 * @param {string} themeName - Display name of the theme.
 * @param {string} themeImagesDir - Path to the directory where screenshots are stored.
 * @param {boolean} force - Whether to force regeneration.
 * @returns {Promise<boolean>} True if generation should be skipped.
 */
async function shouldSkipTheme(themeName: string, themeImagesDir: string, force: boolean): Promise<boolean> {
  if (force) return false;

  try {
    const dirInfo = await Bun.file(themeImagesDir).stat();
    if (dirInfo) {
      console.log(`${themeName} exists, skipping screenshot`);
      return true;
    }
  } catch {
    // Directory does not exist
  }
  return false;
}

/**
 * Processes a single Emacs mode for a theme: generates init.el, captures screenshot,
 * and optionally generates a preview image.
 *
 * @param {Theme} theme - The theme object.
 * @param {string} themeTempDir - Temporary working directory.
 * @param {string} themeImagesDir - Target images directory.
 * @param {string[]} filesToLoad - List of Elisp files to load.
 * @param {string} emacsThemeName - Internal Emacs name for the theme.
 * @param {string} modeName - Name of the mode (e.g., 'python-mode').
 * @param {ModeConfig} config - Configuration for the mode.
 * @returns {Promise<boolean>} True if successful.
 */
async function processThemeMode(
  theme: Theme,
  themeTempDir: string,
  themeImagesDir: string,
  filesToLoad: string[],
  emacsThemeName: string,
  modeName: string,
  config: ModeConfig
): Promise<boolean> {
  console.log(`  Generating screenshot for ${modeName}...`);
  const imagePath = join(themeImagesDir, `${modeName}.png`);
  const initElPath = join(themeTempDir, `init-${modeName}.el`);
  const readyFilePath = join(themeTempDir, `ready-${modeName}`);

  const initContent = await generateInitEl(theme, themeTempDir, filesToLoad, emacsThemeName, modeName, config, readyFilePath);
  await Bun.write(initElPath, initContent);

  const success = await captureScreenshot(initElPath, imagePath, readyFilePath);
  if (!success) {
    console.error(`  ❌ Failed to generate screenshot for ${modeName}`);
    return false;
  }

  console.log(`  ✅ Successfully generated screenshot for ${modeName}`);

  if (modeName === "emacs-lisp-mode") {
    console.log(`  Generating preview for ${theme.name}...`);
    const previewPath = join(themeImagesDir, "preview.png");
    const previewSuccess = await generatePreview(imagePath, previewPath);
    if (!previewSuccess) {
      console.error(`  ❌ Failed to generate preview.png`);
      return false;
    }
    console.log(`  ✅ Successfully generated preview.png`);
  }

  return true;
}

/**
 * Sets up the necessary directories for theme processing.
 *
 * Ensures that both the permanent images directory (for screenshots)
 * and the temporary working directory (for theme files) exist.
 *
 * @param {string} themeImagesDir - Target directory where PNG screenshots will be stored.
 * @param {string} themeTempDir - Temporary directory where Elisp files are downloaded and processed.
 */
async function setupThemeDirectories(themeImagesDir: string, themeTempDir: string): Promise<void> {
  await mkdir(themeImagesDir, { recursive: true });
  await mkdir(themeTempDir, { recursive: true });
}

/**
 * Iterates through all configured Emacs modes and captures screenshots for each.
 *
 * This function orchestrates the generation of `init.el` files and the execution
 * of headless Emacs instances for every mode defined in `MODE_SAMPLES`.
 *
 * @param {Theme} theme - The validated theme object from the recipe.
 * @param {string} themeTempDir - The temporary working directory for this theme.
 * @param {string} themeImagesDir - The target directory for the resulting screenshots.
 * @param {string[]} filesToLoad - A list of Elisp filenames that must be loaded.
 * @param {string} emacsThemeName - The internal Emacs symbol name for the theme.
 * @throws {Error} If screenshot generation fails for any mode.
 */
async function captureThemeScreenshots(
  theme: Theme,
  themeTempDir: string,
  themeImagesDir: string,
  filesToLoad: string[],
  emacsThemeName: string
): Promise<void> {
  for (const [modeName, config] of Object.entries(MODE_SAMPLES)) {
    const success = await processThemeMode(theme, themeTempDir, themeImagesDir, filesToLoad, emacsThemeName, modeName, config);
    if (!success) {
      throw new Error(`Failed to generate screenshot for ${modeName}`);
    }
  }
}

/**
 * Deletes the theme's image directory if processing fails.
 *
 * This is used to ensure we don't leave partial or broken screenshot sets
 * in the final output directory, which would prevent a retry without `--force`.
 *
 * @param {string} themeImagesDir - The directory containing (potentially partial) screenshots.
 * @param {string} themeName - The display name of the theme, used for logging.
 */
async function rollbackThemeProcessing(themeImagesDir: string, themeName: string): Promise<void> {
  try {
    await rm(themeImagesDir, { recursive: true, force: true });
    console.log(`  Rolled back: Deleted ${themeImagesDir} for theme ${themeName} due to failure.`);
  } catch (cleanupErr) {
    console.error(`  Failed to delete ${themeImagesDir} for theme ${themeName}:`, cleanupErr);
  }
}

/**
 * Removes the temporary directory used during theme processing.
 *
 * This function is called in the `finally` block to ensure that downloaded
 * theme files and generated initialization scripts are always cleaned up.
 *
 * @param {string} themeTempDir - The temporary directory to remove.
 */
async function cleanupThemeTemp(themeTempDir: string): Promise<void> {
  try {
    await rm(themeTempDir, { recursive: true, force: true });
    console.log(`  Cleaned up ${themeTempDir}`);
  } catch {
    // ignore cleanup errors
  }
}

/**
 * Processes a single theme recipe by validating it, downloading its source files,
 * and generating screenshots for all configured Emacs modes.
 *
 * @param {string} recipePath - The file path to the theme recipe JSON.
 * @param {boolean} [force=false] - Whether to force screenshot generation.
 * @returns {Promise<{ status: 'skipped' | 'success' | 'failed', name: string }>}
 */
async function processTheme(recipePath: string, force: boolean = false): Promise<{ status: "skipped" | "success" | "failed"; name: string }> {
  const theme = await validateRecipe(recipePath);
  if (!theme) {
    return { status: "failed", name: basename(recipePath) };
  }

  const themeImagesDir = assertPathWithinRoot(IMAGES_DIR, theme.id);
  if (await shouldSkipTheme(theme.name, themeImagesDir, force)) {
    return { status: "skipped", name: theme.name };
  }

  console.log(`Processing theme: ${theme.name} (${theme.id})`);
  const themeTempDir = assertPathWithinRoot(TEMP_DIR, theme.id);

  try {
    await setupThemeDirectories(themeImagesDir, themeTempDir);

    const filesToLoad = await prepareThemeFiles(theme, themeTempDir);
    const detectedName = await findThemeNameInDir(themeTempDir, filesToLoad);
    const emacsThemeName = detectedName || theme.id;

    await captureThemeScreenshots(theme, themeTempDir, themeImagesDir, filesToLoad, emacsThemeName);

    return { status: "success", name: theme.name };
  } catch (err) {
    console.error(`  Error processing theme ${theme.name}:`, err);
    await rollbackThemeProcessing(themeImagesDir, theme.name);
    return { status: "failed", name: theme.name };
  } finally {
    await cleanupThemeTemp(themeTempDir);
  }
}

/**
 * Scans the recipes directory for JSON files and applies filtering based on CLI arguments.
 *
 * If a `targetThemeId` is provided, it attempts to find exactly one matching recipe file.
 * If the specific recipe is not found, it logs an error and terminates the process.
 * Otherwise, it returns all JSON recipes found in the directory.
 *
 * @param {string | null} targetThemeId - Optional theme ID (e.g., 'zenburn') to filter for.
 * @returns {Promise<string[]>} A promise resolving to an array of recipe filenames (e.g., ['zenburn.json']).
 */
async function getRecipeFiles(targetThemeId: string | null): Promise<string[]> {
  const files = await readdir(RECIPES_DIR);
  let recipes = files.filter((f) => f.endsWith(".json"));

  if (targetThemeId) {
    console.log(`Filtering for theme ID: ${targetThemeId}`);
    recipes = recipes.filter((f) => f === `${targetThemeId}.json`);
    if (recipes.length === 0) {
      console.error(`No recipe found matching: ${targetThemeId}.json`);
      process.exit(1);
    }
  }

  console.log(`Found ${recipes.length} recipes.`);
  return recipes;
}

/**
 * Orchestrates the entire screenshot generation workflow.
 *
 * This function serves as the entry point for the script and performs the following steps:
 * 1. Ensures the global output (`IMAGES_DIR`) and temporary working (`TEMP_DIR`) directories exist.
 * 2. Parses command-line arguments to determine if we should filter for a specific theme or force regeneration.
 * 3. Retrieves the list of recipe files to process.
 * 4. Iteratively processes each theme, tracking success, failure, and skip statuses.
 * 5. Outputs a final summary of the operations performed.
 * 6. Exits with a non-zero code if any theme processing failed.
 */
async function main() {
  await mkdir(IMAGES_DIR, { recursive: true });
  await mkdir(TEMP_DIR, { recursive: true });

  const { targetThemeId, force } = parseCliArgs();
  const recipes = await getRecipeFiles(targetThemeId);

  const results = { skipped: 0, success: 0, failed: 0 };

  for (const recipeFile of recipes) {
    // If a target theme was provided via --file, or --force was used, force it
    const shouldForce = force || !!targetThemeId;
    const { status } = await processTheme(join(RECIPES_DIR, recipeFile), shouldForce);
    results[status]++;
  }

  console.log(`\nSummary: Skipped: ${results.skipped}, Success: ${results.success}, Failed: ${results.failed}`);
  if (results.failed > 0) process.exit(1);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Screenshot generation failed:", err);
    process.exitCode = 1;
  });
}
