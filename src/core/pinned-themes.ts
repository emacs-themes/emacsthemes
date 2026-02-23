import { readFile } from "node:fs/promises";
import { PINNED_THEMES_PATH } from "./constants.js";

interface PinnedThemesConfig {
  pinnedThemes: string[];
}

/**
 * Reads and validates pinned theme IDs from the pinned themes configuration file.
 *
 * @param {string} [filePath=PINNED_THEMES_PATH] - Path to the pinned themes JSON file.
 * @returns {Promise<string[]>} A promise that resolves to an ordered list of pinned theme IDs.
 * @throws {Error} Throws when file cannot be read, JSON is malformed, or IDs are invalid.
 */
export async function getPinnedThemeIds(filePath: string = PINNED_THEMES_PATH): Promise<string[]> {
  let content: string;

  try {
    content = await readFile(filePath, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to read pinned themes config at ${filePath}: ${(error as Error).message}`,
      { cause: error },
    );
  }

  let data: PinnedThemesConfig;
  try {
    data = JSON.parse(content) as PinnedThemesConfig;
  } catch (error) {
    throw new Error(
      `Invalid JSON in pinned themes config at ${filePath}: ${(error as Error).message}`,
      { cause: error },
    );
  }

  if (!data || !Array.isArray(data.pinnedThemes)) {
    throw new Error(
      `Invalid pinned themes config at ${filePath}: expected { pinnedThemes: string[] }`,
    );
  }

  const invalidIds = data.pinnedThemes.filter((id) => typeof id !== "string" || id.trim() === "");
  if (invalidIds.length > 0) {
    throw new Error(`Invalid pinned theme IDs in ${filePath}: all IDs must be non-empty strings`);
  }

  return data.pinnedThemes;
}
