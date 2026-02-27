import { mkdir, readdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { SCREENSHOT_DATES_PATH } from "./constants";
import { assertPathWithinRoot } from "./path-utils";

/**
 * Represents persisted screenshot generation timestamps keyed by theme id.
 */
export type ScreenshotDatesMap = Record<string, string>;

let screenshotDatesCache: ScreenshotDatesMap | null = null;

/**
 * Reads the screenshot generation dates file.
 *
 * @returns {Promise<ScreenshotDatesMap>} A promise resolving to the parsed screenshot date map.
 */
export async function readScreenshotDates(): Promise<ScreenshotDatesMap> {
  if (screenshotDatesCache) {
    return screenshotDatesCache;
  }

  const file = Bun.file(SCREENSHOT_DATES_PATH);
  if (!(await file.exists())) {
    screenshotDatesCache = {};
    return screenshotDatesCache;
  }

  const content = await file.text();
  screenshotDatesCache = JSON.parse(content) as ScreenshotDatesMap;
  return screenshotDatesCache;
}

/**
 * Writes screenshot generation dates to disk.
 *
 * @param {ScreenshotDatesMap} dates - Date map keyed by theme id.
 * @returns {Promise<void>} A promise resolved when write completes.
 */
export async function writeScreenshotDates(dates: ScreenshotDatesMap): Promise<void> {
  const sortedDates = Object.fromEntries(
    Object.entries(dates).toSorted(([a], [b]) => a.localeCompare(b)),
  );
  await mkdir(dirname(SCREENSHOT_DATES_PATH), { recursive: true });
  await Bun.write(SCREENSHOT_DATES_PATH, `${JSON.stringify(sortedDates, null, 2)}\n`);
  screenshotDatesCache = sortedDates;
}

/**
 * Adds or updates a single theme screenshot generation date in persistence.
 *
 * The value is set when it does not already exist, or when `overwrite` is enabled.
 *
 * @param {string} themeId - Theme identifier.
 * @param {Date} date - Date to persist.
 * @param {boolean} overwrite - Whether to replace an existing persisted value.
 * @returns {Promise<void>} A promise resolved after persistence is updated when needed.
 */
export async function upsertScreenshotGenerationDate(
  themeId: string,
  date: Date,
  overwrite: boolean,
): Promise<void> {
  const dates = await readScreenshotDates();
  if (dates[themeId] && !overwrite) {
    return;
  }

  dates[themeId] = date.toISOString();
  await writeScreenshotDates(dates);
}

/**
 * Initializes missing screenshot generation dates for existing screenshot directories.
 *
 * This is intended to run before site build so every theme screenshot folder has
 * a persisted generation date entry. Missing dates are initialized from the
 * directory birth time, then fallback to modification time, then current time.
 *
 * @param {string} imagesDir - Root images directory (for example, `static/imgs`).
 * @returns {Promise<ScreenshotDatesMap>} Final screenshot date map after initialization.
 */
export async function ensureScreenshotDatesInitialized(
  imagesDir: string,
): Promise<ScreenshotDatesMap> {
  const dates = await readScreenshotDates();
  let changed = false;

  let entries;
  try {
    entries = await readdir(imagesDir, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return dates;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const themeId = entry.name;
    if (dates[themeId]) {
      continue;
    }

    const themeDir = assertPathWithinRoot(imagesDir, themeId);
    const stats = await stat(themeDir);
    const bestDate = stats.birthtime.getTime() > 0 ? stats.birthtime : stats.mtime;
    dates[themeId] = bestDate.toISOString();
    changed = true;
  }

  if (changed) {
    await writeScreenshotDates(dates);
  }

  return dates;
}

/**
 * Resolves a display date for a theme detail page generation marker.
 *
 * Priority:
 * 1. Persisted screenshot generation date from JSON metadata.
 * 2. Screenshot directory modification timestamp.
 * 3. Current timestamp when no other source is available.
 *
 * @param {string} themeId - Theme identifier.
 * @param {string} themeImgsDir - Path to the theme screenshot folder.
 * @param {ScreenshotDatesMap} screenshotDates - Persisted screenshot dates map.
 * @returns {Promise<Date>} A date suitable for detail-page display.
 */
export async function resolveThemeGeneratedDate(
  themeId: string,
  themeImgsDir: string,
  screenshotDates: ScreenshotDatesMap,
): Promise<Date> {
  const persistedDate = screenshotDates[themeId];
  if (persistedDate) {
    return new Date(persistedDate);
  }

  try {
    const stats = await stat(themeImgsDir);
    return stats.mtime;
  } catch {
    return new Date();
  }
}
