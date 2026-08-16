/**
 * Shared identity normalization for themes and their repositories.
 *
 * Used by both build-time recipe matching (`src/templates/core/popular-themes.ts`)
 * and browser-side repository filtering (`src/templates/html/partials/search-script.js`)
 * so both sides agree on what "the same theme" and "the same repository" mean.
 * All helpers are side-effect free and deterministic.
 */

/**
 * Query parameter name for the repository filter on the themes directory page.
 *
 * Shared between build-time link generation (`popular-themes.ts`) and the
 * browser bundle (`search-script.js`) so renaming the parameter cannot
 * silently break popular-page → directory links.
 */
export const REPOSITORY_URL_PARAM = "repo";

/**
 * Hosts whose repository paths are case-insensitive, per the convention of
 * the popularity providers. Paths on other hosts keep their original case so
 * unrelated self-hosted repositories cannot collide.
 */
const CASE_INSENSITIVE_PATH_HOSTS: ReadonlySet<string> = new Set([
  "github.com",
  "gitlab.com",
  "codeberg.org",
  "bitbucket.org",
]);

/**
 * Normalizes a theme identity (display name or recipe id) for comparison.
 *
 * Applies Unicode compatibility normalization and case folding, removes
 * combining marks, collapses runs of non-alphanumeric characters into one
 * hyphen, and strips leading/trailing hyphens.
 *
 * @param {string} value - The raw theme name or id.
 * @returns {string} The comparable identity, or an empty string when the input has no usable identity characters.
 */
export function normalizeThemeIdentity(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalizes a repository URL to its canonical HTTPS identity.
 *
 * Accepts only absolute `http:`/`https:` URLs without credentials; returns
 * `undefined` for `local`, malformed URLs, credential-bearing URLs, and other
 * schemes. HTTP and HTTPS variants map to the same identity via an HTTPS
 * canonical URL. The host is lowercased, query/fragment data is dropped, a
 * terminal `.git` and trailing slashes are removed, and repository paths are
 * case-folded for known case-insensitive hosts. Non-default ports are
 * preserved so unrelated self-hosted repositories cannot collide; an explicit
 * port equal to the original protocol's default is dropped so
 * `http://host:80` and `https://host` share one identity.
 *
 * @param {string} value - The raw repository URL.
 * @returns {string | undefined} The canonical repository URL, or undefined when the value is unusable.
 */
export function normalizeRepositoryUrl(value: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return undefined;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return undefined;
  }
  if (parsed.username !== "" || parsed.password !== "") {
    return undefined;
  }

  // `parsed.host` is lowercased by the WHATWG URL parser, keeps non-default
  // ports, and drops explicitly written default ports (https:443). An http
  // URL with an explicit `:80` keeps the port, so drop it here to equate
  // `http://host:80` with `https://host`.
  let host = parsed.host;
  const defaultPort = parsed.protocol === "http:" ? "80" : "443";
  if (parsed.port === defaultPort) {
    host = parsed.hostname;
  }

  let path = parsed.pathname;
  if (CASE_INSENSITIVE_PATH_HOSTS.has(parsed.hostname)) {
    path = path.toLocaleLowerCase("en");
  }
  path = path.replace(/(?:\.git)?\/*$/g, "");

  return new URL(`https://${host}${path}`).toString();
}

/**
 * Derives a short human-readable name for an active repository filter.
 *
 * Strips the protocol from a canonical repository URL for display in the
 * filter chip and result messages. Non-URL values (for example a raw invalid
 * `repo` parameter) pass through unchanged so the UI never hides what it is
 * filtering on.
 *
 * @param {string} repositoryUrl - The canonical repository URL or raw filter value.
 * @returns {string} The display name.
 */
export function getRepositoryDisplayName(repositoryUrl: string): string {
  return repositoryUrl.replace(/^https?:\/\//, "");
}
