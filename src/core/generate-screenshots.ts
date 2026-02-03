import { mkdir, unlink, readdir } from "node:fs/promises";
import { join, basename, resolve, dirname } from "node:path";
import { ThemeSchema } from "./schema-checker";
import { RECIPES_DIR } from "./constants";

const IMAGES_DIR = "static/imgs";
const TEMP_DIR = ".tmp/theme-gen";

const STATE_FILE = ".last-processed-commit";

/**
 * Retrieves a list of files changed since the last processed commit.
 * If no state is found, defaults to checking the last commit (HEAD).
 *
 * @returns {Promise<{ files: string[], currentHash: string }>} Files and the current commit hash.
 */
export async function getChangedFiles(): Promise<{ files: string[]; currentHash: string }> {
  const procHead = Bun.spawn(["git", "rev-parse", "HEAD"], { stdout: "pipe" });
  const currentHash = (await new Response(procHead.stdout).text()).trim();

  let lastHash = "";
  const stateFile = Bun.file(STATE_FILE);
  if (await stateFile.exists()) {
    const rawHash = (await stateFile.text()).trim();
    // Validate that the hash exists in the current history
    const checkProc = Bun.spawn(["git", "cat-file", "-t", rawHash], { stdout: "ignore", stderr: "ignore" });
    if ((await checkProc.exited) === 0) {
      lastHash = rawHash;
    } else {
      console.warn(`Stored state hash ${rawHash} not found in history. Falling back to default behavior.`);
    }
  }

  let files: string[] = [];

  if (lastHash && lastHash !== currentHash) {
    console.log(`Detecting changes between ${lastHash.substring(0, 7)} and ${currentHash.substring(0, 7)}...`);
    const procDiff = Bun.spawn(["git", "diff", "--name-only", "--diff-filter=AM", lastHash, currentHash], {
      stdout: "pipe",
    });
    const output = await new Response(procDiff.stdout).text();
    files = output.split("\n").map((f) => f.trim()).filter((f) => f.length > 0);
  } else if (!lastHash) {
    console.log(`No previous state found. Checking last commit...`);
    const proc = Bun.spawn(["git", "diff-tree", "--no-commit-id", "--name-only", "-r", "--diff-filter=AM", "HEAD"], {
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    files = output.split("\n").map((f) => f.trim()).filter((f) => f.length > 0);
  } else {
    console.log("No new commits to process.");
  }

  return { files, currentHash };
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
 * Scans the directory for .el files and extracts the theme name from (deftheme ...).
 * 
 * @param {string} dir - The directory to scan.
 * @returns {Promise<string | null>} The extracted theme name or null if not found.
 */
async function findThemeNameInDir(dir: string): Promise<string | null> {
  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".el")) continue;
      
      const content = await Bun.file(join(dir, file)).text();
      // Match (deftheme <symbol>
      // Regex explanation:
      // \(deftheme\s+   : Matches literal "(deftheme " followed by whitespace
      // '?              : Optional quote
      // ([^)\s]+)       : Capturing group for the symbol (anything not ) or whitespace)
      const match = content.match(/\(deftheme\s+'?([^)\s]+)/);
      if (match) {
        return match[1];
      }
      
      // Fallback for (provide-theme 'name) which some themes might use
      const matchProvide = content.match(/\(provide-theme\s+'?([^)\s]+)\)/);
      if (matchProvide) {
        return matchProvide[1];
      }
    }
  } catch (e) {
    console.error(`Error scanning for theme name in ${dir}:`, e);
  }
  return null;
}

/**
 * Generates the Emacs configuration (init.el) content for loading the theme.
 *
 * @param {string} elisp - The specific Elisp code to load the theme.
 * @param {string} themeDir - The directory containing the theme files.
 * @param {string} themeName - The exact theme name/symbol to load.
 * @returns {string} The complete content for the init.el file.
 */
export function generateEmacsConfig(elisp: string, themeDir: string, themeName: string): string {
  return `
    (defun log-debug (fmt &rest args)
      (let ((msg (apply #'format fmt args)))
        (message "%s" msg)
        (princ (concat msg "\\n") #'external-debugging-output)))

    (log-debug "DEBUG EMACS: Starting Emacs init...")
    (add-to-list 'load-path "${resolve(themeDir)}")
    (log-debug "DEBUG EMACS: Added ${resolve(themeDir)} to load-path")
    
    ;; Make emacs full window
    (set-frame-parameter nil 'fullscreen 'fullboth)
    
    (setq inhibit-splash-screen t)
    (setq initial-scratch-message nil)
    (menu-bar-mode -1)
    (tool-bar-mode -1)
    (scroll-bar-mode -1)
    (set-face-attribute 'default nil :height 140)

    ;; Some themes require 'cl or 'cl-lib, ensure they are loaded if needed, though usually automatic.

    (log-debug "DEBUG EMACS: Attempting to load theme...")
    
    ;; Add current dir to theme load path
    (add-to-list 'custom-theme-load-path "${resolve(themeDir)}")

    ;; Try to load and enable theme based on name
    (let ((name-symbol (intern "${themeName}")))
       (condition-case err
           (load-theme name-symbol t)
         (error (log-debug "Auto-loading theme %s failed: %s" name-symbol err))))

    ${elisp}

    (if custom-enabled-themes
      (log-debug "DEBUG EMACS: Theme loaded successfully")
      (log-debug "DEBUG EMACS: Error: No theme loaded"))

    ;; Visit the root folder in dired
    (dired "/")
    (delete-other-windows)
    (log-debug "DEBUG EMACS: Dired buffer opened at / and maximized")

    (setq default-directory "${resolve(themeDir)}")
    (log-debug "DEBUG EMACS: default-directory set to %s" default-directory)
    (redisplay t)
    (log-debug "DEBUG EMACS: Emacs init completed.")
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
  const themeDir = dirname(initElPath);
  // Check for xvfb-run
  const hasXvfb = (await Bun.spawn(["which", "xvfb-run"]).exited) === 0;

  if (!hasXvfb) {
    console.log("  xvfb-run not found. Skipping screenshot generation (Environment missing).");
    return false;
  }

  console.log(`  Generating screenshot...`);

  // Wrapper script to orchestrate Emacs and Import
  const wrapperCmd = `
    set -x
    echo "DEBUG: Checking environment..."
    echo "DEBUG: DISPLAY=$DISPLAY"
    ls -l /tmp/.X11-unix || echo "No X11 socket found"
    
    echo "DEBUG: Checking emacs capabilities..."
    emacs --version
    ldd $(which emacs) | grep -iE "gtk|xcb|x11" || echo "WARNING: Emacs might not be linked against X11 libs"

    echo "DEBUG: Starting Emacs..."
    STDOUT_LOG="${resolve(themeDir)}/emacs.stdout.log"
    STDERR_LOG="${resolve(themeDir)}/emacs.stderr.log"
    touch "$STDOUT_LOG" "$STDERR_LOG"

    # Tail logs in background to show them in console
    tail -f "$STDOUT_LOG" "$STDERR_LOG" &
    TAIL_PID=$!

    emacs -Q -l "${initElPath}" > "$STDOUT_LOG" 2> "$STDERR_LOG" &
    EMACS_PID=$!
    echo "DEBUG: Emacs started with PID $EMACS_PID"

    # Wait for emacs window to appear
    echo "DEBUG: Waiting for Emacs to initialize (5s)..."
    sleep 5

    # Check if Emacs is still alive
    if ! kill -0 $EMACS_PID 2>/dev/null; then
      echo "ERROR: Emacs process $EMACS_PID died correctly."
      cat "$STDOUT_LOG"
      cat "$STDERR_LOG"
      kill $TAIL_PID
      exit 1
    fi

    # Capture the root window
    echo "DEBUG: Capturing screenshot to ${resolve(imagePath)}..."
    import -window root "${resolve(imagePath)}"
    IMPORT_EXIT=$?

    if [ $IMPORT_EXIT -eq 0 ]; then
      echo "DEBUG: Screenshot captured successfully."
    else
      echo "ERROR: 'import' command failed with exit code $IMPORT_EXIT"
    fi

    echo "DEBUG: Killing Emacs PID $EMACS_PID..."
    kill $EMACS_PID
    
    # Stop tailing
    kill $TAIL_PID
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

  // Attempt to detect the actual theme name from the downloaded files
  const detectedName = await findThemeNameInDir(themeDir);
  if (detectedName) {
    console.log(`  Detected theme name: ${detectedName}`);
  } else {
    console.log(`  Could not auto-detect theme name from files. Falling back to sanitized recipe name.`);
  }

  // Use detected name or fallback to sanitized recipe name (lowercase, spaces to dashes)
  const finalThemeName = detectedName || themeName.toLowerCase().replace(/\s+/g, '-');

  // Create init.el
  const initElPath = join(themeDir, "init.el");
  const initContent = generateEmacsConfig(theme.elisp, themeDir, finalThemeName);
  await Bun.write(initElPath, initContent);

  const success = await captureScreenshot(initElPath, imagePath);

  if (success) {
    return { status: 'success', name: themeName };
  } else {
    console.error(`  ❌ Failed to generate image for ${themeName}`);
    if (await Bun.file(imagePath).exists()) {
      console.log(`  Cleaning up failed image file: ${imagePath}`);
      await unlink(imagePath);
    }
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

  // Get changed files
  let files: string[] = [];
  let currentHash = "";
  try {
    const result = await getChangedFiles();
    files = result.files;
    currentHash = result.currentHash;
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

  if (currentHash && successThemes.length > 0) {
    await Bun.write(STATE_FILE, currentHash);
    console.log(`Updated state to ${currentHash}`);
    console.log(`REMINDER: Commit ${STATE_FILE} along with any generated screenshots.`);
  }
}
if (import.meta.main) {
  main().catch(console.error);
}
