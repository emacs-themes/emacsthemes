import { mkdir, readdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { SCREENSHOT_DATES_PATH } from "./constants";
import { assertPathWithinRoot } from "./path-utils";

/**
 * Represents persisted screenshot generation timestamps keyed by theme id.
 */
export type ScreenshotDatesMap = Record<string, string>;

let screenshotDatesCache: ScreenshotDatesMap | null = null;
const SCREENSHOT_DATES_LOG_PREFIX = "[screenshot-dates]";

/**
 * Returns a deterministically sorted screenshot date map.
 *
 * Sorting uses plain code-point comparison so serialized output stays stable across environments.
 *
 * @param {ScreenshotDatesMap} dates - Date map keyed by theme id.
 * @returns {ScreenshotDatesMap} A new map with keys sorted in ascending order.
 */
function sortScreenshotDates(dates: ScreenshotDatesMap): ScreenshotDatesMap {
  return Object.fromEntries(
    Object.entries(dates).toSorted(([leftId], [rightId]) => {
      if (leftId < rightId) {
        return -1;
      }

      if (leftId > rightId) {
        return 1;
      }

      return 0;
    }),
  );
}

/**
 * Reads the screenshot generation dates file.
 *
 * @returns {Promise<ScreenshotDatesMap>} A promise resolving to the parsed screenshot date map.
 */
export async function readScreenshotDates(): Promise<ScreenshotDatesMap> {
  if (screenshotDatesCache) {
    console.log(`${SCREENSHOT_DATES_LOG_PREFIX} using in-memory cache`);
    return screenshotDatesCache;
  }

  const file = Bun.file(SCREENSHOT_DATES_PATH);
  if (!(await file.exists())) {
    console.log(`${SCREENSHOT_DATES_LOG_PREFIX} file missing, starting with empty map`);
    screenshotDatesCache = {};
    return screenshotDatesCache;
  }

  const content = await file.text();
  screenshotDatesCache = JSON.parse(content) as ScreenshotDatesMap;
  console.log(
    `${SCREENSHOT_DATES_LOG_PREFIX} loaded ${Object.keys(screenshotDatesCache).length} entries from ${SCREENSHOT_DATES_PATH}`,
  );
  return screenshotDatesCache;
}

/**
 * Writes screenshot generation dates to disk.
 *
 * @param {ScreenshotDatesMap} dates - Date map keyed by theme id.
 * @returns {Promise<void>} A promise resolved when write completes.
 */
export async function writeScreenshotDates(dates: ScreenshotDatesMap): Promise<void> {
  const sortedDates = sortScreenshotDates(dates);
  await mkdir(dirname(SCREENSHOT_DATES_PATH), { recursive: true });
  await Bun.write(SCREENSHOT_DATES_PATH, `${JSON.stringify(sortedDates, null, 2)}\n`);
  screenshotDatesCache = sortedDates;
  console.log(
    `${SCREENSHOT_DATES_LOG_PREFIX} wrote ${Object.keys(sortedDates).length} entries to ${SCREENSHOT_DATES_PATH}`,
  );
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
    console.log(`${SCREENSHOT_DATES_LOG_PREFIX} skipped existing date for ${themeId}`);
    return;
  }

  dates[themeId] = date.toISOString();
  console.log(
    `${SCREENSHOT_DATES_LOG_PREFIX} ${overwrite ? "overwrote" : "set"} date for ${themeId}`,
  );
  await writeScreenshotDates(dates);
}

/**
 * Initializes missing screenshot generation dates for existing screenshot directories.
 *
 * This is intended to run before screenshot generation so every theme screenshot folder has
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
  let addedCount = 0;

  let entries;
  try {
    entries = await readdir(imagesDir, { withFileTypes: true, encoding: "utf8" });
  } catch {
    console.log(
      `${SCREENSHOT_DATES_LOG_PREFIX} images directory missing or unreadable (${imagesDir}), skipping initialization`,
    );
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
    addedCount += 1;
  }

  if (changed) {
    console.log(`${SCREENSHOT_DATES_LOG_PREFIX} initialized ${addedCount} missing date entries`);
    await writeScreenshotDates(dates);
  } else {
    console.log(`${SCREENSHOT_DATES_LOG_PREFIX} initialization found no missing entries`);
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
    console.log(`${SCREENSHOT_DATES_LOG_PREFIX} using persisted date for ${themeId}`);
    return new Date(persistedDate);
  }

  try {
    const stats = await stat(themeImgsDir);
    console.log(`${SCREENSHOT_DATES_LOG_PREFIX} using mtime fallback for ${themeId}`);
    return stats.mtime;
  } catch {
    console.log(`${SCREENSHOT_DATES_LOG_PREFIX} using current date fallback for ${themeId}`);
    return new Date();
  }
}
