import { z } from "zod";
import { resolve } from "path";

export const ThemeSchema = z
  .object({
    name: z.string().min(1, "Theme name is required"),
    id: z
      .string()
      .min(1, "ID (url) is required")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "ID must be a slug (lowercase letters and numbers, separated by single hyphens)",
      )
      .refine(
        (id) => !id.includes("..") && !id.includes("/") && !id.includes("\\"),
        "ID contains invalid characters",
      ),
    description: z.string().min(1, "Description is required"),
    repoUrl: z.string().min(1, "Main repository url is required"),
    rawUrls: z
      .array(z.string().trim().min(1, "Actual theme url cannot be empty"))
      .nonempty("You must list at least one raw theme url"),
    type: z.enum(["light", "dark"]),
    authors: z
      .array(z.string().trim().min(1, "Authors name cannot be empty"))
      .nonempty("You must list at least one author"),
    tags: z
      .array(z.string().trim().min(1, "Tags cannot be empty"))
      .nonempty("You must list at least one tag"),
    elispBefore: z.string().optional().default(""),
    elispAfter: z.string().optional().default(""),
  })
  .refine(
    (data) => {
      if (data.repoUrl === "local") {
        return data.rawUrls.every((url) => {
          const match = url.match(/^static\/themes\/([^/]+)\//);
          if (!match) return false;
          const folder = match[1];
          return data.id.includes(folder);
        });
      }
      return true;
    },
    {
      message:
        "Local themes must have rawUrls in 'static/themes/{folder}/' where {folder} is a substring of the theme ID",
      path: ["rawUrls"],
    },
  );
export type Theme = z.infer<typeof ThemeSchema>;

interface InjectionIssue {
  field: string;
  reason: string;
}

const INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /<\/?script\b/i, reason: "contains a script tag" },
  { pattern: /<[^>]+>/, reason: "contains HTML-like tags" },
  { pattern: /\bon\w+\s*=/i, reason: "contains inline event handler syntax" },
  { pattern: /javascript\s*:/i, reason: "contains javascript: protocol" },
  { pattern: /data\s*:\s*text\/html/i, reason: "contains data:text/html payload" },
  { pattern: /<\s*!\s*--/i, reason: "contains HTML comment syntax" },
];

function detectInjectionPattern(value: string): string | null {
  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      return reason;
    }
  }

  return null;
}

function validateUrlProtocol(field: string, value: string): InjectionIssue | null {
  if (value === "local" || value.startsWith("static/themes/")) {
    return null;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { field, reason: "must use http, https protocol or be a local static/themes/ path" };
    }
  } catch {
    return { field, reason: "must be a valid absolute URL or a local static/themes/ path" };
  }

  return null;
}

/**
 * Performs a defensive scan for potentially unsafe content in recipe fields
 * that are rendered into generated HTML or embedded scripts.
 *
 * @param {Theme} recipe - The validated theme object.
 * @returns {InjectionIssue[]} A list of detected issues. Empty array means no issue found.
 */
export function validateRecipeForInjection(recipe: Theme): InjectionIssue[] {
  const issues: InjectionIssue[] = [];

  const textFields: Array<[string, string]> = [
    ["name", recipe.name],
    ["id", recipe.id],
    ["description", recipe.description],
    ["repoUrl", recipe.repoUrl],
    ["type", recipe.type],
    ["elispBefore", recipe.elispBefore],
    ["elispAfter", recipe.elispAfter],
  ];

  for (const [field, value] of textFields) {
    const reason = detectInjectionPattern(value);
    if (reason) {
      issues.push({ field, reason });
    }
  }

  recipe.tags.forEach((tag, index) => {
    const reason = detectInjectionPattern(tag);
    if (reason) {
      issues.push({ field: `tags[${index}]`, reason });
    }
  });

  recipe.authors.forEach((author, index) => {
    const reason = detectInjectionPattern(author);
    if (reason) {
      issues.push({ field: `authors[${index}]`, reason });
    }
  });

  const repoUrlIssue = validateUrlProtocol("repoUrl", recipe.repoUrl);
  if (repoUrlIssue) {
    issues.push(repoUrlIssue);
  }

  recipe.rawUrls.forEach((rawUrl, index) => {
    const field = `rawUrls[${index}]`;
    const reason = detectInjectionPattern(rawUrl);
    if (reason) {
      issues.push({ field, reason });
      return;
    }

    const urlIssue = validateUrlProtocol(field, rawUrl);
    if (urlIssue) {
      issues.push(urlIssue);
    }
  });

  return issues;
}

/**
 * Performs strict validation of a theme recipe, including both schema checks
 * and defensive security scans for injection patterns.
 *
 * @param jsonData - The raw JSON data to validate.
 * @returns An object indicating success and the validated data, or a list of error messages.
 */
export function validateRecipeStrict(
  jsonData: unknown,
): { success: true; data: Theme } | { success: false; errors: string[] } {
  const result = ThemeSchema.safeParse(jsonData);

  if (!result.success) {
    return {
      success: false,
      errors: [JSON.stringify(result.error.format(), null, 2)],
    };
  }

  const injectionIssues = validateRecipeForInjection(result.data);
  if (injectionIssues.length > 0) {
    return {
      success: false,
      errors: injectionIssues.map((issue) => `Field '${issue.field}' ${issue.reason}`),
    };
  }

  return { success: true, data: result.data };
}

export async function validateSchema(filePath: string): Promise<boolean> {
  try {
    const absolutePath = resolve(filePath);
    const file = Bun.file(absolutePath);

    if (!(await file.exists())) {
      console.error(`Error: File not found at ${absolutePath}`);
      return false;
    }

    const jsonData = await file.json();
    const result = validateRecipeStrict(jsonData);

    if (result.success) {
      console.log(`✅ Schema validation passed for ${filePath}!`);
      return true;
    } else {
      console.error(`❌ Validation failed for ${filePath}:`);
      result.errors.forEach((err) => console.error(err));
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
    console.error("Please provide a file path to validate.");
    console.error("Usage: bun src/core/schema-checker.ts <path-to-json-file>");
    process.exit(1);
  }

  const isValid = await validateSchema(targetFile);
  if (!isValid) {
    process.exit(1);
  }
}
