import { basename } from "node:path";
import { escapeHtml, toSafeUrl } from "../../core/html-utils";
import { assertPathWithinRoot } from "../../core/path-utils";
import { LOCAL_THEME_REPO_URL, LOCAL_THEMES_DIR } from "../../core/constants";
import { toLocalThemeRelativePath } from "../../core/local-theme-sources";
import type { Theme } from "../../core/schema-checker";

/** Public URL prefix under which bundled local theme files are served. */
const LOCAL_THEMES_PUBLIC_ROOT = `/${LOCAL_THEMES_DIR}/`;

/**
 * Pretty display label per known repository host. Unknown hosts fall back to
 * the raw hostname, which is still accurate for non-GitHub forges.
 */
const REPOSITORY_HOST_LABELS: Record<string, string> = {
  "github.com": "GitHub",
  "gist.github.com": "GitHub Gist",
  "gitlab.com": "GitLab",
  "codeberg.org": "Codeberg",
  "codeberg.com": "Codeberg",
  "bitbucket.org": "Bitbucket",
  "framagit.org": "Framagit",
  "hg.sr.ht": "SourceHut",
  "sr.ht": "SourceHut",
};

type ThemeSourceLinkTheme = Pick<Theme, "id" | "repoUrl" | "rawUrls">;

/**
 * Checks that a validated local source file exists and is a regular file.
 *
 * @param {string} relativePath - Validated path relative to `static/themes/`.
 * @returns {boolean} True when the file exists.
 */
export type LocalFileExists = (relativePath: string) => boolean;

/**
 * Escapes control characters in values embedded in error messages so a
 * hostile recipe cannot pollute build/CI logs with raw escape sequences.
 *
 * @param {string} value - Raw value to embed in a message.
 * @returns {string} The value with control characters escaped.
 */
function safeMessageValue(value: string): string {
  let result = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    result += code < 0x20 || code === 0x7f ? `\\x${code.toString(16).padStart(2, "0")}` : char;
  }
  return result;
}

/**
 * Validates a local source path for a generated source link.
 *
 * The segment rules are shared with recipe validation (see
 * `toLocalThemeRelativePath`), so validator-approved recipes cannot reach the
 * renderer with an unsafe path. `assertPathWithinRoot` below is a deliberate
 * final backstop against root escape, not a redundant check: it also guards
 * direct (non-recipe) callers of this renderer.
 *
 * @param {string} themeId - Theme identifier used in validation errors.
 * @param {string} sourcePath - Recipe path under `static/themes/`.
 * @returns {{ relativePath: string; filename: string }} The validated relative path and filename.
 * @throws {Error} If the source path is not a safe path under `static/themes/`.
 */
function validateLocalSourcePath(
  themeId: string,
  sourcePath: string,
): { relativePath: string; filename: string } {
  const relativePath = toLocalThemeRelativePath(sourcePath);
  if (relativePath === null) {
    throw new Error(
      `Invalid local source path for theme "${themeId}": ${safeMessageValue(sourcePath)}`,
    );
  }

  // Defense-in-depth: the shared segment checks above already reject any
  // traversal; this resolution backstop also protects direct callers.
  assertPathWithinRoot(LOCAL_THEMES_DIR, relativePath);

  return { relativePath, filename: basename(relativePath) };
}

/**
 * Escapes path segments for a root-relative public URL while preserving its directory separators.
 *
 * @param {string} relativePath - Validated path relative to `static/themes/`.
 * @returns {string} URL-encoded public source path.
 */
function buildLocalSourceUrl(relativePath: string): string {
  const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");
  return `${LOCAL_THEMES_PUBLIC_ROOT}${encodedPath}`;
}

/**
 * Derives the visible repository link label from the validated URL host.
 *
 * @param {string} safeRepositoryUrl - URL previously accepted by {@link toSafeUrl}.
 * @returns {string} Human-readable "View Source on {host}" label.
 */
function repositoryLinkLabel(safeRepositoryUrl: string): string {
  const host = new URL(safeRepositoryUrl).hostname;
  return `View Source on ${REPOSITORY_HOST_LABELS[host] ?? host}`;
}

/**
 * Builds the anchors for an already-validated list of local source entries.
 *
 * @param {Array<{ relativePath: string; filename: string }>} entries - Validated local sources.
 * @returns {string} Rendered source-link anchors.
 */
function renderLocalSourceLinks(
  entries: Array<{ relativePath: string; filename: string }>,
): string {
  return entries
    .map(({ relativePath, filename }) => {
      // `buildLocalSourceUrl` percent-encodes all reserved characters before
      // `escapeHtml` runs, so the encoded URL never contains characters the
      // escaper would transform (safe double-encoding invariant).
      const safeFilename = escapeHtml(filename);
      const sourceUrl = escapeHtml(buildLocalSourceUrl(relativePath));
      return `<a class="button" href="${sourceUrl}" target="_blank" rel="noopener noreferrer" aria-label="View local source file ${safeFilename} (opens in a new tab)">View Local Source: ${safeFilename}</a>`;
    })
    .join("\n");
}

/**
 * Renders source links for a theme detail page.
 *
 * Local themes expose one new-tab link for every bundled source file in recipe
 * order. Remote themes expose only their validated repository link; their raw
 * source URLs are intentionally not rendered because they are implementation
 * inputs, not repository links.
 *
 * When `fileExists` is provided, local sources that are not regular files on
 * disk are omitted so the build can never ship a dead link. Remote themes are
 * never subject to the check.
 *
 * @param {ThemeSourceLinkTheme} theme - Theme identity and source metadata.
 * @param {LocalFileExists} [fileExists] - Optional existence check for local source files.
 * @returns {string} Rendered source-link anchors.
 * @throws {Error} If a local path or remote repository URL is unsafe.
 */
export function renderThemeSourceLinks(
  theme: ThemeSourceLinkTheme,
  fileExists?: LocalFileExists,
): string {
  if (theme.repoUrl === LOCAL_THEME_REPO_URL) {
    const entries = theme.rawUrls
      .map((sourcePath) => validateLocalSourcePath(theme.id, sourcePath))
      .filter(({ relativePath }) => fileExists === undefined || fileExists(relativePath));
    return renderLocalSourceLinks(entries);
  }

  const safeRepositoryUrl = toSafeUrl(theme.repoUrl);
  if (!safeRepositoryUrl) {
    throw new Error(
      `Invalid repository URL for theme "${theme.id}": ${safeMessageValue(theme.repoUrl)}`,
    );
  }

  const label = escapeHtml(repositoryLinkLabel(safeRepositoryUrl));
  return `<a class="button" href="${escapeHtml(safeRepositoryUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${label} (opens in a new tab)">${label}</a>`;
}

/**
 * Renders source links without ever throwing: unsafe input and missing local
 * files are reported through `onError` and yield no (or only safe) links,
 * mirroring the build's per-theme screenshot fallback so one bad recipe can
 * never abort the whole site build.
 *
 * @param {ThemeSourceLinkTheme} theme - Theme identity and source metadata.
 * @param {LocalFileExists} [fileExists] - Optional existence check for local source files.
 * @param {(message: string) => void} [onError] - Error reporter; defaults to `console.warn`.
 * @returns {string} Rendered source-link anchors, or an empty string on unsafe input.
 */
export function renderThemeSourceLinksSafely(
  theme: ThemeSourceLinkTheme,
  fileExists?: LocalFileExists,
  onError: (message: string) => void = (message) => console.warn(message),
): string {
  try {
    if (theme.repoUrl === LOCAL_THEME_REPO_URL) {
      const entries = theme.rawUrls.map((sourcePath) =>
        validateLocalSourcePath(theme.id, sourcePath),
      );
      for (const { relativePath } of entries) {
        if (fileExists !== undefined && !fileExists(relativePath)) {
          onError(`Missing local source file for theme "${theme.id}": ${relativePath}`);
        }
      }
      const present = entries.filter(
        ({ relativePath }) => fileExists === undefined || fileExists(relativePath),
      );
      return renderLocalSourceLinks(present);
    }
    return renderThemeSourceLinks(theme);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onError(`Skipping source links for theme "${theme.id}": ${message}`);
    return "";
  }
}
