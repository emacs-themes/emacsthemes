/**
 * GitHub popularity source: repository search -> ranked theme entries.
 */
import { z } from "zod";
import type { GitHubThemeEntry } from "../../core/popular-types";
import { fetchJson } from "./fetch-json";

const GITHUB_SEARCH_URL = "https://api.github.com/search/repositories";

// Broad keyword search over names and descriptions. Curated exceptions are
// excluded by EXCLUDED_GITHUB_REPOS below; the query itself cannot express
// those nuances.
const GITHUB_SEARCH_QUERY =
  'theme OR "color scheme" OR "colour scheme" OR colorscheme OR colourscheme in:name,description language:"Emacs Lisp" is:public';

const GITHUB_API_VERSION = "2022-11-28";

const GITHUB_USER_AGENT = "emacs-themes/emacsthemes";

/**
 * Canonical upstream URLs for ranked GitHub repositories that have migrated.
 * The archived GitHub repository still supplies its star count, while links
 * target the maintained upstream repository.
 */
const SOURCE_URL_OVERRIDES = new Map<string, string>([
  ["axgfn/parchment", "https://gitlab.com/axgfn/parchment"],
  ["lambda-emacs/lambda-themes", "https://codeberg.org/Lambda-Emacs/lambda-themes"],
]);

/**
 * Repositories intentionally omitted from the GitHub ranking: keyword false
 * positives and duplicates already represented by another popularity source.
 */
interface GitHubRepoItem {
  full_name: string;
  html_url: string;
  stargazers_count: number;
}

const EXCLUDED_GITHUB_REPOS: ReadonlySet<string> = new Set([
  "vic/color-theme-buffer-local",
  "jonnay/org-beautify-theme",
  "sjrmanning/noctilux-theme",
  "thebb/spaceline",
  "domtronn/spaceline-all-the-icons.el",
  "anthonydigirolamo/airline-themes",
  "thorstenrhau/token",
  "ianyepan/yay-evil-emacs",
  "emacs-jp/replace-colorthemes",
  "lionyxml/auto-dark-emacs",
  "guidoschmidt/circadian.el",
  "jcaw/theme-magic",
  "jasonm23/autothemer",
  "ocodo/autothemer",
  "hadronzoo/theme-changer",
]);

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

/** Contract for the repository-search envelope fields used by the renderer. */
const GitHubRepoItemSchema = z.object({
  full_name: z.string().min(1),
  html_url: z.string().min(1),
  stargazers_count: z
    .number()
    .refine(Number.isFinite)
    .refine((count) => count >= 0),
});

/** Contract for the search-response envelope fields used by the renderer. */
const GitHubSearchResponseSchema = z.object({
  incomplete_results: z.boolean().optional(),
  items: z.array(z.unknown()),
});

/**
 * Builds the request headers for the GitHub search request.
 *
 * The optional `GITHUB_TOKEN` is read at request time so callers and tests can
 * set or omit it after module import. The token value is trimmed and never
 * placed in URLs, HTML output, console output, or log files.
 *
 * @returns {Record<string, string>} The headers to send with the GitHub request.
 */
function buildGitHubHeaders() {
  const baseHeaders = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": GITHUB_USER_AGENT,
  };

  const token = process.env.GITHUB_TOKEN?.trim();

  return token ? { ...baseHeaders, Authorization: `Bearer ${token}` } : baseHeaders;
}

/**
 * Fetches and ranks the most popular public GitHub Emacs Lisp theme repositories by stars.
 *
 * The API already sorts by stars descending; the client-side re-sort is
 * defensive and guarantees the deterministic name tie-break that the API's
 * best-match secondary ordering does not provide.
 *
 * Lenient by design: malformed items and `incomplete_results` degrade the
 * result with a warning instead of discarding the whole source. The payload is
 * rejected only when it has no usable items at all.
 *
 * @param {number} limit - The maximum number of entries to keep.
 * @returns {Promise<{ entries: GitHubThemeEntry[]; warning?: string }>} The ranked entries and any degradation warning.
 * @throws {Error} When GitHub data cannot be fetched or is unusable.
 */
export async function fetchGitHubThemes(limit: number): Promise<{
  entries: GitHubThemeEntry[];
  warning?: string;
}> {
  const payload = await fetchJson<unknown>(buildGitHubSearchUrl(limit), buildGitHubHeaders(), {
    redirect: "error",
  });

  const decoded = GitHubSearchResponseSchema.safeParse(payload);

  if (!decoded.success) {
    throw new Error("Invalid GitHub search payload: expected an object with an items array");
  }

  const warnings: string[] = [];

  if (decoded.data.incomplete_results === true) {
    warnings.push("GitHub search results are incomplete");
  }

  // Malformed items degrade the ranking with a warning instead of failing the
  // whole source; each candidate is validated against the item schema.
  const items: GitHubRepoItem[] = [];
  let dropped = 0;

  for (const candidate of decoded.data.items) {
    const item = GitHubRepoItemSchema.safeParse(candidate);

    if (item.success) {
      items.push(item.data);
    } else {
      dropped += 1;
    }
  }

  if (dropped > 0) {
    warnings.push(`${dropped} malformed repository item(s) dropped`);
  }

  if (items.length === 0) {
    throw new Error("GitHub search returned no repositories");
  }

  const qualifying = items.filter(
    (item) => !EXCLUDED_GITHUB_REPOS.has(item.full_name.toLowerCase()),
  );

  if (qualifying.length === 0) {
    throw new Error("GitHub search returned no qualifying theme repositories");
  }

  const warning = warnings.length > 0 ? warnings.join("; ") : undefined;

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
      sourceUrl: SOURCE_URL_OVERRIDES.get(item.full_name.toLowerCase()) ?? item.html_url,
    }));

  return { entries, warning };
}
