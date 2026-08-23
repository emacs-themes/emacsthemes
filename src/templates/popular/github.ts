/**
 * GitHub popularity source: repository search -> ranked theme entries.
 */
import type { GitHubThemeEntry } from "../../core/popular-types";
import { fetchJson } from "./fetch-json";

const GITHUB_SEARCH_URL = "https://api.github.com/search/repositories";
// Broad keyword search over names and descriptions. Known false positives
// (theme-adjacent tools rather than themes) are excluded by
// KNOWN_NON_THEME_REPOS below; the query itself cannot express that nuance.
const GITHUB_SEARCH_QUERY =
  'theme OR "color scheme" OR "colour scheme" OR colorscheme OR colourscheme in:name,description language:"Emacs Lisp" is:public';
const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_USER_AGENT = "emacs-themes/emacsthemes";

/**
 * Repositories the keyword search returns that are not actual themes
 * (mode-line packages, theme utilities, configs). Curated from live results.
 */
const KNOWN_NON_THEME_REPOS: ReadonlySet<string> = new Set([
  "thebb/spaceline",
  "domtronn/spaceline-all-the-icons.el",
  "ianyepan/yay-evil-emacs",
  "emacs-jp/replace-colorthemes",
  "lionyxml/auto-dark-emacs",
  "guidoschmidt/circadian.el",
  "jcaw/theme-magic",
  "jasonm23/autothemer",
  "hadronzoo/theme-changer",
]);

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items?: GitHubRepoItem[];
}

interface GitHubRepoItem {
  full_name: string;
  html_url: string;
  stargazers_count: number;
}

/**
 * Builds the GitHub repository-search URL with the fixed public query.
 *
 * @param {number} limit - The maximum number of repositories per page.
 * @returns {string} The fully encoded GitHub search URL.
 */
function buildGitHubSearchUrl(limit: number): string {
  const params = new URLSearchParams({
    q: GITHUB_SEARCH_QUERY,
    sort: "stars",
    order: "desc",
    per_page: String(limit),
    page: "1",
  });
  const url = new URL(GITHUB_SEARCH_URL);
  url.search = params.toString();
  return url.toString();
}

/**
 * Builds the request headers for the GitHub search request.
 *
 * The optional `GITHUB_TOKEN` is read at request time so callers and tests can
 * set or omit it after module import. The token value is trimmed and never
 * placed in URLs, HTML output, console output, or log files.
 *
 * @returns {Record<string, string>} The headers to send with the GitHub request.
 */
function buildGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": GITHUB_USER_AGENT,
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Validates a GitHub search payload and extracts its repository items.
 *
 * Lenient by design: malformed items and `incomplete_results` degrade the
 * result with a warning instead of discarding the whole source. The payload is
 * rejected only when it has no usable items at all.
 *
 * @param {unknown} payload - The parsed GitHub search response body.
 * @returns {{ items: GitHubRepoItem[]; warning?: string }} The valid repository items plus any degradation warning.
 * @throws {Error} When the payload shape is unusable or contains no valid items.
 */
function validateGitHubPayload(payload: unknown): { items: GitHubRepoItem[]; warning?: string } {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid GitHub search payload: expected an object");
  }
  const response = payload as Partial<GitHubSearchResponse>;
  if (!Array.isArray(response.items)) {
    throw new Error("Invalid GitHub search payload: items must be an array");
  }

  const warnings: string[] = [];
  if (response.incomplete_results === true) {
    warnings.push("GitHub search results are incomplete");
  }

  const items = response.items.filter(isValidGitHubItem);
  const dropped = response.items.length - items.length;
  if (dropped > 0) {
    warnings.push(`${dropped} malformed repository item(s) dropped`);
  }
  if (items.length === 0) {
    throw new Error("GitHub search returned no repositories");
  }
  return { items, warning: warnings.length > 0 ? warnings.join("; ") : undefined };
}

/**
 * Type guard for a well-formed GitHub repository item.
 *
 * @param {unknown} value - The candidate item value.
 * @returns {boolean} True when all required fields are present and valid.
 */
function isValidGitHubItem(value: unknown): value is GitHubRepoItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.full_name === "string" &&
    item.full_name.length > 0 &&
    typeof item.html_url === "string" &&
    item.html_url.length > 0 &&
    typeof item.stargazers_count === "number" &&
    Number.isFinite(item.stargazers_count) &&
    item.stargazers_count >= 0
  );
}

/**
 * Fetches and ranks the most popular public GitHub Emacs Lisp theme repositories by stars.
 *
 * The API already sorts by stars descending; the client-side re-sort is
 * defensive and guarantees the deterministic name tie-break that the API's
 * best-match secondary ordering does not provide.
 *
 * @param {number} limit - The maximum number of entries to keep.
 * @returns {Promise<{ entries: GitHubThemeEntry[]; warning?: string }>} The ranked entries and any degradation warning.
 * @throws {Error} When GitHub data cannot be fetched or is unusable.
 */
export async function fetchGitHubThemes(limit: number): Promise<{
  entries: GitHubThemeEntry[];
  warning?: string;
}> {
  const payload = await fetchJson<GitHubSearchResponse>(
    buildGitHubSearchUrl(limit),
    buildGitHubHeaders(),
    { redirect: "error" },
  );
  const { items, warning } = validateGitHubPayload(payload);

  const qualifying = items.filter(
    (item) => !KNOWN_NON_THEME_REPOS.has(item.full_name.toLowerCase()),
  );
  if (qualifying.length === 0) {
    throw new Error("GitHub search returned no qualifying theme repositories");
  }

  const entries = qualifying
    .toSorted((a, b) =>
      a.stargazers_count > b.stargazers_count
        ? -1
        : a.stargazers_count < b.stargazers_count
          ? 1
          : a.full_name.localeCompare(b.full_name, "en"),
    )
    .slice(0, limit)
    .map((item) => ({
      name: item.full_name,
      stars: item.stargazers_count,
      sourceUrl: item.html_url,
    }));

  return { entries, warning };
}
