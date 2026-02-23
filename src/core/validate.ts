import { validateSchema } from "./schema-checker.js";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { RECIPES_DIR } from "./constants.js";

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

async function main() {
  try {
    const recipeFiles = await getRecipeFiles(RECIPES_DIR);

    if (recipeFiles.length === 0) {
      console.log(`No recipe files found in "${RECIPES_DIR}" directory.`);
      process.exit(0);
    }

    console.log(`Found ${recipeFiles.length} recipe file(s) to validate.`);

    const idMap = new Map<string, string[]>();
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

    if (hasErrors) {
      console.error("\n❌ Validation failed.");
      process.exit(1);
    } else {
      console.log("\n✅ All recipes validated successfully and IDs are unique.");
      process.exit(0);
    }
  } catch (error) {
    console.error("An unexpected error occurred during validation:", error);
    process.exit(1);
  }
}

main();
