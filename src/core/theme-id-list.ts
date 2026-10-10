import { readFile } from "node:fs/promises";
import { z } from "zod";

/** A theme id entry: non-empty string that is not whitespace-only. */
const ThemeIdEntrySchema = z
  .string()
  .min(1)
  .refine((value) => value.trim() !== "");

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
      `Failed to read theme list config at ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  let data: unknown;

  try {
    data = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Invalid JSON in theme list config at ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  const container = z.looseObject({ [property]: z.array(z.unknown()) }).safeParse(data);

  if (!container.success) {
    throw new Error(`Invalid theme list config at ${filePath}: expected { ${property}: string[] }`);
  }

  const ids = z.array(ThemeIdEntrySchema).safeParse(container.data[property]);

  if (!ids.success) {
    throw new Error(
      `Invalid theme ids in ${filePath}: all entries in "${property}" must be non-empty strings`,
    );
  }

  return ids.data;
}
