import { mkdir, readdir, readFile, rm, copyFile } from "node:fs/promises";
import { join, basename, resolve, relative } from "node:path";
import { ThemeSchema, Theme } from "./schema-checker";
import { RECIPES_DIR, MODE_SAMPLES, ModeConfig } from "./constants";

const IMAGES_DIR = "static/imgs";
const TEMP_DIR = ".tmp/theme-gen";
const INIT_TEMPLATE_PATH = "src/elisp/init-template.el";
const MODES_SAMPLES_DIR = "src/elisp/modes";
const LOCAL_THEMES_DIR = "static/themes";

interface Arguments {
  targetThemeId: string | null;
  force: boolean;
}

/**
 * Parses command-line arguments to extract theme filtering and force flags.
 *
 * @returns {Arguments} An object containing the parsed arguments.
 */
function parseCliArgs(): Arguments {
  const fileIndex = Bun.argv.indexOf("--file");
  const targetThemeId = (fileIndex !== -1 && Bun.argv[fileIndex + 1]) ? Bun.argv[fileIndex + 1] : null;
  const force = Bun.argv.includes("--force");

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
  const localThemesRoot = resolve(LOCAL_THEMES_DIR);
  const absoluteSourcePath = resolve(source);
  const relativeToRoot = relative(localThemesRoot, absoluteSourcePath);
  const escapesLocalRoot = relativeToRoot.startsWith("..") || relativeToRoot.startsWith("/");

  if (escapesLocalRoot) {
    throw new Error(`Invalid local theme path outside ${LOCAL_THEMES_DIR}: ${source}`);
  }

  return absoluteSourcePath;
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
 * Prepares the theme files by either copying them from a local directory or
 * downloading them from remote URLs.
 *
 * @param {Theme} theme - The theme object from the recipe.
 * @param {string} themeTempDir - The temporary directory where files should be placed.
 * @returns {Promise<string[]>} A list of filenames that should be loaded in Emacs.
 */
async function prepareThemeFiles(theme: Theme, themeTempDir: string): Promise<string[]> {
  const filesToLoad: string[] = [];
  if (theme.repoUrl === "local") {
    const firstRawUrl = theme.rawUrls[0];
    const match = firstRawUrl.match(/^static\/themes\/([^/]+)\//);
    const folderName = match ? match[1] : theme.id;
    const localThemeDir = join(LOCAL_THEMES_DIR, folderName);
    console.log(`  Copying local theme directory from ${localThemeDir}...`);
    await copyDir(localThemeDir, themeTempDir);
    // For local themes, we use the rawUrls list to determine what to load
    theme.rawUrls.forEach(url => filesToLoad.push(basename(url)));
  } else {
    const downloaded = await downloadThemeFiles(theme.rawUrls, themeTempDir);
    filesToLoad.push(...downloaded);
  }
  return filesToLoad;
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
 * @param {string[]} filesToLoad - List of files to explicitly load.
 * @param {string} themeName - The internal Emacs symbol name for the theme.
 * @param {string} modeName - The name of the Emacs mode to showcase (e.g., 'python-mode').
 * @param {ModeConfig} config - Configuration object specifying the sample file and type.
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
  const samplePath = join(MODES_SAMPLES_DIR, config.file);

  let modeSpecificLogic = "";
  if (config.isInstructionFile) {
    modeSpecificLogic = await readFile(samplePath, "utf-8");
    if (config.sampleFile) {
      const absoluteSamplePath = resolve(join(MODES_SAMPLES_DIR, config.sampleFile));
      modeSpecificLogic = modeSpecificLogic.replace(/{{SAMPLE_PATH}}/g, absoluteSamplePath);
    }
  } else {
    const absoluteSamplePath = resolve(samplePath);
    const extraLogic = modeName === 'text-mode' ? '(display-line-numbers-mode 1)' : '';

    modeSpecificLogic = `
(find-file "${absoluteSamplePath}")
(funcall '${modeName})
${extraLogic}
(delete-other-windows)
(log-debug "Opened ${config.file} in ${modeName}")
    `;
  }

  const loadFilesElisp = filesToLoad
    .filter(f => f.endsWith(".el"))
    .map(f => `(load "${resolve(join(themeDir, f))}")`)
    .join("\n");

  return template
    .replace(/{{THEME_DIR}}/g, resolve(themeDir))
    .replace(/{{LOAD_THEME_FILES}}/g, loadFilesElisp)
    .replace(/{{THEME_FILES}}/g, filesToLoad.filter(f => f.endsWith(".el")).join(" "))
    .replace(/{{THEME_NAME}}/g, themeName)
    .replace(/{{ELISP_BEFORE}}/g, theme.elispBefore || "")
    .replace(/{{ELISP_AFTER}}/g, theme.elispAfter || "")
    .replace(/{{READY_FILE}}/g, resolve(readyFilePath))
    .replace(/{{MODE_SPECIFIC_LOGIC}}/g, modeSpecificLogic);
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
  const hasXvfb = (await Bun.spawn(["which", "xvfb-run"]).exited) === 0;

  if (!hasXvfb) {
    console.log("  xvfb-run not found. Skipping screenshot generation.");
    return false;
  }

  const wrapperCmd = `
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

  try {
    const proc = Bun.spawn(["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1280x960x24", "bash", "-c", wrapperCmd], {
      stdout: "inherit",
      stderr: "inherit"
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
 * @param {boolean} [force=false] - Whether to force screenshot generation.
 * @returns {Promise<{ status: 'skipped' | 'success' | 'failed', name: string }>}
 * An object containing the operation status and the theme name.
 */
async function processTheme(recipePath: string, force: boolean = false): Promise<{ status: 'skipped' | 'success' | 'failed', name: string }> {
  const file = Bun.file(recipePath);
  const json = await file.json();
  const parseResult = ThemeSchema.safeParse(json);

  if (!parseResult.success) {
    console.error(`Invalid schema for ${recipePath}`);
    return { status: 'failed', name: basename(recipePath) };
  }

  const theme = parseResult.data;
  const themeImagesDir = join(IMAGES_DIR, theme.id);

  // Skip if theme directory already exists, unless force is true
  try {
    const dirInfo = await Bun.file(themeImagesDir).stat();
    if (dirInfo && !force) {
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

  let processingFailed = false;

  try {
    const filesToLoad = await prepareThemeFiles(theme, themeTempDir);
    const detectedName = await findThemeNameInDir(themeTempDir, filesToLoad);
    const emacsThemeName = detectedName || theme.id;

    for (const [modeName, config] of Object.entries(MODE_SAMPLES)) {
      console.log(`  Generating screenshot for ${modeName}...`);
      const imagePath = join(themeImagesDir, `${modeName}.png`);
      const initElPath = join(themeTempDir, `init-${modeName}.el`);
      const readyFilePath = join(themeTempDir, `ready-${modeName}`);

      const initContent = await generateInitEl(theme, themeTempDir, filesToLoad, emacsThemeName, modeName, config, readyFilePath);
      await Bun.write(initElPath, initContent);

      const success = await captureScreenshot(initElPath, imagePath, readyFilePath);
      if (!success) {
        console.error(`  ❌ Failed to generate screenshot for ${modeName}`);
        processingFailed = true;
        break; // Stop processing further modes for this theme
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
            processingFailed = true;
            break;
          }
        }
      }
    }

    if (processingFailed) {
      throw new Error(`Failed to generate some screenshots for ${theme.name}`);
    }

    return { status: 'success', name: theme.name };
  } catch (err) {
    console.error(`  Error processing theme ${theme.name}:`, err);
    try {
      await rm(themeImagesDir, { recursive: true, force: true });
      console.log(`  Rolled back: Deleted ${themeImagesDir} due to failure.`);
    } catch (cleanupErr) {
      console.error(`  Failed to delete ${themeImagesDir}:`, cleanupErr);
    }
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

  const { targetThemeId, force } = parseCliArgs();
  const files = await readdir(RECIPES_DIR);
  let recipes = files.filter(f => f.endsWith(".json"));

  if (targetThemeId) {
    console.log(`Filtering for theme ID: ${targetThemeId}`);
    recipes = recipes.filter(f => f === `${targetThemeId}.json`);
    if (recipes.length === 0) {
      console.error(`No recipe found matching: ${targetThemeId}.json`);
      process.exit(1);
    }
  }

  console.log(`Found ${recipes.length} recipes.`);

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
  main().catch(console.error);
}
