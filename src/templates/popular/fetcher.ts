/**
 * Orchestrates fetching all popularity sources and writing their logs.
 *
 * Data retrieval and disk logging are deliberately separated: `fetchPopularThemes`
 * is pure (no filesystem access) and returns a structured per-source result;
 * callers decide when and where logs are persisted via `writePopularThemesLogs`.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PopularThemeSourceResult } from "../../core/popular-types";
import { getErrorMessage } from "./fetch-json";
import { fetchGitHubThemes } from "./github";
import { fetchMelpaThemes } from "./melpa";

/** The default directory for popularity fetch logs. */
export const POPULAR_LOGS_DIR = ".tmp";

/** Maximum number of entries kept per source. Exported for test reuse. */
export const POPULAR_THEMES_LIMIT = 100;

const LOG_FILES = {
  melpa: { main: "melpa-main.log", error: "melpa-error.log" },
  github: { main: "github-main.log", error: "github-error.log" },
} as const;

/**
 * Fetches popular themes from MELPA and GitHub with independent settlement.
 *
 * Each source succeeds or fails on its own: a failure in one source never
 * suppresses data from the other. The returned array always contains one
 * result per configured source, in a stable order (MELPA first).
 *
 * @returns {Promise<PopularThemeSourceResult[]>} Per-source fetch outcomes.
 */
export async function fetchPopularThemes(): Promise<PopularThemeSourceResult[]> {
  const [melpa, github] = await Promise.all([
    fetchMelpaThemes(POPULAR_THEMES_LIMIT).then(
      (entries): PopularThemeSourceResult => ({ source: "melpa", status: "ok", entries }),
      (error): PopularThemeSourceResult => ({
        source: "melpa",
        status: "failed",
        error: getErrorMessage(error),
      }),
    ),
    fetchGitHubThemes(POPULAR_THEMES_LIMIT).then(
      ({ entries, warning }): PopularThemeSourceResult => ({
        source: "github",
        status: "ok",
        entries,
        ...(warning ? { warning } : {}),
      }),
      (error): PopularThemeSourceResult => ({
        source: "github",
        status: "failed",
        error: getErrorMessage(error),
      }),
    ),
  ]);

  return [melpa, github];
}

/**
 * Ensures the logs directory exists before attempting to write log files.
 *
 * @param {string} logDir - The directory to create.
 * @returns {Promise<void>} A promise that resolves once the directory is created or already exists.
 */
async function ensureLogsDirectory(logDir: string): Promise<void> {
  await mkdir(logDir, { recursive: true });
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
    await ensureLogsDirectory(dirname(filePath));
    await appendFile(filePath, message, "utf-8");
  } catch (error) {
    console.warn("Warning writing log entry:", getErrorMessage(error));
  }
}

/**
 * Writes one line per source outcome to the log files in `logDir`.
 *
 * Success lines (and any degradation warning) go to `*-main.log`; failure
 * lines go to `*-error.log`. Logging errors are swallowed with a console
 * warning so logging can never take down the caller.
 *
 * @param {PopularThemeSourceResult[]} results - The per-source fetch outcomes.
 * @param {string} logDir - The directory to write log files into.
 * @returns {Promise<void>} A promise that resolves once all log lines are written.
 */
export async function writePopularThemesLogs(
  results: readonly PopularThemeSourceResult[],
  logDir: string,
): Promise<void> {
  const timestamp = new Date().toISOString();
  for (const result of results) {
    const files = LOG_FILES[result.source];
    if (result.status === "ok") {
      const successLine =
        result.source === "melpa"
          ? `${timestamp} Fetched ${result.entries.length} popular themes successfully\n`
          : `${timestamp} Fetched ${result.entries.length} popular GitHub repositories successfully\n`;
      const warningLine = result.warning ? `${timestamp} Warning: ${result.warning}\n` : "";
      await appendLog(join(logDir, files.main), successLine + warningLine);
    } else {
      const sourceName = result.source === "melpa" ? "MELPA" : "GitHub";
      await appendLog(
        join(logDir, files.error),
        `${timestamp} Error fetching from ${sourceName}: ${result.error}\n`,
      );
    }
  }
}
