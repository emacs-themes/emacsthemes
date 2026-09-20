import { readFile } from "node:fs/promises";

/**
 * Reads and validates an ordered list of theme ids from a JSON configuration file.
 *
 * The file must contain an array under `property` whose entries are non-empty
 * strings. Array order is preserved because callers render it as-is (pinned
 * gallery order, popularity ranking).
 *
 * @param {string} filePath - Path to the JSON configuration file.
 * @param {string} property - Name of the property holding the id array.
 * @returns {Promise<string[]>} The validated theme ids in file order.
 * @throws {Error} Throws when the file cannot be read, JSON is malformed, or ids are invalid.
 */
export async function readThemeIdList(filePath: string, property: string): Promise<string[]> {
  let content: string;

  try {
    content = await readFile(filePath, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to read theme list config at ${filePath}: ${(error as Error).message}`,
      { cause: error },
    );
  }

  let data: Record<string, unknown> | null;
  try {
    data = JSON.parse(content) as Record<string, unknown> | null;
  } catch (error) {
    throw new Error(
      `Invalid JSON in theme list config at ${filePath}: ${(error as Error).message}`,
      { cause: error },
    );
  }

  const ids = data?.[property];
  if (!Array.isArray(ids)) {
    throw new Error(`Invalid theme list config at ${filePath}: expected { ${property}: string[] }`);
  }

  const invalidIds = ids.filter((id) => typeof id !== "string" || id.trim() === "");
  if (invalidIds.length > 0) {
    throw new Error(
      `Invalid theme ids in ${filePath}: all entries in "${property}" must be non-empty strings`,
    );
  }

  return ids as string[];
}
