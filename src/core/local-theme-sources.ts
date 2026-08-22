import { LOCAL_THEMES_DIR } from "./constants";

/** Recipe prefix for local theme source paths, e.g. `static/themes/`. */
export const LOCAL_THEMES_PREFIX = `${LOCAL_THEMES_DIR}/`;

/**
 * Validates a recipe source path against the shared local-themes contract.
 *
 * The path must live under `{@link LOCAL_THEMES_DIR}/` with no backslashes, no
 * empty, `.` or `..` segments, and must name a file below the theme folder
 * (at least one `/` inside the relative path). This is the single source of
 * truth shared by schema validation, screenshot generation, and link
 * rendering, so the modules can never drift apart.
 *
 * @param {string} sourcePath - Raw source path from a recipe (`rawUrls` entry).
 * @returns {string | null} The path relative to `static/themes`, or null when unsafe.
 */
export function toLocalThemeRelativePath(sourcePath: string): string | null {
  if (!sourcePath.startsWith(LOCAL_THEMES_PREFIX) || sourcePath.includes("\\")) {
    return null;
  }

  const relativePath = sourcePath.slice(LOCAL_THEMES_PREFIX.length);
  const segments = relativePath.split("/");
  if (
    relativePath === "" ||
    !relativePath.includes("/") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    return null;
  }

  return relativePath;
}
