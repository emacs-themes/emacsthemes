import { validateSchema } from "./schema-checker.js";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { PINNED_THEMES_PATH, RECIPES_DIR } from "./constants.js";
import { getPinnedThemeIds } from "./pinned-themes.js";

async function getRecipeFiles(dir: string): Promise<string[]> {
  const files = await readdir(dir);
  return files.filter((file) => file.endsWith(".json"));
}

async function getRecipeId(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content);
    return data.id || null;
  } catch (err) {
    console.error(`❌ Failed to read or parse ${filePath}:`, err);
    return null;
  }
}

function checkDuplicateIds(idMap: Map<string, string[]>): boolean {
  let hasDuplicates = false;

  for (const [id, files] of idMap.entries()) {
    if (files.length > 1) {
      console.error(`❌ Duplicate ID "${id}" found in multiple files: ${files.join(", ")}`);
      hasDuplicates = true;
    }
  }
  return hasDuplicates;
}

/**
 * Validates that every pinned theme points to an existing recipe file.
 *
 * @param {string[]} pinnedThemeIds - Ordered pinned theme IDs from configuration.
 * @param {Set<string>} recipeFileIds - Set of recipe IDs derived from recipe filenames.
 * @returns {boolean} True when at least one pinned theme is missing a recipe file.
 */
function checkPinnedThemeFilesExist(pinnedThemeIds: string[], recipeFileIds: Set<string>): boolean {
  let hasMissingPinnedThemes = false;

  for (const pinnedThemeId of pinnedThemeIds) {
    if (!recipeFileIds.has(pinnedThemeId)) {
      console.error(
        `❌ Pinned theme "${pinnedThemeId}" is missing recipe file: ${join(RECIPES_DIR, `${pinnedThemeId}.json`)}`,
      );
      hasMissingPinnedThemes = true;
    }
  }

  return hasMissingPinnedThemes;
}

async function main() {
  try {
    const recipeFiles = await getRecipeFiles(RECIPES_DIR);
    let pinnedThemeIds: string[];

    try {
      pinnedThemeIds = await getPinnedThemeIds(PINNED_THEMES_PATH);
    } catch (error) {
      console.error(`❌ ${(error as Error).message}`);
      process.exit(1);
      return;
    }

    console.log(`Found ${recipeFiles.length} recipe file(s) to validate.`);

    const idMap = new Map<string, string[]>();
    const recipeFileIds = new Set<string>(
      recipeFiles.map((file) => file.slice(0, -".json".length)),
    );
    let hasErrors = false;

    for (const file of recipeFiles) {
      const filePath = join(RECIPES_DIR, file);
      const isValid = await validateSchema(filePath);

      if (!isValid) {
        hasErrors = true;
        continue;
      }

      const id = await getRecipeId(filePath);
      if (!id) {
        console.error(`❌ Recipe in ${file} is missing an "id" field.`);
        hasErrors = true;
        continue;
      }

      if (!idMap.has(id)) {
        idMap.set(id, []);
      }
      idMap.get(id)!.push(file);
    }

    if (checkDuplicateIds(idMap)) {
      hasErrors = true;
    }

    if (checkPinnedThemeFilesExist(pinnedThemeIds, recipeFileIds)) {
      hasErrors = true;
    }

    if (hasErrors) {
      console.error("\n❌ Validation failed.");
      process.exit(1);
    } else {
      console.log(
        "\n✅ All recipes validated successfully, IDs are unique, and pinned theme files exist.",
      );
      process.exit(0);
    }
  } catch (error) {
    console.error("An unexpected error occurred during validation:", error);
    process.exit(1);
  }
}

main();
