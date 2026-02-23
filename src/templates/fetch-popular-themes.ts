import * as https from "node:https";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const LOGS_DIR = ".tmp";
const errorLogPath = join(LOGS_DIR, "melpa-error.log");
const mainLogPath = join(LOGS_DIR, "melpa-main.log");
const recipesUrl = "https://melpa.org/recipes.json";
const downloadsUrl = "https://melpa.org/download_counts.json";
const themeStr = "-theme";
const REQUEST_TIMEOUT_MS = 10000;

const ignored: Record<string, true> = {
  "helm-themes": true,
  "color-theme": true,
};

interface RecipeMeta {
  fetcher?: string;
  repo?: string;
  url?: string;
}

export interface ThemeDownloadEntry {
  name: string;
  downloads: number;
  url?: string;
}

type DownloadCounts = Record<string, number>;
type RecipesIndex = Record<string, RecipeMeta>;

/**
 * Builds a repository URL for a MELPA recipe entry.
 *
 * @param {RecipeMeta | undefined} pck - The MELPA recipe metadata entry.
 * @returns {string | undefined} The fully qualified repository URL, or undefined when data is incomplete.
 */
function composeUrl(pck?: RecipeMeta): string | undefined {
  if (!pck) {
    return undefined;
  }

  // If a direct URL is provided in the recipe, use it (stripping .git if present)
  if (pck.url) {
    return pck.url.replace(/\.git$/, "");
  }

  if (!pck.fetcher || !pck.repo) {
    return undefined;
  }

  if (pck.fetcher === "sourcehut") {
    return `https://git.sr.ht/~${pck.repo}`;
  }

  return `https://${pck.fetcher}.com/${pck.repo}`;
}

/**
 * Formats a package name for display by replacing hyphens with spaces.
 *
 * @param {string} name - The raw package name.
 * @returns {string} The human-friendly display name.
 */
function formatName(name: string): string {
  return name.replace(/-/g, " ");
}

/**
 * Filters and sorts theme packages by download count and enriches them with metadata.
 *
 * @param {DownloadCounts} packages - Map of package names to download counts.
 * @param {RecipesIndex} recipes - Map of package names to recipe metadata.
 * @returns {ThemeDownloadEntry[]} The filtered and sorted list of theme entries.
 */
function filterPackages(packages: DownloadCounts, recipes: RecipesIndex): ThemeDownloadEntry[] {
  return Object.keys(packages)
    .filter(
      key => key.includes(themeStr) && !key.startsWith("/") && !ignored[key],
    )
    .toSorted((k1, k2) => {
      if (packages[k1] >= packages[k2]) {
        return -1;
      }
      return 1;
    })
    .map(k => ({
      name: formatName(k),
      downloads: packages[k],
      url: composeUrl(recipes[k]),
    }));
}

/**
 * Ensures the logs directory exists before attempting to write log files.
 *
 * @returns {Promise<void>} A promise that resolves once the directory is created or already exists.
 */
async function ensureLogsDirectory(): Promise<void> {
  await mkdir(LOGS_DIR, { recursive: true });
}

/**
 * Normalizes unknown errors into readable messages for logging.
 *
 * @param {unknown} error - The error value to normalize.
 * @returns {string} The normalized error message.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Appends a line to the specified log file, creating the log directory if needed.
 *
 * @param {string} filePath - The log file path to append to.
 * @param {string} message - The log line to append.
 * @returns {Promise<void>} A promise that resolves after the log line is written.
 */
async function appendLog(filePath: string, message: string): Promise<void> {
  try {
    await ensureLogsDirectory();
    await appendFile(filePath, message, "utf-8");
  } catch (error) {
    console.warn("Warning writing log entry:", getErrorMessage(error));
  }
}

/**
 * Fetches and parses JSON data from a URL using HTTPS.
 *
 * @param {string} url - The URL to request.
 * @returns {Promise<T>} A promise that resolves to the parsed JSON payload.
 */
function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, resp => {
      const statusCode = resp.statusCode ?? 0;
      if (statusCode < 200 || statusCode >= 300) {
        resp.resume();
        reject(new Error(`Request failed with status ${statusCode} for ${url}`));
        return;
      }

      let data = "";
      resp.setEncoding("utf-8");
      resp.on("data", chunk => {
        data += chunk;
      });

      resp.on("end", () => {
        try {
          resolve(JSON.parse(data) as T);
        } catch (error) {
          reject(new Error(`Invalid JSON response from ${url}: ${getErrorMessage(error)}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms for ${url}`));
    });
  });
}

/**
 * Retrieves and prepares the most popular themes from MELPA.
 *
 * @returns {Promise<ThemeDownloadEntry[] | undefined>} A promise resolving to the popular themes list or undefined on failure.
 */
export async function fetchPopularThemes(): Promise<ThemeDownloadEntry[] | undefined> {
  try {
    const [packages, recipes] = await Promise.all([
      fetchJson<DownloadCounts>(downloadsUrl),
      fetchJson<RecipesIndex>(recipesUrl),
    ]);

    const themes = filterPackages(packages, recipes).slice(0, 50);
    await appendLog(
      mainLogPath,
      `${new Date().toISOString()} Fetched ${themes.length} popular themes successfully\n`,
    );
    return themes;
  } catch (error) {
    const errorText = `${new Date().toISOString()} Error fetching from MELPA: ${getErrorMessage(error)}\n`;
    await appendLog(errorLogPath, errorText);
    return undefined;
  }
}

if (import.meta.main) {
  fetchPopularThemes().then(themes => {
    if (themes) {
      console.log(`Successfully fetched ${themes.length} popular themes.`);
    } else {
      console.error("Failed to fetch popular themes.");
      process.exit(1);
    }
  }).catch(error => {
    console.error("Failed to fetch popular themes:", getErrorMessage(error));
    process.exit(1);
  });
}