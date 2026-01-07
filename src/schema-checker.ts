import { z } from 'zod';
import { resolve } from 'path';

export const ThemeSchema = z.object({
  name: z.string().min(1, 'Theme name is required'),
  description: z.string().min(1, 'Description is required'),
  repoUrl: z.string().min(1, 'Repository url is required'),
  rawUrls: z.array(
    z.string().trim().min(1, 'Actual theme url cannot be empty'))
     .nonempty('You must list at least one author'),
  type: z.enum(['light', 'dark']),
  authors: z.array(
    z.string().trim().min(1, 'Authors name cannot be empty'))
     .nonempty('You must list at least one author'),
  tags: z.array(
    z.string().trim().min(1, 'Authors name cannot be empty')),
  elisp: z.string().optional().default(''),
});

export type Theme = z.infer<typeof ThemeSchema>;

export async function validateSchema(filePath: string): Promise<boolean> {
  try {
    const absolutePath = resolve(filePath);
    const file = Bun.file(absolutePath);

    if (!(await file.exists())) {
      console.error(`Error: File not found at ${absolutePath}`);
      return false;
    }

    // Bun's native JSON parsing is highly optimized
    const jsonData = await file.json();

    const result = ThemeSchema.safeParse(jsonData);

    if (result.success) {
      console.log(`✅ Schema validation passed for ${filePath}!`);
      return true;
    } else {
      console.error(`❌ Schema validation failed for ${filePath}:`);
      console.error(JSON.stringify(result.error.format(), null, 2));
      return false;
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`❌ Invalid JSON format in ${filePath}.`);
    } else {
      console.error(`An unexpected error occurred processing ${filePath}:`, error);
    }
    return false;
  }
}

if (import.meta.main) {
  // Get file path from command line arguments (Bun.argv)
  // Bun.argv[0] is the executable, [1] is the script, [2] is the first arg
  const targetFile = Bun.argv[2];

  if (!targetFile) {
    console.error('Please provide a file path to validate.');
    console.error('Usage: bun src/schema-checker.ts <path-to-json-file>');
    process.exit(1);
  }

  const isValid = await validateSchema(targetFile);
  if (!isValid) {
    process.exit(1);
  }
}
